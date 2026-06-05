package com.warehouse.optimizer.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * w1 — velocity × distance × ergonomics component weight
 * w2 — co-pick affinity × centroid component weight
 * w3 — physical fit (weight + cube) component weight
 * decayLambda — exponential decay for EW-velocity (default 0.03)
 * useAbcXyz — enable ABC/XYZ statistical classification
 * Weights need not sum to 1; the scoring formula uses them as multiplicative coefficients.
 */
public record ScoringWeights(double w1, double w2, double w3, double decayLambda, boolean useAbcXyz) {

    public static final ScoringWeights DEFAULT = new ScoringWeights(0.5, 0.35, 0.15, 0.03, true);

    @JsonCreator
    public ScoringWeights(
            @JsonProperty("w1") double w1,
            @JsonProperty("w2") double w2,
            @JsonProperty("w3") double w3,
            @JsonProperty("decayLambda") Double decayLambda,
            @JsonProperty("useAbcXyz") Boolean useAbcXyz) {
        this(w1, w2, w3,
             decayLambda != null ? decayLambda : 0.03,
             useAbcXyz != null ? useAbcXyz : true);
    }

    public ScoringWeights {
        if (w1 < 0 || w2 < 0 || w3 < 0) {
            throw new IllegalArgumentException("Weights must be non-negative");
        }
    }
}
