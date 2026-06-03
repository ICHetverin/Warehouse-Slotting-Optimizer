package com.warehouse.optimizer.dto;

/**
 * Request to auto-tune scoring weights via grid search.
 *
 * @param warehouseId    target warehouse
 * @param gridStep       step size for w1/w2/w3 grid (default 0.1)
 * @param metricToOpt    metric to maximise: "routeEfficiency" | "stability" | "composite"
 * @param sampleDays     historical days for velocity/copick (default 90)
 */
public record TuningRequest(
        Long warehouseId,
        Double gridStep,
        String metricToOpt,
        Integer sampleDays
) {
    public TuningRequest {
        if (gridStep == null) gridStep = 0.1;
        if (metricToOpt == null || metricToOpt.isBlank()) metricToOpt = "routeEfficiency";
        if (sampleDays == null) sampleDays = 90;
    }
}
