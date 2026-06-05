package com.warehouse.optimizer.engine;

import com.warehouse.optimizer.dto.Assignment;
import com.warehouse.optimizer.dto.ScoringConstraints;
import com.warehouse.optimizer.dto.ScoringWeights;
import com.warehouse.optimizer.exception.ScoringException;
import com.warehouse.optimizer.model.Sku;
import com.warehouse.optimizer.model.Slot;
import com.warehouse.optimizer.model.Warehouse;
import com.warehouse.optimizer.repository.OrderLineRepository;
import com.warehouse.optimizer.repository.SkuRepository;
import com.warehouse.optimizer.repository.SlotRepository;
import com.warehouse.optimizer.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
public class ScoringEngine {

    private final OrderLineRepository orderLineRepo;
    private final SlotRepository slotRepo;
    private final SkuRepository skuRepo;
    private final WarehouseRepository warehouseRepo;

    // ──────────────────────────────────────────────────────────────────────────
    // Analysis window helpers
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Start of the analysis window. Anchored to the warehouse's latest order date
     * (when it is in the past) rather than wall-clock now(), so historical datasets
     * still produce velocity / co-pick / XYZ signal with the default window.
     */
    private Instant windowStart(Long warehouseId, int days) {
        Instant maxTs = orderLineRepo.findMaxOrderTimestamp(warehouseId);
        Instant base = (maxTs != null && maxTs.isBefore(Instant.now())) ? maxTs : Instant.now();
        return base.minus(days, ChronoUnit.DAYS);
    }

