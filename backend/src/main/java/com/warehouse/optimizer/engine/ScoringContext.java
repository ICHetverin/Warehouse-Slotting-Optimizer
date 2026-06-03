package com.warehouse.optimizer.engine;

import com.warehouse.optimizer.dto.ScoringConstraints;
import com.warehouse.optimizer.dto.ScoringWeights;
import com.warehouse.optimizer.model.Sku;
import com.warehouse.optimizer.model.Slot;

import java.util.Map;

/**
 * Pre-computed, read-only scoring data passed to every score calculation.
 * Built once per greedy-assignment run to avoid repeated DB calls.
 *
 * @param velocity          normalized [0,1] raw order velocity per SKU id
 * @param copickMatrix      copick affinity: skuId → {partnerSkuId → normalizedScore}
 * @param slotDistances     normalized [0,1] distance score per slot id (1 = closest to dock)
 * @param skus              SKU lookup by id
 * @param slots             Slot lookup by id
 * @param currentAssignments skuId → assigned slotId (grows during greedy loop)
 * @param weights           scoring component weights
 * @param abcBoost          ABC-class multiplier per SKU id (A=1.2, B=1.0, C=0.8)
 * @param xyzBoost          XYZ-stability multiplier per SKU id (X=1.0, Y=0.95, Z=0.85)
 * @param ergonomics        ergonomic score per slot id (Golden Zone factor)
 * @param constraints       optional family grouping / congestion constraints
 */
public record ScoringContext(
        Map<Long, Double> velocity,
        Map<Long, Map<Long, Double>> copickMatrix,
        Map<Long, Double> slotDistances,
        Map<Long, Sku> skus,
        Map<Long, Slot> slots,
        Map<Long, Long> currentAssignments,
        ScoringWeights weights,
        Map<Long, Double> abcBoost,
        Map<Long, Double> xyzBoost,
        Map<Long, Double> ergonomics,
        ScoringConstraints constraints
) {

    /**
     * Adjusted velocity = raw velocity × ABC boost × XYZ boost.
     * Used in the composite scoring formula.
     */
    public double adjustedVelocity(Long skuId) {
        double v = velocity.getOrDefault(skuId, 0.0);
        double abc = abcBoost.getOrDefault(skuId, 1.0);
        double xyz = xyzBoost.getOrDefault(skuId, 1.0);
        return v * abc * xyz;
    }

    /**
     * Convenience constructor for backward compatibility (no constraints).
     */
    public ScoringContext(
            Map<Long, Double> velocity,
            Map<Long, Map<Long, Double>> copickMatrix,
            Map<Long, Double> slotDistances,
            Map<Long, Sku> skus,
            Map<Long, Slot> slots,
            Map<Long, Long> currentAssignments,
            ScoringWeights weights,
            Map<Long, Double> abcBoost,
            Map<Long, Double> xyzBoost,
            Map<Long, Double> ergonomics) {
        this(velocity, copickMatrix, slotDistances, skus, slots, currentAssignments,
             weights, abcBoost, xyzBoost, ergonomics, ScoringConstraints.DEFAULT);
    }
}
