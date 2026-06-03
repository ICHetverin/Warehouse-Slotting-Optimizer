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

    @Transactional(readOnly = true)
    public ScoringValidation validate(Long warehouseId, List<Assignment> assignments, ScoringContext ctx) {
        log.info("Starting validation for warehouse={}", warehouseId);

        double mape = validateForecastAccuracy(warehouseId, 90, ctx);
        double stability = validatePlacementStability(assignments, ctx);
        double routeGain = validateRouteEfficiency(warehouseId, assignments);

        Map<String, Double> detail = new HashMap<>();
        detail.put("aClassCount", ctx.abcBoost().values().stream().filter(v -> v >= 1.2).count() * 1.0);
        detail.put("xClassCount", ctx.xyzBoost().values().stream().filter(v -> v >= 1.0).count() * 1.0);
        detail.put("avgScoreDelta", assignments.stream().mapToDouble(Assignment::scoreDelta).average().orElse(0.0));

        return new ScoringValidation(
                Math.round(mape * 10) / 10.0,
                Math.round(stability * 10) / 10.0,
                Math.round(routeGain * 10) / 10.0,
                detail
        );
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
        Instant since = Instant.now().minus(days, ChronoUnit.DAYS);
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
            double predicted = trainCounts.getOrDefault(skuId, 0.0);
            double actual = testCounts.getOrDefault(skuId, 0.0);
            if (actual > 0) {
                double ape = Math.abs(actual - predicted) / actual;
                totalMape += Math.min(ape, MAPE_CAP);
                count++;
            }
        }
        return count > 0 ? (totalMape / count) * 100.0 : 0.0;
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
    @Transactional(readOnly = true)
    public double validateRouteEfficiency(Long warehouseId, List<Assignment> assignments) {
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
        if (orders.isEmpty()) return 0.0;

        if (orders.size() > ROUTE_SAMPLE_SIZE) {
            orders = new ArrayList<>(orders);
            Collections.shuffle(orders, new Random(42));
            orders = orders.subList(0, ROUTE_SAMPLE_SIZE);
        }

        double totalCurrent = 0.0;
        double totalProposed = 0.0;
        int validOrders = 0;

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

            totalCurrent += currentRoute.totalDistanceM();
            totalProposed += proposedRoute.totalDistanceM();
            validOrders++;
        }

        if (validOrders == 0 || totalCurrent == 0) return 0.0;
        return (totalCurrent - totalProposed) / totalCurrent * 100.0;
    }
}
