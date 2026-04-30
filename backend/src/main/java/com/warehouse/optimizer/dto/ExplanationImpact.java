package com.warehouse.optimizer.dto;

public record ExplanationImpact(
        double avgRouteSavingsM,
        int dailyPicksAffected,
        double estimatedDailySavingsMin
) {}
