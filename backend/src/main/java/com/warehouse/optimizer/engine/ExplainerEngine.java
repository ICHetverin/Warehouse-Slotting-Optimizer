package com.warehouse.optimizer.engine;

import com.warehouse.optimizer.dto.*;
import com.warehouse.optimizer.model.Sku;
import com.warehouse.optimizer.model.Slot;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@Slf4j
public class ExplainerEngine {

    private static final double WALKING_SPEED_M_PER_MIN = 60.0;
    private static final double PICKS_PER_DAY_ESTIMATE  = 200.0;

    /**
     * Builds a structured explanation for moving {@code sku} from {@code fromSlot}
     * to {@code toSlot} given the current scoring context.
     *
     * @param fromSlot null if the SKU was previously unplaced
     */
    public ExplanationDetail explain(
            Sku sku, Slot fromSlot, Slot toSlot, ScoringContext ctx) {

        double scoreBefore = fromSlot != null
                ? computeScore(sku.getId(), fromSlot.getId(), ctx)
                : 0.0;
        double scoreAfter = computeScore(sku.getId(), toSlot.getId(), ctx);

        List<ExplanationReason> reasons = buildReasons(sku, fromSlot, toSlot, ctx);
        ExplanationImpact impact = estimateImpact(sku, fromSlot, toSlot, ctx, scoreAfter - scoreBefore);

        return new ExplanationDetail(
                sku.getCode(),
                fromSlot != null ? fromSlot.getLabel() : "unplaced",
                toSlot.getLabel(),
                scoreBefore,
                scoreAfter,
                reasons,
                impact
        );
    }

    // ──────────────────────────────────────────────────────────────────────────

    /** Fraction of SKUs (0..100) whose velocity is ≤ this SKU's — a demand percentile. */
    private double velocityPercentile(Long skuId, ScoringContext ctx) {
        Map<Long, Double> v = ctx.velocity();
        if (v.isEmpty()) return 0.0;
        double mine = v.getOrDefault(skuId, 0.0);
        long le = v.values().stream().filter(x -> x <= mine).count();
        return le * 100.0 / v.size();
    }

