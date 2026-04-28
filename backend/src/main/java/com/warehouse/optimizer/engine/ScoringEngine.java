package com.warehouse.optimizer.engine;

import com.warehouse.optimizer.dto.Assignment;
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

import java.time.Instant;
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
    // Public API
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Velocity: fraction of orders (last {@code days} days) that include each SKU,
     * normalized to [0, 1] against the most-ordered SKU.
     */
    @Transactional(readOnly = true)
    public Map<Long, Double> computeVelocity(Long warehouseId, int days) {
        Instant since = Instant.now().minus(days, ChronoUnit.DAYS);
        List<Object[]> rows = orderLineRepo.countOrdersPerSku(warehouseId, since);

        if (rows.isEmpty()) return Map.of();

        Map<Long, Double> raw = new LinkedHashMap<>();
        for (Object[] row : rows) {
            raw.put(((Number) row[0]).longValue(), ((Number) row[1]).doubleValue());
        }

        double max = raw.values().stream().mapToDouble(Double::doubleValue).max().orElse(1.0);
        if (max == 0) return raw;
        raw.replaceAll((id, v) -> v / max);
        return raw;
    }

    /**
     * Co-pick affinity matrix: for each pair of SKUs that appear together in orders,
     * the normalized joint-order frequency. Symmetric: matrix[i][j] == matrix[j][i].
     *
     * <p>Normalization per SKU: score[i][j] = count(i,j) / max_count(i,*)
     * — so the value represents how strongly j is coupled to i relative to
     * i's strongest coupling partner.
     */
    @Transactional(readOnly = true)
    public Map<Long, Map<Long, Double>> computeCopickMatrix(Long warehouseId, int days) {
        Instant since = Instant.now().minus(days, ChronoUnit.DAYS);
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
            partners.forEach((partnerId, cnt) -> norm.put(partnerId, (double) cnt / max));
            result.put(skuId, norm);
        });
        return result;
    }

    /**
     * Distance score per slot: Manhattan distance from slot to dock, inverted and
     * normalized to [0, 1] so that 1.0 = at the dock, 0.0 = furthest slot.
     */
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

    /**
     * Composite score for placing {@code skuId} in {@code slotId} given a pre-built context.
     *
     * <pre>
     * score = w1 * velocity[sku] * distance[slot]
     *       + w2 * copickAffinity(sku, slot)
     *       + w3 * fitScore(sku, slot)
     * </pre>
     */
    public double scoreAssignment(Long skuId, Long slotId, ScoringContext ctx) {
        ScoringWeights w = ctx.weights();
        double vel   = ctx.velocity().getOrDefault(skuId, 0.0);
        double dist  = ctx.slotDistances().getOrDefault(slotId, 0.0);
        double copick = copickAffinity(skuId, slotId, ctx);
        double fit   = fitScore(skuId, slotId, ctx);

        return w.w1() * vel * dist
             + w.w2() * copick
             + w.w3() * fit;
    }

    /**
     * Greedy assignment: sorts SKUs by velocity desc, then for each SKU picks the
     * highest-scoring free slot (SKU weight must not exceed slot capacity).
     * Co-pick affinity is computed in real-time as assignments accumulate.
     *
     * <p>Returns only SKUs for which a slot was found.
     */
    @Transactional(readOnly = true)
    public List<Assignment> runGreedyAssignment(Long warehouseId, ScoringWeights weights) {
        requireWarehouse(warehouseId);

        List<Sku>  allSkus  = skuRepo.findByWarehouseId(warehouseId);
        List<Slot> allSlots = slotRepo.findByWarehouseId(warehouseId);

        if (allSkus.isEmpty() || allSlots.isEmpty()) {
            throw new ScoringException("Warehouse %d has no SKUs or slots to assign".formatted(warehouseId));
        }

        log.info("Greedy assignment: {} SKUs, {} slots, warehouse={}", allSkus.size(), allSlots.size(), warehouseId);

        Map<Long, Double>              velocity  = computeVelocity(warehouseId, 90);
        Map<Long, Map<Long, Double>>   copick    = computeCopickMatrix(warehouseId, 90);
        Map<Long, Double>              distances = computeSlotDistances(warehouseId);

        Map<Long, Sku>  skuMap  = allSkus.stream().collect(Collectors.toMap(Sku::getId, s -> s));
        Map<Long, Slot> slotMap = allSlots.stream().collect(Collectors.toMap(Slot::getId, s -> s));

        // Pre-mark slots that already have a SKU as occupied
        Set<Long> occupied = allSlots.stream()
                .filter(s -> !s.isEmpty())
                .map(Slot::getId)
                .collect(Collectors.toCollection(HashSet::new));

        // skuId → currently-assigned slotId (grows during the loop)
        Map<Long, Long> assignments = new HashMap<>();

        // Sort by velocity desc; ties broken alphabetically for determinism
        List<Sku> sorted = new ArrayList<>(allSkus);
        sorted.sort(Comparator
                .comparingDouble((Sku s) -> velocity.getOrDefault(s.getId(), 0.0)).reversed()
                .thenComparing(Sku::getCode));

        List<Assignment> result = new ArrayList<>();

        for (Sku sku : sorted) {
            ScoringContext ctx = new ScoringContext(
                    velocity, copick, distances, skuMap, slotMap, assignments, weights);

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

            // Locate SKU's current slot for delta computation
            Slot fromSlot = allSlots.stream()
                    .filter(s -> sku.equals(s.getCurrentSku()))
                    .findFirst().orElse(null);

            double scoreBefore = fromSlot != null
                    ? scoreAssignment(sku.getId(), fromSlot.getId(), ctx)
                    : 0.0;

            assignments.put(sku.getId(), bestSlotId);
            occupied.add(bestSlotId);

            result.add(new Assignment(
                    sku.getId(), sku.getCode(),
                    fromSlot != null ? fromSlot.getId()    : null,
                    fromSlot != null ? fromSlot.getLabel() : null,
                    bestSlotId,
                    slotMap.get(bestSlotId).getLabel(),
                    bestScore,
                    bestScore - scoreBefore
            ));
        }

        log.info("Greedy assignment complete: {} assignments", result.size());
        return result;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Average proximity-weighted copick score across already-assigned copick partners.
     * Proximity bonus: 1 / (1 + manhattan_distance_in_slots).
     */
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

    /**
     * Physical-fit score in [0, 1]: 1.0 when empty slot, scales down as weight fills capacity,
     * 0.0 when SKU exceeds capacity.
     */
    private double fitScore(Long skuId, Long slotId, ScoringContext ctx) {
        Sku  sku  = ctx.skus().get(skuId);
        Slot slot = ctx.slots().get(slotId);
        if (sku == null || slot == null) return 0.0;

        double ratio = sku.getWeightKg().doubleValue() / slot.getCapacityKg().doubleValue();
        return ratio <= 1.0 ? 1.0 - ratio * 0.5 : 0.0;
    }

    private boolean fits(Sku sku, Slot slot) {
        return sku.getWeightKg().compareTo(slot.getCapacityKg()) <= 0;
    }

    private Warehouse requireWarehouse(Long warehouseId) {
        return warehouseRepo.findById(warehouseId)
                .orElseThrow(() -> new ScoringException("Warehouse not found: " + warehouseId));
    }
}
