package com.warehouse.optimizer.dto;

import java.time.Instant;
import java.util.List;

public record ScoringRunResponse(
        String jobId,
        Long warehouseId,
        ScoringWeights weightsUsed,
        int velocityDays,
        int totalAssignments,
        int improved,
        List<Assignment> assignments,
        ScoringValidation validation,
        Instant computedAt
) {}