    private List<ExplanationReason> buildReasons(
            Sku sku, Slot fromSlot, Slot toSlot, ScoringContext ctx) {

        List<ExplanationReason> reasons = new ArrayList<>();
        ScoringWeights w = ctx.weights();

        // Velocity × Distance × Ergonomics component
        double velFrom = fromSlot != null
                ? ctx.adjustedVelocity(sku.getId())
                  * ctx.slotDistances().getOrDefault(fromSlot.getId(), 0.0)
                  * ctx.ergonomics().getOrDefault(fromSlot.getId(), 1.0)
                : 0.0;
        double velTo   = ctx.adjustedVelocity(sku.getId())
                       * ctx.slotDistances().getOrDefault(toSlot.getId(), 0.0)
                       * ctx.ergonomics().getOrDefault(toSlot.getId(), 1.0);
        double velGain = (velTo - velFrom) * w.w1();

        if (velGain > 0.01) {
            double velocityPct = ctx.velocity().getOrDefault(sku.getId(), 0.0) * 100;
            double distScore   = ctx.slotDistances().getOrDefault(toSlot.getId(), 0.0);
            double ergoScore   = ctx.ergonomics().getOrDefault(toSlot.getId(), 1.0);
            double abcBoost    = ctx.abcBoost().getOrDefault(sku.getId(), 1.0);
            double xyzBoost    = ctx.xyzBoost().getOrDefault(sku.getId(), 1.0);

            double percentile = velocityPercentile(sku.getId(), ctx);
            double wilson     = ctx.velocityWilson().getOrDefault(sku.getId(),
                                    ctx.velocity().getOrDefault(sku.getId(), 0.0));

            StringBuilder sb = new StringBuilder();
            sb.append("Высокий спрос: топ %.0f%% по velocity (Wilson-устойчивая %.2f, ABC/XYZ %.2f×) — выгоднее в ячейке ближе к доку (близость %.2f)"
                    .formatted(100 - percentile, wilson, abcBoost * xyzBoost, distScore));
            if (ergoScore < 1.0) {
                sb.append(", эргономический штраф %.0f%%".formatted(ergoScore * 100));
            }

            reasons.add(new ExplanationReason(
                    "velocity",
                    sb.toString(),
                    velTo,
                    Map.of(
                            "velocityPct",        Math.round(velocityPct * 10) / 10.0,
                            "velocityPercentile", Math.round((100 - percentile) * 10) / 10.0,
                            "wilsonVelocity",     Math.round(wilson * 1000) / 1000.0,
                            "abcBoost",           Math.round(abcBoost * 100) / 100.0,
                            "xyzBoost",           Math.round(xyzBoost * 100) / 100.0,
                            "fromProximity",      fromSlot != null
                                    ? ctx.slotDistances().getOrDefault(fromSlot.getId(), 0.0) : 0.0,
                            "toProximity",        distScore,
                            "ergonomics",         Math.round(ergoScore * 100) / 100.0
                    )
            ));
        }

        // Co-pick component
        Map<Long, Double> partners = ctx.copickMatrix().getOrDefault(sku.getId(), Map.of());
        if (!partners.isEmpty() && w.w2() > 0) {
            double copickTo = copickAffinity(sku.getId(), toSlot.getId(), ctx);
            double copickFrom = fromSlot != null
                    ? copickAffinity(sku.getId(), fromSlot.getId(), ctx) : 0.0;
            double centroidTo = centroidBias(sku.getId(), toSlot.getId(), ctx);
            double centroidFrom = fromSlot != null
                    ? centroidBias(sku.getId(), fromSlot.getId(), ctx) : 0.0;

            if ((copickTo - copickFrom) * w.w2() > 0.005 || (centroidTo - centroidFrom) * w.w2() > 0.005) {
                partners.entrySet().stream()
                        .filter(e -> ctx.currentAssignments().containsKey(e.getKey()))
                        .max(Map.Entry.comparingByValue())
                        .ifPresent(best -> {
                            Long partnerSlotId = ctx.currentAssignments().get(best.getKey());
                            Slot partnerSlot   = ctx.slots().get(partnerSlotId);
                            String partnerCode = ctx.skus().containsKey(best.getKey())
                                    ? ctx.skus().get(best.getKey()).getCode() : best.getKey().toString();
                            int distance = partnerSlot != null
                                    ? Math.abs(toSlot.getRow() - partnerSlot.getRow())
                                      + Math.abs(toSlot.getCol() - partnerSlot.getCol())
                                    : -1;
                            double lift = ctx.copickLift().getOrDefault(sku.getId(), Map.of())
                                    .getOrDefault(best.getKey(), 0.0);

                            reasons.add(new ExplanationReason(
                                    "copick",
                                    "Часто заказывается с %s (lift ×%.1f, аффинность %.0f%%) — новая ячейка в %d шаг(ах), смещение к центру %.2f"
                                            .formatted(partnerCode, lift, best.getValue() * 100, distance, centroidTo),
                                    best.getValue(),
                                    Map.of(
                                            "partnerSku",        partnerCode,
                                            "lift",              Math.round(lift * 100) / 100.0,
                                            "affinityPct",       Math.round(best.getValue() * 1000) / 10.0,
                                            "distanceToPartner", distance,
                                            "centroidBias",      Math.round(centroidTo * 1000) / 1000.0
                                    )
                            ));
                        });
            }
        }

        // Fit component (weight + cube)
        double fitTo   = fitScore(sku, toSlot);
        double fitFrom = fromSlot != null ? fitScore(sku, fromSlot) : 0.0;
        if ((fitTo - fitFrom) * w.w3() > 0.01) {
            double fillRatio = sku.getWeightKg().doubleValue() / toSlot.getCapacityKg().doubleValue();
            double cubeRatio = 0.0;
            if (sku.getVolumeM3() != null && toSlot.getVolumeM3() != null && toSlot.getVolumeM3().doubleValue() > 0) {
                cubeRatio = sku.getVolumeM3().doubleValue() / toSlot.getVolumeM3().doubleValue();
            }
            reasons.add(new ExplanationReason(
                    "weight_fit",
                    "Better capacity fit: %.1f kg / %.1f kg slot (%.0f%%), cube %.2f m³ / %.2f m³ (%.0f%%)"
                            .formatted(
                                    sku.getWeightKg().doubleValue(),
                                    toSlot.getCapacityKg().doubleValue(),
                                    fillRatio * 100,
                                    sku.getVolumeM3() != null ? sku.getVolumeM3().doubleValue() : 0.0,
                                    toSlot.getVolumeM3() != null ? toSlot.getVolumeM3().doubleValue() : 0.0,
                                    cubeRatio * 100),
                    fitTo,
                    Map.of(
                            "skuWeightKg",    sku.getWeightKg().doubleValue(),
                            "slotCapacityKg", toSlot.getCapacityKg().doubleValue(),
                            "fillRatioPct",   Math.round(fillRatio * 1000) / 10.0,
                            "skuVolumeM3",    sku.getVolumeM3() != null ? sku.getVolumeM3().doubleValue() : 0.0,
                            "slotVolumeM3",   toSlot.getVolumeM3() != null ? toSlot.getVolumeM3().doubleValue() : 0.0,
                            "cubeRatioPct",   Math.round(cubeRatio * 1000) / 10.0
                    )
            ));
        }

        // Guarantee at least two substantive reasons: add demand/proximity context.
        if (reasons.size() < 2) {
            double toDist = ctx.slotDistances().getOrDefault(toSlot.getId(), 0.0);
            String abc = abcLabel(ctx.abcBoost().getOrDefault(sku.getId(), 1.0));
            String xyz = xyzLabel(ctx.xyzBoost().getOrDefault(sku.getId(), 1.0));
            reasons.add(new ExplanationReason(
                    "distance",
                    "Класс спроса %s/%s, ближе к доку (близость %.2f) — короче маршрут отбора"
                            .formatted(abc, xyz, toDist),
                    toDist,
                    Map.of(
                            "toProximity", Math.round(toDist * 1000) / 1000.0,
                            "abcClass", abc,
                            "xyzClass", xyz
                    )
            ));
        }

        if (reasons.isEmpty()) {
            reasons.add(new ExplanationReason(
                    "general",
                    "Суммарное улучшение скора по velocity, co-pick и вместимости",
                    scoreAfterMinus(sku, fromSlot, toSlot, ctx),
                    Map.of()
            ));
        }

        return reasons;
    }

