package com.warehouse.optimizer.dto;

import java.util.Map;

/**
 * Statistical validation result for a scoring run.
 *
 * @param forecastMape            MAPE of velocity forecast on A-class SKUs (lower is better)
 * @param placementStabilityPct   percentage of assignments with low relocation risk
 * @param routeEfficiencyGainPct  estimated route distance reduction vs current layout
 * @param detail                  breakdown by ABC class and other dimensions
 */
public record ScoringValidation(
        double forecastMape,
        double placementStabilityPct,
        double routeEfficiencyGainPct,
        Map<String, Double> detail
) {}
