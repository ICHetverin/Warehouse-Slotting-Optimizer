package com.warehouse.optimizer.dto;

/**
 * Result of placing one SKU into one slot during greedy assignment.
 *
 * @param skuId      internal SKU id
 * @param skuCode    human-readable SKU code
 * @param fromSlotId current slot id (null if SKU was unplaced)
 * @param fromLabel  current slot label (null if unplaced)
 * @param toSlotId   recommended slot id
 * @param toLabel    recommended slot label
 * @param score      composite score for the recommended slot
 * @param scoreDelta score(toSlot) − score(fromSlot); positive means improvement
 */
public record Assignment(
        Long skuId,
        String skuCode,
        Long fromSlotId,
        String fromLabel,
        Long toSlotId,
        String toLabel,
        double score,
        double scoreDelta
) {}