    private static String abcLabel(double boost) {
        return boost >= 1.2 ? "A" : boost <= 0.8 ? "C" : "B";
    }

    private static String xyzLabel(double boost) {
        return boost >= 1.0 ? "X" : boost <= 0.85 ? "Z" : "Y";
    }

    private ExplanationImpact estimateImpact(
            Sku sku, Slot fromSlot, Slot toSlot, ScoringContext ctx, double scoreDelta) {

        double fromDist = fromSlot != null
                ? (1.0 - ctx.slotDistances().getOrDefault(fromSlot.getId(), 0.0)) : 1.0;
        double toDist   = 1.0 - ctx.slotDistances().getOrDefault(toSlot.getId(), 0.0);

        double maxDist = ctx.slotDistances().isEmpty() ? 1.0 :
                ctx.slotDistances().values().stream().mapToDouble(d -> 1.0 - d).max().orElse(1.0);

        // Rough savings: difference in normalized distances × estimated max real distance (10m)
        double savingsM = (fromDist - toDist) * maxDist * 10.0;
        savingsM = Math.max(0, savingsM);

        double velocity         = ctx.velocity().getOrDefault(sku.getId(), 0.0);
        int    dailyPicksAffected = (int) Math.round(velocity * PICKS_PER_DAY_ESTIMATE);
        double dailySavingsMin  = dailyPicksAffected * savingsM / WALKING_SPEED_M_PER_MIN;

        return new ExplanationImpact(
                Math.round(savingsM * 10) / 10.0,
                dailyPicksAffected,
                Math.round(dailySavingsMin * 100) / 100.0
        );
    }

