package com.warehouse.optimizer.dto;

import java.util.List;
import java.util.Map;

/**
 * Result of auto-tuning scoring weights via grid search.
 *
 * @param warehouseId       target warehouse
 * @param bestWeights       optimal weight combination
 * @param bestMetricValue   best achieved metric value
 * @param metricName        name of the optimised metric
 * @param gridStep          step size used
 * @param evaluations       number of weight combinations evaluated
 * @param scoreGrid         list of evaluated points {w1, w2, w3, metricValue}
 * @param baselineValue     metric value with DEFAULT weights
 * @param improvementPct    improvement over baseline (%)
 */
public record TuningResult(
        Long warehouseId,
        ScoringWeights bestWeights,
        double bestMetricValue,
        String metricName,
        double gridStep,
        int evaluations,
        List<Map<String, Object>> scoreGrid,
        double baselineValue,
        double improvementPct
) {}
