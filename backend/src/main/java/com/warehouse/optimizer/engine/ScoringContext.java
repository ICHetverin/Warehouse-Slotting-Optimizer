package com.warehouse.optimizer.engine;

import com.warehouse.optimizer.dto.ScoringWeights;
import com.warehouse.optimizer.model.Sku;
import com.warehouse.optimizer.model.Slot;

import java.util.Map;

/**
 * Pre-computed, read-only scoring data passed to every score calculation.
 * Built once per greedy-assignment run to avoid repeated DB calls.
 *
 * @param velocity          normalized [0,1] order velocity per SKU id
 * @param copickMatrix      copick affinity: skuId → {partnerSkuId → normalizedScore}
 * @param slotDistances     normalized [0,1] distance score per slot id (1 = closest to dock)
 * @param skus              SKU lookup by id
 * @param slots             Slot lookup by id
 * @param currentAssignments skuId → assigned slotId (grows during greedy loop)
 * @param weights           scoring component weights
 */
public record ScoringContext(
        Map<Long, Double> velocity,
        Map<Long, Map<Long, Double>> copickMatrix,
        Map<Long, Double> slotDistances,
        Map<Long, Sku> skus,
        Map<Long, Slot> slots,
        Map<Long, Long> currentAssignments,
        ScoringWeights weights
) {}