    /** Anchor date used for exponential time-decay weighting (matches {@link #windowStart}). */
    private LocalDate windowAnchorDate(Long warehouseId) {
        Instant maxTs = orderLineRepo.findMaxOrderTimestamp(warehouseId);
        Instant base = (maxTs != null && maxTs.isBefore(Instant.now())) ? maxTs : Instant.now();
        return base.atZone(java.time.ZoneOffset.UTC).toLocalDate();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<Long, Double> computeRawCounts(Long warehouseId, int days) {
        Instant since = windowStart(warehouseId, days);
        List<Object[]> rows = orderLineRepo.countOrdersPerSku(warehouseId, since);
        Map<Long, Double> raw = new LinkedHashMap<>();
        for (Object[] row : rows) {
            raw.put(((Number) row[0]).longValue(), ((Number) row[1]).doubleValue());
        }
        return raw;
    }

    @Transactional(readOnly = true)
    public Map<Long, Double> computeVelocity(Long warehouseId, int days) {
        Map<Long, Double> raw = computeRawCounts(warehouseId, days);
        if (raw.isEmpty()) return Map.of();
        double max = raw.values().stream().mapToDouble(Double::doubleValue).max().orElse(1.0);
        if (max == 0) return raw;
        raw.replaceAll((id, v) -> v / max);
        return raw;
    }

    @Transactional(readOnly = true)
    public Map<Long, Double> computeEwVelocity(Long warehouseId, int days, double lambda) {
        Instant since = windowStart(warehouseId, days);
        List<Object[]> rows = orderLineRepo.findDailyOrderCounts(warehouseId, since);
        if (rows.isEmpty()) return computeVelocity(warehouseId, days);

        LocalDate today = windowAnchorDate(warehouseId);
        Map<Long, Double> weighted = new HashMap<>();
        for (Object[] row : rows) {
            Long skuId = ((Number) row[0]).longValue();
            Date sqlDate = (Date) row[1];
            int cnt = ((Number) row[2]).intValue();
            long daysAgo = ChronoUnit.DAYS.between(sqlDate.toLocalDate(), today);
            double weight = Math.exp(-lambda * Math.max(0, daysAgo));
            weighted.merge(skuId, cnt * weight, Double::sum);
        }
        double max = weighted.values().stream().mapToDouble(Double::doubleValue).max().orElse(1.0);
        if (max == 0) return weighted;
        weighted.replaceAll((id, v) -> v / max);
        return weighted;
    }

    public Map<Long, Double> computeAbcClassification(Map<Long, Double> rawCounts) {
        if (rawCounts.isEmpty()) return Map.of();
        double total = rawCounts.values().stream().mapToDouble(Double::doubleValue).sum();
        if (total == 0) return Map.of();
        List<Map.Entry<Long, Double>> sorted = rawCounts.entrySet().stream()
                .sorted(Map.Entry.<Long, Double>comparingByValue().reversed()).toList();
        Map<Long, Double> boost = new LinkedHashMap<>();
        double cumulative = 0;
        for (Map.Entry<Long, Double> e : sorted) {
            cumulative += e.getValue();
            double share = cumulative / total;
            if (share <= 0.80) boost.put(e.getKey(), 1.2);
            else if (share <= 0.95) boost.put(e.getKey(), 1.0);
            else boost.put(e.getKey(), 0.8);
        }
        return boost;
    }

    @Transactional(readOnly = true)
    public Map<Long, Double> computeXyzStability(Long warehouseId, int days) {
        Instant since = windowStart(warehouseId, days);
        List<Object[]> rows = orderLineRepo.findDailyOrderCounts(warehouseId, since);
        if (rows.isEmpty()) return Map.of();
        Map<Long, Map<String, Integer>> weekly = new HashMap<>();
        for (Object[] row : rows) {
            Long skuId = ((Number) row[0]).longValue();
            Date sqlDate = (Date) row[1];
            int cnt = ((Number) row[2]).intValue();
            String week = sqlDate.toLocalDate().toString().substring(0, 4) + "-W" +
                    String.format("%02d", sqlDate.toLocalDate().get(java.time.temporal.WeekFields.ISO.weekOfWeekBasedYear()));
            weekly.computeIfAbsent(skuId, k -> new HashMap<>()).merge(week, cnt, Integer::sum);
        }
        Map<Long, Double> boost = new HashMap<>();
        for (Map.Entry<Long, Map<String, Integer>> e : weekly.entrySet()) {
            List<Integer> counts = new ArrayList<>(e.getValue().values());
            double mean = counts.stream().mapToInt(Integer::intValue).average().orElse(0.0);
            if (mean == 0) { boost.put(e.getKey(), 0.85); continue; }
            double variance = counts.stream().mapToDouble(c -> Math.pow(c - mean, 2)).sum() / counts.size();
            double std = Math.sqrt(variance);
            double cv = std / mean;
            if (cv < 0.5) boost.put(e.getKey(), 1.0);
            else if (cv < 1.0) boost.put(e.getKey(), 0.95);
            else boost.put(e.getKey(), 0.85);
        }
        return boost;
    }

    public Map<Long, Double> computeErgonomics(List<Slot> slots) {
        Map<Long, Double> ergonomics = new HashMap<>();
        for (Slot slot : slots) {
            int level = slot.getLevel();
            double score = switch (level) {
                case 1, 2 -> 1.0;
                case 3 -> 0.7;
                default -> 0.4;
            };
            ergonomics.put(slot.getId(), score);
        }
        return ergonomics;
    }

    @Transactional(readOnly = true)
    public Map<Long, Map<Long, Double>> computeCopickMatrix(Long warehouseId, int days) {
        Instant since = windowStart(warehouseId, days);
        List<Object[]> pairs = orderLineRepo.findCopickPairsRaw(warehouseId, since);
        Map<Long, Map<Long, Integer>> raw = new HashMap<>();
        Map<Long, Integer> maxPerSku = new HashMap<>();
        for (Object[] row : pairs) {
            long skuI = ((Number) row[0]).longValue();
            long skuJ = ((Number) row[1]).longValue();
            int cnt   = ((Number) row[2]).intValue();
            raw.computeIfAbsent(skuI, k -> new HashMap<>()).put(skuJ, cnt);
            raw.computeIfAbsent(skuJ, k -> new HashMap<>()).put(skuI, cnt);
            maxPerSku.merge(skuI, cnt, Math::max);
            maxPerSku.merge(skuJ, cnt, Math::max);
        }
        Map<Long, Map<Long, Double>> result = new HashMap<>();
        raw.forEach((skuId, partners) -> {
            int max = maxPerSku.getOrDefault(skuId, 1);
            Map<Long, Double> norm = new HashMap<>();
            // Keep only the strongest partners — bounds the per-score inner loop so the
            // greedy stays fast even on dense baskets (thousands of SKUs).
            topPartners(partners, COPICK_TOP_K)
                    .forEach((partnerId, cnt) -> norm.put(partnerId, (double) cnt / max));
            result.put(skuId, norm);
        });
        return result;
    }

    /** Cap on co-pick partners kept per SKU (strongest by co-occurrence/lift). */
    private static final int COPICK_TOP_K = 25;

    /** Top-K entries of a partner map by value (descending). */
    private static <V extends Number> Map<Long, V> topPartners(Map<Long, V> partners, int k) {
        if (partners.size() <= k) return partners;
        return partners.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue().doubleValue(), a.getValue().doubleValue()))
                .limit(k)
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new));
    }

    /**
     * Wilson-stabilized, normalized velocity. For each SKU we treat "appears in an
     * order" as a Bernoulli success over all orders and use the Wilson score lower
     * bound, which shrinks noisy estimates from rarely-ordered SKUs. Result is
     * normalized to [0,1] by the max so it slots into the existing formula.
     */
    /** Total distinct orders in the (data-anchored) analysis window — the N for lift/Wilson. */
    @Transactional(readOnly = true)
    public long countOrdersInWindow(Long warehouseId, int days) {
        return orderLineRepo.countOrders(warehouseId, windowStart(warehouseId, days));
    }

    @Transactional(readOnly = true)
    public Map<Long, Double> computeVelocityWilson(Long warehouseId, int days) {
        Instant since = windowStart(warehouseId, days);
        long n = orderLineRepo.countOrders(warehouseId, since);
        if (n <= 0) return Map.of();
        List<Object[]> rows = orderLineRepo.countOrdersPerSku(warehouseId, since);
        Map<Long, Double> wilson = new LinkedHashMap<>();
        for (Object[] row : rows) {
            long skuId = ((Number) row[0]).longValue();
            double cnt = ((Number) row[1]).doubleValue();
            wilson.put(skuId, Statistics.wilsonLowerBound(cnt, n));
        }
        double max = wilson.values().stream().mapToDouble(Double::doubleValue).max().orElse(0.0);
        if (max <= 0) return wilson;
        wilson.replaceAll((id, v) -> v / max);
        return wilson;
    }

    /**
     * Co-pick lift per SKU pair: lift = P(X∩Y)/(P(X)P(Y)). Values &gt;1 mean the two
     * SKUs are ordered together more than chance — the statistically meaningful basis
     * for "store these together", unlike a raw co-occurrence count. Symmetric map.
     */
    @Transactional(readOnly = true)
    public Map<Long, Map<Long, Double>> computeCopickLift(Long warehouseId, int days) {
        Instant since = windowStart(warehouseId, days);
        long n = orderLineRepo.countOrders(warehouseId, since);
        if (n <= 0) return Map.of();
        Map<Long, Double> cnt = computeRawCounts(warehouseId, days);
        List<Object[]> pairs = orderLineRepo.findCopickPairsRaw(warehouseId, since);
        Map<Long, Map<Long, Double>> lift = new HashMap<>();
        for (Object[] row : pairs) {
            long i = ((Number) row[0]).longValue();
            long j = ((Number) row[1]).longValue();
            double pair = ((Number) row[2]).doubleValue();
            double l = Statistics.lift(pair, cnt.getOrDefault(i, 0.0), cnt.getOrDefault(j, 0.0), n);
            lift.computeIfAbsent(i, k -> new HashMap<>()).put(j, l);
            lift.computeIfAbsent(j, k -> new HashMap<>()).put(i, l);
        }
        lift.replaceAll((skuId, partners) -> new HashMap<>(topPartners(partners, COPICK_TOP_K)));
        return lift;
    }

    @Transactional(readOnly = true)
    public Map<Long, Double> computeSlotDistances(Long warehouseId) {
        Warehouse wh = requireWarehouse(warehouseId);
        List<Slot> slots = slotRepo.findByWarehouseId(warehouseId);
        if (slots.isEmpty()) return Map.of();
        int dockRow = wh.getDockX();
        int dockCol = wh.getDockY();
        Map<Long, Double> raw = new HashMap<>();
        for (Slot slot : slots) {
            double dist = Math.abs(slot.getRow() - dockRow) + Math.abs(slot.getCol() - dockCol);
            raw.put(slot.getId(), dist);
        }
        double maxDist = raw.values().stream().mapToDouble(Double::doubleValue).max().orElse(1.0);
        if (maxDist == 0) maxDist = 1.0;
        final double divisor = maxDist;
        raw.replaceAll((id, d) -> 1.0 - d / divisor);
        return raw;
    }

    public double scoreAssignment(Long skuId, Long slotId, ScoringContext ctx) {
        ScoringWeights w = ctx.weights();
        double vel   = ctx.adjustedVelocity(skuId);
        double dist  = ctx.slotDistances().getOrDefault(slotId, 0.0);
        double ergo  = ctx.ergonomics().getOrDefault(slotId, 1.0);
        double copick = copickAffinity(skuId, slotId, ctx);
        double centroid = centroidBias(skuId, slotId, ctx);
        double fit   = fitScore(skuId, slotId, ctx);
        double family = familyAffinity(skuId, slotId, ctx);
        double zonePref = zonePreference(skuId, slotId, ctx);
        double congestion = congestionPenalty(skuId, slotId, ctx);

        return w.w1() * vel * dist * ergo
             + w.w2() * copick * centroid
             + w.w3() * fit
             + ctx.constraints().familyAffinityWeight() * family
             + zonePref
             + congestion;
    }

    @Transactional(readOnly = true)
    public List<Assignment> runGreedyAssignment(Long warehouseId, ScoringWeights weights) {
        return runGreedyAssignment(warehouseId, weights, ScoringConstraints.DEFAULT);
    }

    @Transactional(readOnly = true)
    public List<Assignment> runGreedyAssignment(Long warehouseId, ScoringWeights weights, ScoringConstraints constraints) {
        if (constraints == null) constraints = ScoringConstraints.DEFAULT;
        requireWarehouse(warehouseId);
        List<Sku>  allSkus  = skuRepo.findByWarehouseId(warehouseId);
        List<Slot> allSlots = slotRepo.findByWarehouseId(warehouseId);
        if (allSkus.isEmpty() || allSlots.isEmpty()) {
            throw new ScoringException("Warehouse %d has no SKUs or slots to assign".formatted(warehouseId));
        }
        log.info("Greedy assignment: {} SKUs, {} slots, warehouse={}, weights={}, constraints={}",
                allSkus.size(), allSlots.size(), warehouseId, weights, constraints);

        Map<Long, Double> rawCounts   = computeRawCounts(warehouseId, 90);
        Map<Long, Double> velocity    = computeEwVelocity(warehouseId, 90, weights.decayLambda());
        Map<Long, Double> abcBoost    = weights.useAbcXyz() ? computeAbcClassification(rawCounts) : Map.of();
        Map<Long, Double> xyzBoost    = weights.useAbcXyz() ? computeXyzStability(warehouseId, 90) : Map.of();
        Map<Long, Double> distances   = computeSlotDistances(warehouseId);
        Map<Long, Double> ergonomics  = computeErgonomics(allSlots);
        Map<Long, Map<Long, Double>> copick = computeCopickMatrix(warehouseId, 90);
        Map<Long, Double> velocityWilson  = computeVelocityWilson(warehouseId, 90);
        Map<Long, Map<Long, Double>> copickLift = computeCopickLift(warehouseId, 90);

        Map<Long, Sku>  skuMap  = allSkus.stream().collect(Collectors.toMap(Sku::getId, s -> s));
        Map<Long, Slot> slotMap = allSlots.stream().collect(Collectors.toMap(Slot::getId, s -> s));

        // Capture current layout from DB
        Map<Long, Long> currentAssignments = allSlots.stream()
                .filter(s -> s.getCurrentSku() != null)
                .collect(Collectors.toMap(
                        s -> s.getCurrentSku().getId(),
                        Slot::getId,
                        (a, b) -> a)); // keep first when a SKU occupies multiple slots

        // ── Pass 1: Greedy from scratch (all slots free) ───────────────────────
        Set<Long> occupied = new HashSet<>();
        Map<Long, Long> proposedAssignments = new HashMap<>();

        List<Sku> sorted = new ArrayList<>(allSkus);
        sorted.sort(Comparator
                .comparingDouble((Sku s) -> {
                    double v = velocity.getOrDefault(s.getId(), 0.0);
                    double abc = abcBoost.getOrDefault(s.getId(), 1.0);
                    double xyz = xyzBoost.getOrDefault(s.getId(), 1.0);
                    return v * abc * xyz;
                }).reversed()
                .thenComparing(Sku::getCode));

        for (Sku sku : sorted) {
            ScoringContext ctx = new ScoringContext(
                    velocity, copick, distances, skuMap, slotMap, proposedAssignments, weights,
                    abcBoost, xyzBoost, ergonomics, constraints, copickLift, velocityWilson);

            Long   bestSlotId = null;
            double bestScore  = Double.NEGATIVE_INFINITY;

            for (Slot slot : allSlots) {
                if (occupied.contains(slot.getId())) continue;
                if (!fits(sku, slot)) continue;

                double s = scoreAssignment(sku.getId(), slot.getId(), ctx);
                if (s > bestScore) {
                    bestScore  = s;
                    bestSlotId = slot.getId();
                }
            }

            if (bestSlotId == null) continue;

            proposedAssignments.put(sku.getId(), bestSlotId);
            occupied.add(bestSlotId);
        }

        // ── Pass 2: Build result comparing proposed vs current ─────────────────
        ScoringContext ctxCurrent = new ScoringContext(
                velocity, copick, distances, skuMap, slotMap, currentAssignments, weights,
                abcBoost, xyzBoost, ergonomics, constraints, copickLift, velocityWilson);

        ScoringContext ctxProposed = new ScoringContext(
                velocity, copick, distances, skuMap, slotMap, proposedAssignments, weights,
                abcBoost, xyzBoost, ergonomics, constraints, copickLift, velocityWilson);

        List<Assignment> result = new ArrayList<>();
        for (Sku sku : allSkus) {
            Long proposedSlotId = proposedAssignments.get(sku.getId());
            if (proposedSlotId == null) continue;

            Long currentSlotId = currentAssignments.get(sku.getId());

            double scoreBefore = currentSlotId != null
                    ? scoreAssignment(sku.getId(), currentSlotId, ctxCurrent)
                    : 0.0;
            double scoreAfter  = scoreAssignment(sku.getId(), proposedSlotId, ctxProposed);

            result.add(new Assignment(
                    sku.getId(), sku.getCode(),
                    currentSlotId,
                    currentSlotId != null ? slotMap.get(currentSlotId).getLabel() : null,
                    proposedSlotId,
                    slotMap.get(proposedSlotId).getLabel(),
                    scoreAfter,
                    scoreAfter - scoreBefore
            ));
        }

        long improved = result.stream().filter(a -> a.scoreDelta() > 0.01).count();
        log.info("Greedy assignment complete: {} assignments ({} improved)", result.size(), improved);
        return result;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────────────────

    private double copickAffinity(Long skuId, Long slotId, ScoringContext ctx) {
        Map<Long, Double> partners = ctx.copickMatrix().getOrDefault(skuId, Map.of());
        if (partners.isEmpty()) return 0.0;
        Slot target = ctx.slots().get(slotId);
        if (target == null) return 0.0;
        double total = 0.0;
        int    count = 0;
        for (Map.Entry<Long, Double> e : partners.entrySet()) {
            Long partnerSlotId = ctx.currentAssignments().get(e.getKey());
            if (partnerSlotId == null) continue;
            Slot partnerSlot = ctx.slots().get(partnerSlotId);
            if (partnerSlot == null) continue;
            double dist = Math.abs(target.getRow() - partnerSlot.getRow())
                        + Math.abs(target.getCol() - partnerSlot.getCol());
            total += e.getValue() / (1.0 + dist);
            count++;
        }
        return count > 0 ? total / count : 0.0;
    }

    private double centroidBias(Long skuId, Long slotId, ScoringContext ctx) {
        Map<Long, Double> partners = ctx.copickMatrix().getOrDefault(skuId, Map.of());
        if (partners.isEmpty()) return 0.0;
        Slot target = ctx.slots().get(slotId);
        if (target == null) return 0.0;
        double totalWeight = 0.0;
        double weightedRow = 0.0;
        double weightedCol = 0.0;
        int assignedCount = 0;
        for (Map.Entry<Long, Double> e : partners.entrySet()) {
            Long partnerSlotId = ctx.currentAssignments().get(e.getKey());
            if (partnerSlotId == null) continue;
            Slot partnerSlot = ctx.slots().get(partnerSlotId);
            if (partnerSlot == null) continue;
            weightedRow += partnerSlot.getRow() * e.getValue();
            weightedCol += partnerSlot.getCol() * e.getValue();
            totalWeight += e.getValue();
            assignedCount++;
        }
        if (assignedCount == 0 || totalWeight == 0) return 0.0;
        double centroidRow = weightedRow / totalWeight;
        double centroidCol = weightedCol / totalWeight;
        double dist = Math.abs(target.getRow() - centroidRow) + Math.abs(target.getCol() - centroidCol);
        return 1.0 / (1.0 + dist);
    }

    private double familyAffinity(Long skuId, Long slotId, ScoringContext ctx) {
        if (!ctx.constraints().enableFamilyGrouping()) return 0.0;
        Sku sku = ctx.skus().get(skuId);
        if (sku == null || sku.getCategory() == null) return 0.0;
        String category = sku.getCategory();
        Slot target = ctx.slots().get(slotId);
        if (target == null) return 0.0;
        double total = 0.0;
        int count = 0;
        for (Map.Entry<Long, Long> e : ctx.currentAssignments().entrySet()) {
            Sku otherSku = ctx.skus().get(e.getKey());
            if (otherSku == null || otherSku.getCategory() == null) continue;
            if (!category.equals(otherSku.getCategory())) continue;
            Slot otherSlot = ctx.slots().get(e.getValue());
            if (otherSlot == null) continue;
            double dist = Math.abs(target.getRow() - otherSlot.getRow())
                        + Math.abs(target.getCol() - otherSlot.getCol());
            total += 1.0 / (1.0 + dist);
            count++;
        }
        return count > 0 ? total / count : 0.0;
    }

    private double zonePreference(Long skuId, Long slotId, ScoringContext ctx) {
        Map<String, String> familyToZone = ctx.constraints().familyToZone();
        if (familyToZone.isEmpty()) return 0.0;
        Sku sku = ctx.skus().get(skuId);
        Slot slot = ctx.slots().get(slotId);
        if (sku == null || slot == null || sku.getCategory() == null) return 0.0;
        String preferredZone = familyToZone.get(sku.getCategory());
        if (preferredZone == null) return 0.0;
        return preferredZone.equals(slot.getZone()) ? 0.2 : 0.0;
    }

    private double congestionPenalty(Long skuId, Long slotId, ScoringContext ctx) {
        int maxA = ctx.constraints().maxAClassPerZone();
        if (maxA <= 0) return 0.0;
        double abcBoost = ctx.abcBoost().getOrDefault(skuId, 1.0);
        if (abcBoost < 1.2) return 0.0;
        Slot slot = ctx.slots().get(slotId);
        if (slot == null || slot.getZone() == null) return 0.0;
        String zone = slot.getZone();
        long aClassInZone = ctx.currentAssignments().entrySet().stream()
                .filter(e -> {
                    Slot s = ctx.slots().get(e.getValue());
                    return s != null && zone.equals(s.getZone())
                            && ctx.abcBoost().getOrDefault(e.getKey(), 1.0) >= 1.2;
                })
                .count();
        if (aClassInZone >= maxA) {
            return -ctx.constraints().congestionPenalty();
        }
        return 0.0;
    }

    private double fitScore(Long skuId, Long slotId, ScoringContext ctx) {
        Sku  sku  = ctx.skus().get(skuId);
        Slot slot = ctx.slots().get(slotId);
        if (sku == null || slot == null) return 0.0;
        double weightRatio = sku.getWeightKg().doubleValue() / slot.getCapacityKg().doubleValue();
        if (weightRatio > 1.0) return 0.0;
        double weightFit = 1.0 - weightRatio * 0.5;
        double cubeFit = 1.0;
        if (sku.getVolumeM3() != null && slot.getVolumeM3() != null && slot.getVolumeM3().doubleValue() > 0) {
            double cubeRatio = sku.getVolumeM3().doubleValue() / slot.getVolumeM3().doubleValue();
            if (cubeRatio > 1.0) return 0.0;
            cubeFit = 1.0 - cubeRatio * 0.3;
        }
        return weightFit * 0.6 + cubeFit * 0.4;
    }

    private boolean fits(Sku sku, Slot slot) {
        boolean weightOk = sku.getWeightKg().compareTo(slot.getCapacityKg()) <= 0;
        boolean cubeOk = true;
        if (sku.getVolumeM3() != null && slot.getVolumeM3() != null) {
            cubeOk = sku.getVolumeM3().compareTo(slot.getVolumeM3()) <= 0;
        }
        return weightOk && cubeOk;
    }

    private Warehouse requireWarehouse(Long warehouseId) {
        return warehouseRepo.findById(warehouseId)
                .orElseThrow(() -> new com.warehouse.optimizer.exception.NotFoundException("Warehouse not found: " + warehouseId));
    }
}
