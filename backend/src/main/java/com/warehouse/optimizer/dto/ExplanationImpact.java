package com.warehouse.optimizer.dto;

/**
 * Estimated business impact of a recommended move.
 *
 * @param avgRouteSavingsM         estimated metres saved per affected pick
 * @param dailyPicksAffected       estimated picks per day touching this SKU
 * @param estimatedDailySavingsMin estimated walking-time saved per day, minutes
 * @param savingsCiLowM            lower bound of bootstrap CI on per-pick saving (nullable)
 * @param savingsCiHighM           upper bound of bootstrap CI on per-pick saving (nullable)
 */
public record ExplanationImpact(
        double avgRouteSavingsM,
        int dailyPicksAffected,
        double estimatedDailySavingsMin,
        Double savingsCiLowM,
        Double savingsCiHighM
) {
    /** Back-compat constructor without confidence interval. */
    public ExplanationImpact(double avgRouteSavingsM, int dailyPicksAffected, double estimatedDailySavingsMin) {
        this(avgRouteSavingsM, dailyPicksAffected, estimatedDailySavingsMin, null, null);
    }

    public ExplanationImpact withCI(Double low, Double high) {
        return new ExplanationImpact(avgRouteSavingsM, dailyPicksAffected, estimatedDailySavingsMin, low, high);
    }
}
