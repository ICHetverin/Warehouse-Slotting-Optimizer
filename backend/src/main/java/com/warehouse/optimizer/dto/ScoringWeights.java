package com.warehouse.optimizer.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * w1 — velocity × distance component weight
 * w2 — co-pick affinity component weight
 * w3 — physical fit component weight
 * Weights need not sum to 1; the scoring formula uses them as multiplicative coefficients.
 */
public record ScoringWeights(double w1, double w2, double w3) {

    public static final ScoringWeights DEFAULT = new ScoringWeights(0.5, 0.35, 0.15);

    @JsonCreator
    public ScoringWeights(
            @JsonProperty("w1") double w1,
            @JsonProperty("w2") double w2,
            @JsonProperty("w3") double w3) {
        if (w1 < 0 || w2 < 0 || w3 < 0) {
            throw new IllegalArgumentException("Weights must be non-negative");
        }
        this.w1 = w1;
        this.w2 = w2;
        this.w3 = w3;
    }
}
