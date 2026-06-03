package com.warehouse.optimizer.engine;

import com.warehouse.optimizer.dto.Assignment;
import com.warehouse.optimizer.dto.ScoringValidation;
import com.warehouse.optimizer.dto.ScoringWeights;
import com.warehouse.optimizer.dto.TuningRequest;
import com.warehouse.optimizer.dto.TuningResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Auto-tuning engine: grid-search over w1/w2/w3 weight combinations.
 *
 * <p>For each weight triple the engine runs greedy assignment + validation,
 * then picks the combination that maximises the chosen metric.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AutoTuningEngine {

    private final ScoringEngine      scoringEngine;
    private final ValidationEngine   validationEngine;

    /**
     * Grid-search over weight combinations.
     *
     * @param req tuning parameters
     * @return best weights + full score grid
     */
    public TuningResult tune(TuningRequest req) {
        Long warehouseId = req.warehouseId();
        double step = req.gridStep();
        String metric = req.metricToOpt().toLowerCase();
        int days = req.sampleDays();

        log.info("Auto-tuning started: warehouse={}, step={}, metric={}", warehouseId, step, metric);

        List<ScoringWeights> candidates = generateGrid(step);
        List<Map<String, Object>> scoreGrid = new ArrayList<>();

        ScoringWeights bestWeights = null;
        double bestMetric = metric.contains("efficiency") ? Double.NEGATIVE_INFINITY : Double.NEGATIVE_INFINITY;

        // Baseline with default weights
        double baselineMetric = evaluate(warehouseId, ScoringWeights.DEFAULT, metric, days);
        log.info("Baseline metric with DEFAULT weights: {}", baselineMetric);

        for (ScoringWeights w : candidates) {
            try {
                double val = evaluate(warehouseId, w, metric, days);
                Map<String, Object> point = new LinkedHashMap<>();
                point.put("w1", w.w1());
                point.put("w2", w.w2());
                point.put("w3", w.w3());
                point.put("metric", Math.round(val * 100) / 100.0);
                scoreGrid.add(point);

                if (val > bestMetric) {
                    bestMetric = val;
                    bestWeights = w;
                }
            } catch (Exception e) {
                log.warn("Evaluation failed for weights {}: {}", w, e.getMessage());
            }
        }

        double improvement = baselineMetric != 0
                ? (bestMetric - baselineMetric) / Math.abs(baselineMetric) * 100.0
                : 0.0;

        log.info("Auto-tuning complete: best={}, metric={}, improvement={}%",
                bestWeights, Math.round(bestMetric * 100) / 100.0, Math.round(improvement * 10) / 10.0);

        return new TuningResult(
                warehouseId,
                bestWeights != null ? bestWeights : ScoringWeights.DEFAULT,
                Math.round(bestMetric * 100) / 100.0,
                metric,
                step,
                scoreGrid.size(),
                scoreGrid,
                Math.round(baselineMetric * 100) / 100.0,
                Math.round(improvement * 10) / 10.0
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────────────────

    /** Generates all weight triples on a regular grid with sum = 1.0. */
    private List<ScoringWeights> generateGrid(double step) {
        List<ScoringWeights> list = new ArrayList<>();
        int n = (int) Math.round(1.0 / step);
        for (int i = 0; i <= n; i++) {
            for (int j = 0; j <= n - i; j++) {
                double w1 = i * step;
                double w2 = j * step;
                double w3 = 1.0 - w1 - w2;
                if (w3 < -1e-9) continue;
                w3 = Math.max(0.0, w3); // fix fp rounding
                // Round to avoid long decimals
                w1 = Math.round(w1 * 100) / 100.0;
                w2 = Math.round(w2 * 100) / 100.0;
                w3 = Math.round(w3 * 100) / 100.0;
                list.add(new ScoringWeights(w1, w2, w3, ScoringWeights.DEFAULT.decayLambda(), ScoringWeights.DEFAULT.useAbcXyz()));
            }
        }
        return list;
    }

    /** Runs greedy assignment + validation and extracts the requested metric. */
    private double evaluate(Long warehouseId, ScoringWeights weights, String metric, int days) {
        List<Assignment> assignments = scoringEngine.runGreedyAssignment(warehouseId, weights);

        Map<Long, Double> velocity   = scoringEngine.computeEwVelocity(warehouseId, days, weights.decayLambda());
        Map<Long, Map<Long, Double>> copick = scoringEngine.computeCopickMatrix(warehouseId, days);
        Map<Long, Double> distances  = scoringEngine.computeSlotDistances(warehouseId);
        Map<Long, Double> rawCounts  = scoringEngine.computeRawCounts(warehouseId, days);
        Map<Long, Double> abcBoost   = weights.useAbcXyz() ? scoringEngine.computeAbcClassification(rawCounts) : Collections.emptyMap();
        Map<Long, Double> xyzBoost   = weights.useAbcXyz() ? scoringEngine.computeXyzStability(warehouseId, days) : Collections.emptyMap();

        Map<Long, com.warehouse.optimizer.model.Sku> skuMap = Collections.emptyMap();
        Map<Long, com.warehouse.optimizer.model.Slot> slotMap = Collections.emptyMap();
        Map<Long, Long> assignmentMap = assignments.stream()
                .collect(java.util.stream.Collectors.toMap(Assignment::skuId, Assignment::toSlotId));

        ScoringContext ctx = new ScoringContext(
                velocity, copick, distances, skuMap, slotMap, assignmentMap,
                weights, abcBoost, xyzBoost, Collections.emptyMap());

        ScoringValidation validation = validationEngine.validate(warehouseId, assignments, ctx);

        return switch (metric) {
            case "route", "route_efficiency", "routeefficiency", "route_efficiency_gain",
                 "efficiency", "distance" -> validation.routeEfficiencyGainPct();
            case "stability", "placement_stability" -> validation.placementStabilityPct();
            case "composite", "combined" ->
                    validation.routeEfficiencyGainPct() * 0.6
                  + validation.placementStabilityPct() * 0.3
                  - validation.forecastMape() * 0.1;
            default -> validation.routeEfficiencyGainPct();
        };
    }
}