    private double computeScore(Long skuId, Long slotId, ScoringContext ctx) {
        ScoringWeights w = ctx.weights();
        double vel   = ctx.adjustedVelocity(skuId);
        double dist  = ctx.slotDistances().getOrDefault(slotId, 0.0);
        double ergo  = ctx.ergonomics().getOrDefault(slotId, 1.0);
        double copick = copickAffinity(skuId, slotId, ctx);
        double centroid = centroidBias(skuId, slotId, ctx);
        Sku sku   = ctx.skus().get(skuId);
        Slot slot = ctx.slots().get(slotId);
        double fit = (sku != null && slot != null) ? fitScore(sku, slot) : 0.0;
        return w.w1() * vel * dist * ergo
             + w.w2() * copick * centroid
             + w.w3() * fit;
    }

    private double copickAffinity(Long skuId, Long slotId, ScoringContext ctx) {
        Map<Long, Double> partners = ctx.copickMatrix().getOrDefault(skuId, Map.of());
        Slot target = ctx.slots().get(slotId);
        if (target == null || partners.isEmpty()) return 0.0;

        double total = 0.0;
        int count = 0;
        for (Map.Entry<Long, Double> e : partners.entrySet()) {
            Long partnerSlotId = ctx.currentAssignments().get(e.getKey());
            if (partnerSlotId == null) continue;
            Slot partnerSlot = ctx.slots().get(partnerSlotId);
            if (partnerSlot == null) continue;
            double d = Math.abs(target.getRow() - partnerSlot.getRow())
                     + Math.abs(target.getCol() - partnerSlot.getCol());
            total += e.getValue() / (1.0 + d);
            count++;
        }
        return count > 0 ? total / count : 0.0;
    }

    private double centroidBias(Long skuId, Long slotId, ScoringContext ctx) {
        Map<Long, Double> partners = ctx.copickMatrix().getOrDefault(skuId, Map.of());
        Slot target = ctx.slots().get(slotId);
        if (target == null || partners.isEmpty()) return 0.0;

        double totalWeight = 0.0;
        double weightedRow = 0.0;
        double weightedCol = 0.0;
        int assignedCount = 0;

        for (Map.Entry<Long, Double> e : partners.entrySet()) {
            Long partnerSlotId = ctx.currentAssignments().get(e.getKey());
            if (partnerSlotId == null) continue;
            Slot partnerSlot = ctx.slots().get(partnerSlotId);
            if (partnerSlot == null) continue;
            weightedRow += partnerSlot.getRow() * e.getValue();
            weightedCol += partnerSlot.getCol() * e.getValue();
            totalWeight += e.getValue();
            assignedCount++;
        }

        if (assignedCount == 0 || totalWeight == 0) return 0.0;

        double centroidRow = weightedRow / totalWeight;
        double centroidCol = weightedCol / totalWeight;
        double dist = Math.abs(target.getRow() - centroidRow) + Math.abs(target.getCol() - centroidCol);
        return 1.0 / (1.0 + dist);
    }

    private double fitScore(Sku sku, Slot slot) {
        double weightRatio = sku.getWeightKg().doubleValue() / slot.getCapacityKg().doubleValue();
        if (weightRatio > 1.0) return 0.0;
        double weightFit = 1.0 - weightRatio * 0.5;

        double cubeFit = 1.0;
        if (sku.getVolumeM3() != null && slot.getVolumeM3() != null && slot.getVolumeM3().doubleValue() > 0) {
            double cubeRatio = sku.getVolumeM3().doubleValue() / slot.getVolumeM3().doubleValue();
            if (cubeRatio > 1.0) return 0.0;
            cubeFit = 1.0 - cubeRatio * 0.3;
        }

        return weightFit * 0.6 + cubeFit * 0.4;
    }

    private double scoreAfterMinus(Sku sku, Slot fromSlot, Slot toSlot, ScoringContext ctx) {
        return computeScore(sku.getId(), toSlot.getId(), ctx)
             - (fromSlot != null ? computeScore(sku.getId(), fromSlot.getId(), ctx) : 0.0);
    }
}
