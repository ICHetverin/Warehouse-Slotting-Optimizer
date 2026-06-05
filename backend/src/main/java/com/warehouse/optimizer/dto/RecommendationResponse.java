package com.warehouse.optimizer.dto;

import java.time.Instant;

public record RecommendationResponse(
        Long id,
        Long warehouseId,
        Long skuId,
        String skuCode,
        String fromSlot,
        String toSlot,
        double scoreDelta,
        String status,
        ExplanationDetail explanation,
        Instant createdAt,
        Instant decidedAt
) {}
