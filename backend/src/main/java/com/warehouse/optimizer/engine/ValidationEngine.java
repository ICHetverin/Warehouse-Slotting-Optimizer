package com.warehouse.optimizer.engine;

import com.warehouse.optimizer.dto.Assignment;
import com.warehouse.optimizer.dto.ScoringValidation;
import com.warehouse.optimizer.exception.ScoringException;
import com.warehouse.optimizer.model.Order;
import com.warehouse.optimizer.model.OrderLine;
import com.warehouse.optimizer.model.Slot;
import com.warehouse.optimizer.model.Warehouse;
import com.warehouse.optimizer.repository.OrderLineRepository;
import com.warehouse.optimizer.repository.OrderRepository;
import com.warehouse.optimizer.repository.SlotRepository;
import com.warehouse.optimizer.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jgrapht.Graph;
import org.jgrapht.graph.DefaultWeightedEdge;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ValidationEngine {

    private final OrderRepository      orderRepo;
    private final OrderLineRepository  orderLineRepo;
    private final WarehouseRepository  warehouseRepo;
    private final SlotRepository       slotRepo;
    private final RoutingEngine        routingEngine;

    private static final int ROUTE_SAMPLE_SIZE = 50;
    private static final double MAPE_CAP = 5.0;

    // ──────────────────────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────────────────────

    /** Route-efficiency evaluation: aggregate gain plus per-order distances for bootstrap. */
    private record RouteEval(double gainPct, double[] cur, double[] prop) {}

    private static final int ROUTE_WINDOW_DAYS = 1200;

    @Transactional(readOnly = true)
    public ScoringValidation validate(Long warehouseId, List<Assignment> assignments, ScoringContext ctx) {
        log.info("Starting validation for warehouse={}", warehouseId);

        double mape = validateForecastAccuracy(warehouseId, ROUTE_WINDOW_DAYS, ctx);
        double wape = validateForecastWape(warehouseId, ROUTE_WINDOW_DAYS);
        double stability = validatePlacementStability(assignments, ctx);
        RouteEval route = validateRouteEfficiency(warehouseId, assignments, ROUTE_SAMPLE_SIZE);

        // Percentile bootstrap CI on the *aggregate* route-efficiency gain (resample orders),
        // so the interval brackets the headline gain rather than a per-order mean.
        double ciLow = route.gainPct(), ciHigh = route.gainPct();
        int m = route.cur().length;
        if (m >= 2) {
            Random rng = new Random(42);
            int b = 2000;
            double[] ratios = new double[b];
            for (int k = 0; k < b; k++) {
                double sc = 0, sp = 0;
                for (int j = 0; j < m; j++) {
                    int idx = rng.nextInt(m);
                    sc += route.cur()[idx];
                    sp += route.prop()[idx];
                }
                ratios[k] = sc > 0 ? (sc - sp) / sc * 100.0 : 0.0;
            }
            Arrays.sort(ratios);
            ciLow = Statistics.percentile(ratios, 0.025);
            ciHigh = Statistics.percentile(ratios, 0.975);
        }

        Map<String, Double> detail = new HashMap<>();
        detail.put("aClassCount", ctx.abcBoost().values().stream().filter(v -> v >= 1.2).count() * 1.0);
        detail.put("xClassCount", ctx.xyzBoost().values().stream().filter(v -> v >= 1.0).count() * 1.0);
        detail.put("avgScoreDelta", assignments.stream().mapToDouble(Assignment::scoreDelta).average().orElse(0.0));
        detail.put("forecastMape", round1(mape));
        detail.put("ordersEvaluated", (double) route.cur().length);

        return new ScoringValidation(
                round1(mape),
                round1(wape),
                round1(stability),
                round1(route.gainPct()),
                round1(ciLow),
                round1(ciHigh),
                detail
        );
    }

    private static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Parameter 1: Forecast Accuracy (MAPE on A-class SKUs)
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Splits historical daily data into train (70%) and test (30%).
     * Computes MAPE of predicted vs actual order counts for A-class SKUs.
     */
    @Transactional(readOnly = true)
    public double validateForecastAccuracy(Long warehouseId, int days, ScoringContext ctx) {
        Instant since = anchoredSince(warehouseId, days);
        List<Object[]> rows = orderLineRepo.findDailyOrderCounts(warehouseId, since);
        if (rows.isEmpty()) return 0.0;

        LocalDate minDate = rows.stream()
                .map(r -> ((Date) r[1]).toLocalDate())
                .min(Comparator.naturalOrder())
                .orElse(LocalDate.now());
        LocalDate maxDate = rows.stream()
                .map(r -> ((Date) r[1]).toLocalDate())
                .max(Comparator.naturalOrder())
                .orElse(LocalDate.now());

        long totalDays = ChronoUnit.DAYS.between(minDate, maxDate) + 1;
        if (totalDays <= 1) return 0.0;

        LocalDate cutoff = minDate.plusDays((long) (totalDays * 0.7));

        // Scale the train-period total to the test horizon so predicted and actual
        // are on the same time span (otherwise MAPE is systematically inflated).
        long trainDays = ChronoUnit.DAYS.between(minDate, cutoff) + 1;
        long testDays  = ChronoUnit.DAYS.between(cutoff, maxDate);
        if (trainDays <= 0 || testDays <= 0) return 0.0;
        double scale = testDays / (double) trainDays;

        Map<Long, Double> trainCounts = new HashMap<>();
        Map<Long, Double> testCounts  = new HashMap<>();

        for (Object[] row : rows) {
            Long skuId = ((Number) row[0]).longValue();
            Date sqlDate = (Date) row[1];
            int cnt = ((Number) row[2]).intValue();

            if (!sqlDate.toLocalDate().isAfter(cutoff)) {
                trainCounts.merge(skuId, (double) cnt, Double::sum);
            } else {
                testCounts.merge(skuId, (double) cnt, Double::sum);
            }
        }

        Set<Long> aClassSkus = ctx.abcBoost().entrySet().stream()
                .filter(e -> e.getValue() >= 1.2)
                .map(Map.Entry::getKey)
                .collect(Collectors.toSet());

        if (aClassSkus.isEmpty()) return 0.0;

        double totalMape = 0.0;
        int count = 0;
        for (Long skuId : aClassSkus) {
            double predicted = trainCounts.getOrDefault(skuId, 0.0) * scale;
            double actual = testCounts.getOrDefault(skuId, 0.0);
            if (actual > 0) {
                double ape = Math.abs(actual - predicted) / actual;
                totalMape += Math.min(ape, MAPE_CAP);
                count++;
            }
        }
        return count > 0 ? (totalMape / count) * 100.0 : 0.0;
    }

    /**
     * WAPE (Weighted Absolute Percentage Error) = Σ|actual−predicted| / Σactual over
     * all SKUs. Unlike MAPE it is defined when some actuals are zero and is volume-
     * weighted, so it does not blow up on rare/intermittent demand — the preferred
     * accuracy metric for multi-SKU forecasts.
     */
    @Transactional(readOnly = true)
    public double validateForecastWape(Long warehouseId, int days) {
        Instant since = anchoredSince(warehouseId, days);
        List<Object[]> rows = orderLineRepo.findDailyOrderCounts(warehouseId, since);
        if (rows.isEmpty()) return 0.0;

        LocalDate minDate = rows.stream().map(r -> ((Date) r[1]).toLocalDate())
                .min(Comparator.naturalOrder()).orElse(LocalDate.now());
        LocalDate maxDate = rows.stream().map(r -> ((Date) r[1]).toLocalDate())
                .max(Comparator.naturalOrder()).orElse(LocalDate.now());
        long totalDays = ChronoUnit.DAYS.between(minDate, maxDate) + 1;
        if (totalDays <= 1) return 0.0;

        // Predict each SKU's test-period demand by scaling its train rate to the test span.
        LocalDate cutoff = minDate.plusDays((long) (totalDays * 0.7));
        long trainDays = ChronoUnit.DAYS.between(minDate, cutoff) + 1;
        long testDays = ChronoUnit.DAYS.between(cutoff, maxDate);
        if (trainDays <= 0 || testDays <= 0) return 0.0;
        double scale = testDays / (double) trainDays;

        Map<Long, Double> train = new HashMap<>();
        Map<Long, Double> test  = new HashMap<>();
        for (Object[] row : rows) {
            Long skuId = ((Number) row[0]).longValue();
            LocalDate d = ((Date) row[1]).toLocalDate();
            double cnt = ((Number) row[2]).doubleValue();
            if (!d.isAfter(cutoff)) train.merge(skuId, cnt, Double::sum);
            else test.merge(skuId, cnt, Double::sum);
        }

        Set<Long> skus = new HashSet<>();
        skus.addAll(train.keySet());
        skus.addAll(test.keySet());

        double absErr = 0.0, totalActual = 0.0;
        for (Long skuId : skus) {
            double predicted = train.getOrDefault(skuId, 0.0) * scale;
            double actual = test.getOrDefault(skuId, 0.0);
            absErr += Math.abs(actual - predicted);
            totalActual += actual;
        }
        return totalActual > 0 ? absErr / totalActual * 100.0 : 0.0;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Parameter 2: Placement Stability Index
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Percentage of assignments that are not flagged as high-risk.
     * Risk = Z-class (volatile demand) + high score delta.
     */
    public double validatePlacementStability(List<Assignment> assignments, ScoringContext ctx) {
        if (assignments.isEmpty()) return 0.0;

        double avgDelta = assignments.stream().mapToDouble(Assignment::scoreDelta).average().orElse(0.0);
        double highDeltaThreshold = avgDelta * 1.5;

        int stable = 0;
        for (Assignment a : assignments) {
            double xyzBoost = ctx.xyzBoost().getOrDefault(a.skuId(), 1.0);
            boolean isVolatile = xyzBoost <= 0.85; // Z-class
            boolean highDelta = a.scoreDelta() > highDeltaThreshold;

            if (isVolatile && highDelta) {
                // risky placement: volatile SKU moved with high delta
            } else {
                stable++;
            }
        }
        return (double) stable / assignments.size() * 100.0;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Parameter 3: Route Efficiency Gain
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Samples {@code ROUTE_SAMPLE_SIZE} historical orders and compares
     * pick route distances under current vs proposed slot assignments.
     */
    /**
     * Aggregate route-efficiency gain only (no bootstrap / forecast) — a cheap metric
     * for the auto-tuning grid search, which calls this once per weight combination.
     */
    @Transactional(readOnly = true)
    public double routeEfficiencyGain(Long warehouseId, List<Assignment> assignments, int sampleSize) {
        return validateRouteEfficiency(warehouseId, assignments, sampleSize).gainPct();
    }

    private RouteEval validateRouteEfficiency(Long warehouseId, List<Assignment> assignments, int sampleSize) {
        Warehouse warehouse = warehouseRepo.findById(warehouseId)
                .orElseThrow(() -> new ScoringException("Warehouse not found: " + warehouseId));
        List<Slot> slots = slotRepo.findByWarehouseId(warehouseId);

        Graph<Long, DefaultWeightedEdge> graph = routingEngine.buildWarehouseGraph(warehouse, slots);

        Map<Long, Long> currentSkuToSlot = slots.stream()
                .filter(s -> s.getCurrentSku() != null)
                .collect(Collectors.toMap(
                        s -> s.getCurrentSku().getId(),
                        Slot::getId,
                        (a, b) -> a));

        Map<Long, Long> proposedSkuToSlot = assignments.stream()
                .collect(Collectors.toMap(
                        Assignment::skuId,
                        Assignment::toSlotId,
                        (a, b) -> a));

        List<Order> orders = orderRepo.findByWarehouseId(warehouseId);
        if (orders.isEmpty()) return new RouteEval(0.0, new double[0], new double[0]);

        if (orders.size() > sampleSize) {
            orders = new ArrayList<>(orders);
            Collections.shuffle(orders, new Random(42));
            orders = orders.subList(0, sampleSize);
        }

        double totalCurrent = 0.0;
        double totalProposed = 0.0;
        int validOrders = 0;
        List<Double> curList = new ArrayList<>();
        List<Double> propList = new ArrayList<>();

        for (Order order : orders) {
            List<OrderLine> lines = orderLineRepo.findByOrderId(order.getId());
            if (lines.isEmpty()) continue;

            List<Long> skuIds = lines.stream()
                    .map(ol -> ol.getSku().getId())
                    .distinct()
                    .toList();

            List<Long> currentSlots = skuIds.stream()
                    .map(currentSkuToSlot::get)
                    .filter(Objects::nonNull)
                    .toList();
            List<Long> proposedSlots = skuIds.stream()
                    .map(proposedSkuToSlot::get)
                    .filter(Objects::nonNull)
                    .toList();

            if (currentSlots.isEmpty() || proposedSlots.isEmpty()) continue;

            Map<Long, Double> currentWeights = new HashMap<>();
            Map<Long, Double> proposedWeights = new HashMap<>();
            for (OrderLine ol : lines) {
                Long cSlot = currentSkuToSlot.get(ol.getSku().getId());
                Long pSlot = proposedSkuToSlot.get(ol.getSku().getId());
                double w = ol.getSku().getWeightKg().doubleValue();
                if (cSlot != null) currentWeights.put(cSlot, w);
                if (pSlot != null) proposedWeights.put(pSlot, w);
            }

            var currentRoute = routingEngine.optimizePickRoute(
                    graph, RoutingEngine.DOCK_NODE_ID, currentSlots, currentWeights, 0.0);
            var proposedRoute = routingEngine.optimizePickRoute(
                    graph, RoutingEngine.DOCK_NODE_ID, proposedSlots, proposedWeights, 0.0);

            double cur = currentRoute.totalDistanceM();
            double prop = proposedRoute.totalDistanceM();
            totalCurrent += cur;
            totalProposed += prop;
            validOrders++;
            if (cur > 0) { curList.add(cur); propList.add(prop); }
        }

        if (validOrders == 0 || totalCurrent == 0) return new RouteEval(0.0, new double[0], new double[0]);
        double gain = (totalCurrent - totalProposed) / totalCurrent * 100.0;
        return new RouteEval(gain,
                curList.stream().mapToDouble(Double::doubleValue).toArray(),
                propList.stream().mapToDouble(Double::doubleValue).toArray());
    }

    /** Window start anchored to the dataset's latest order date (not wall-clock now()). */
    private Instant anchoredSince(Long warehouseId, int days) {
        Instant maxTs = orderLineRepo.findMaxOrderTimestamp(warehouseId);
        Instant base = (maxTs != null && maxTs.isBefore(Instant.now())) ? maxTs : Instant.now();
        return base.minus(days, ChronoUnit.DAYS);
    }
}
