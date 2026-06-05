package com.warehouse.optimizer.dto;

import java.util.Map;

/**
 * Statistical validation result for a scoring run.
 *
 * @param forecastMape             MAPE of velocity forecast on A-class SKUs (legacy, kept for reference)
 * @param forecastWape             WAPE of velocity forecast (primary; robust to zero/rare demand)
 * @param placementStabilityPct    percentage of assignments with low relocation risk
 * @param routeEfficiencyGainPct   estimated route distance reduction vs current layout
 * @param routeEfficiencyCiLowPct  lower bound of bootstrap CI on route-efficiency gain
 * @param routeEfficiencyCiHighPct upper bound of bootstrap CI on route-efficiency gain
 * @param detail                   breakdown by ABC class and other dimensions
 */
public record ScoringValidation(
        double forecastMape,
        double forecastWape,
        double placementStabilityPct,
        double routeEfficiencyGainPct,
        double routeEfficiencyCiLowPct,
        double routeEfficiencyCiHighPct,
        Map<String, Double> detail
) {
    /** Back-compat constructor (no WAPE / CI). */
    public ScoringValidation(
            double forecastMape, double placementStabilityPct, double routeEfficiencyGainPct,
            Map<String, Double> detail) {
        this(forecastMape, forecastMape, placementStabilityPct, routeEfficiencyGainPct,
             routeEfficiencyGainPct, routeEfficiencyGainPct, detail);
    }
}
