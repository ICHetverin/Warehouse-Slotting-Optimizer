package com.warehouse.optimizer.dto;

import java.util.List;

/**
 * Structured, human-readable explanation for a recommended SKU move, plus the
 * statistical evidence that makes it a *significant* recommendation rather than
 * a top-N heuristic.
 *
 * @param pValue      significance p-value (demand / co-pick), nullable
 * @param qValue      Benjamini-Hochberg adjusted q-value, nullable
 * @param liftMax     strongest co-pick lift with an already-placed partner, nullable
 * @param significant whether this move passed the FDR significance gate, nullable
 */
public record ExplanationDetail(
        String skuCode,
        String fromSlot,
        String toSlot,
        double scoreBefore,
        double scoreAfter,
        List<ExplanationReason> reasons,
        ExplanationImpact impact,
        Double pValue,
        Double qValue,
        Double liftMax,
        Boolean significant
) {
    /** Back-compat constructor without statistical fields (filled later by the gate). */
    public ExplanationDetail(
            String skuCode, String fromSlot, String toSlot,
            double scoreBefore, double scoreAfter,
            List<ExplanationReason> reasons, ExplanationImpact impact) {
        this(skuCode, fromSlot, toSlot, scoreBefore, scoreAfter, reasons, impact, null, null, null, null);
    }

    /** Return a copy carrying the gate's significance verdict and CI-enriched impact. */
    public ExplanationDetail withStats(
            ExplanationImpact impact, Double pValue, Double qValue, Double liftMax, Boolean significant) {
        return new ExplanationDetail(
                skuCode, fromSlot, toSlot, scoreBefore, scoreAfter, reasons, impact,
                pValue, qValue, liftMax, significant);
    }
}
