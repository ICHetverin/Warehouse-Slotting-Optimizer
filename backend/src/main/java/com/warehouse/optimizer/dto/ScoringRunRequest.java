package com.warehouse.optimizer.dto;

import jakarta.validation.constraints.NotNull;

public record ScoringRunRequest(
        @NotNull Long warehouseId,
        ScoringWeights weights,
        Integer velocityDays
) {
    public ScoringRunRequest {
        if (weights == null) weights = ScoringWeights.DEFAULT;
        if (velocityDays == null || velocityDays <= 0) velocityDays = 90;
    }
}
