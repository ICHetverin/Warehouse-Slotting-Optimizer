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

    private List<ExplanationReason> buildReasons(
            Sku sku, Slot fromSlot, Slot toSlot, ScoringContext ctx) {

        List<ExplanationReason> reasons = new ArrayList<>();
        ScoringWeights w = ctx.weights();

        // Velocity × Distance component
        double velFrom = fromSlot != null
                ? ctx.velocity().getOrDefault(sku.getId(), 0.0)
                  * ctx.slotDistances().getOrDefault(fromSlot.getId(), 0.0)
                : 0.0;
        double velTo   = ctx.velocity().getOrDefault(sku.getId(), 0.0)
                       * ctx.slotDistances().getOrDefault(toSlot.getId(), 0.0);
        double velGain = (velTo - velFrom) * w.w1();

        if (velGain > 0.01) {
            double velocityPct = ctx.velocity().getOrDefault(sku.getId(), 0.0) * 100;
            double distScore   = ctx.slotDistances().getOrDefault(toSlot.getId(), 0.0);
            reasons.add(new ExplanationReason(
                    "velocity",
                    "Товар встречается в %.0f%% заказов и выиграет от более близкой ячейки (оценка близости %.2f)"
                            .formatted(velocityPct, distScore),
                    velTo,
                    Map.of(
                            "velocityPct",     Math.round(velocityPct * 10) / 10.0,
                            "fromProximity",   fromSlot != null
                                    ? ctx.slotDistances().getOrDefault(fromSlot.getId(), 0.0) : 0.0,
                            "toProximity",     distScore
                    )
            ));
        }

        // Co-pick component
        Map<Long, Double> partners = ctx.copickMatrix().getOrDefault(sku.getId(), Map.of());
        if (!partners.isEmpty() && w.w2() > 0) {
            double copickTo = copickAffinity(sku.getId(), toSlot.getId(), ctx);
            double copickFrom = fromSlot != null
                    ? copickAffinity(sku.getId(), fromSlot.getId(), ctx) : 0.0;

            if ((copickTo - copickFrom) * w.w2() > 0.005) {
                // Find strongest partner that is already assigned near toSlot
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

                            reasons.add(new ExplanationReason(
                                    "copick",
                                    "Совместный заказ с %s (аффинити %.0f%%) — новая ячейка на %d шаг(а) ближе"
                                            .formatted(partnerCode, best.getValue() * 100, distance),
                                    best.getValue(),
                                    Map.of(
                                            "partnerSku",       partnerCode,
                                            "affinityPct",      Math.round(best.getValue() * 1000) / 10.0,
                                            "distanceToPartner", distance
                                    )
                            ));
                        });
            }
        }

        // Fit component
        double fitTo   = fitScore(sku, toSlot);
        double fitFrom = fromSlot != null ? fitScore(sku, fromSlot) : 0.0;
        if ((fitTo - fitFrom) * w.w3() > 0.01) {
            double fillRatio = sku.getWeightKg().doubleValue() / toSlot.getCapacityKg().doubleValue();
            reasons.add(new ExplanationReason(
                    "weight_fit",
                    "Лучшее соответствие грузоподъёмности: артикул %.1f кг занимает %.0f%% ёмкости ячейки %.1f кг"
                            .formatted(sku.getWeightKg().doubleValue(),
                                       fillRatio * 100,
                                       toSlot.getCapacityKg().doubleValue()),
                    fitTo,
                    Map.of(
                            "skuWeightKg",   sku.getWeightKg().doubleValue(),
                            "slotCapacityKg", toSlot.getCapacityKg().doubleValue(),
                            "fillRatioPct",  Math.round(fillRatio * 1000) / 10.0
                    )
            ));
        }

        if (reasons.isEmpty()) {
            reasons.add(new ExplanationReason(
                    "general",
                    "Общее улучшение скора: скорость продаж, совместные заказы и грузоподъёмность",
                    scoreAfterMinus(sku, fromSlot, toSlot, ctx),
                    Map.of()
            ));
        }

        return reasons;
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
        double vel   = ctx.velocity().getOrDefault(skuId, 0.0);
        double dist  = ctx.slotDistances().getOrDefault(slotId, 0.0);
        double copick = copickAffinity(skuId, slotId, ctx);
        Sku sku   = ctx.skus().get(skuId);
        Slot slot = ctx.slots().get(slotId);
        double fit = (sku != null && slot != null) ? fitScore(sku, slot) : 0.0;
        return w.w1() * vel * dist + w.w2() * copick + w.w3() * fit;
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

    private double fitScore(Sku sku, Slot slot) {
        double ratio = sku.getWeightKg().doubleValue() / slot.getCapacityKg().doubleValue();
        return ratio <= 1.0 ? 1.0 - ratio * 0.5 : 0.0;
    }

    private double scoreAfterMinus(Sku sku, Slot fromSlot, Slot toSlot, ScoringContext ctx) {
        return computeScore(sku.getId(), toSlot.getId(), ctx)
             - (fromSlot != null ? computeScore(sku.getId(), fromSlot.getId(), ctx) : 0.0);
    }
}
