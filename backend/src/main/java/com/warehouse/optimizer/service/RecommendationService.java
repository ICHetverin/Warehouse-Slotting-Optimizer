package com.warehouse.optimizer.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.warehouse.optimizer.dto.*;
import com.warehouse.optimizer.engine.ExplainerEngine;
import com.warehouse.optimizer.engine.ScoringContext;
import com.warehouse.optimizer.engine.ScoringEngine;
import com.warehouse.optimizer.engine.Statistics;
import com.warehouse.optimizer.exception.NotFoundException;
import com.warehouse.optimizer.model.*;
import com.warehouse.optimizer.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RecommendationService {

    private final ScoringEngine             scoringEngine;
    private final ExplainerEngine           explainerEngine;
    private final RecommendationRepository  recommendationRepo;
    private final WarehouseRepository       warehouseRepo;
    private final SkuRepository             skuRepo;
    private final SlotRepository            slotRepo;
    private final OrderLineRepository       orderLineRepo;
    private final ObjectMapper              objectMapper;

    /** Minimum composite score gain to even consider a move. */
    private static final double SCORE_EPS = 0.01;
    /** Benjamini-Hochberg target false discovery rate. */
    private static final double FDR_Q = 0.10;

    /**
     * Runs greedy assignment, persists recommendations with explanations, and returns them.
     * Clears any pending recommendations for the warehouse before inserting new ones.
     */
    @Transactional
    public List<RecommendationResponse> generate(Long warehouseId, ScoringWeights weights) {
        return generate(warehouseId, weights, ScoringConstraints.DEFAULT, 90);
    }

    @Transactional
    public List<RecommendationResponse> generate(Long warehouseId, ScoringWeights weights, ScoringConstraints constraints) {
        return generate(warehouseId, weights, constraints, 90);
    }

    /** A scored move that survived the positive-gain filter, awaiting the significance gate. */
    private record Candidate(Assignment a, ExplanationDetail exp, double p, double liftMax) {}

    /**
     * Runs greedy assignment, then keeps only **statistically significant** moves:
     * each candidate gets a p-value (demand vs uniform baseline, and co-pick lift χ²),
     * and the Benjamini-Hochberg procedure controls the false-discovery rate. The
     * surviving set is therefore of *variable* size — not a fixed top-N — and every
     * recommendation carries its evidence (p, q, lift).
     */
    @Transactional
    public List<RecommendationResponse> generate(
            Long warehouseId, ScoringWeights weights, ScoringConstraints constraints, int days) {
        Warehouse warehouse = requireWarehouse(warehouseId);

        List<Assignment> assignments = scoringEngine.runGreedyAssignment(warehouseId, weights, constraints);

        Map<Long, Double>            velocity   = scoringEngine.computeEwVelocity(warehouseId, days, weights.decayLambda());
        Map<Long, Double>            velWilson  = scoringEngine.computeVelocityWilson(warehouseId, days);
        Map<Long, Map<Long, Double>> copick     = scoringEngine.computeCopickMatrix(warehouseId, days);
        Map<Long, Map<Long, Double>> copickLift = scoringEngine.computeCopickLift(warehouseId, days);
        Map<Long, Double>            distances  = scoringEngine.computeSlotDistances(warehouseId);
        Map<Long, Double>            rawCounts  = scoringEngine.computeRawCounts(warehouseId, days);
        Map<Long, Double>            abcBoost   = weights.useAbcXyz() ? scoringEngine.computeAbcClassification(rawCounts) : Map.of();
        Map<Long, Double>            xyzBoost   = weights.useAbcXyz() ? scoringEngine.computeXyzStability(warehouseId, days) : Map.of();

        List<Sku>  allSkus  = skuRepo.findByWarehouseId(warehouseId);
        List<Slot> allSlots = slotRepo.findByWarehouseId(warehouseId);
        Map<Long, Sku>  skuMap  = allSkus.stream().collect(Collectors.toMap(Sku::getId,  s -> s));
        Map<Long, Slot> slotMap = allSlots.stream().collect(Collectors.toMap(Slot::getId, s -> s));
        Map<Long, Double> ergonomics = scoringEngine.computeErgonomics(allSlots);

        Map<Long, Long> assignmentMap = assignments.stream()
                .collect(Collectors.toMap(Assignment::skuId, Assignment::toSlotId));

        ScoringContext ctx = new ScoringContext(
                velocity, copick, distances, skuMap, slotMap, assignmentMap, weights,
                abcBoost, xyzBoost, ergonomics, constraints, copickLift, velWilson);

        long n = scoringEngine.countOrdersInWindow(warehouseId, days);
        double p0 = 1.0 / Math.max(1, allSkus.size());

        // ── Score every improving move and compute its significance p-value ────────
        List<Candidate> candidates = new ArrayList<>();
        for (Assignment a : assignments) {
            if (a.scoreDelta() <= SCORE_EPS) continue;
            Sku  sku      = skuMap.get(a.skuId());
            Slot toSlot   = slotMap.get(a.toSlotId());
            Slot fromSlot = a.fromSlotId() != null ? slotMap.get(a.fromSlotId()) : null;
            if (sku == null || toSlot == null) continue;

            ExplanationDetail exp = explainerEngine.explain(sku, fromSlot, toSlot, ctx);

            // Demand significance: is this SKU ordered more than a uniform baseline?
            double cntSku = rawCounts.getOrDefault(a.skuId(), 0.0);
            double pDemand = 1.0;
            if (n > 0 && cntSku > 0) {
                double phat = cntSku / n;
                double se = Math.sqrt(Math.max(1e-9, phat * (1 - phat) / n));
                pDemand = Statistics.normalUpperTailP((phat - p0) / se);
            }

            // Co-pick significance: strongest placed partner by lift, χ² on the pair.
            double pCopick = 1.0, liftMax = 0.0;
            for (Map.Entry<Long, Double> e : copickLift.getOrDefault(a.skuId(), Map.of()).entrySet()) {
                if (!assignmentMap.containsKey(e.getKey())) continue;
                double lift = e.getValue();
                if (lift > liftMax) liftMax = lift;
                double cntP = rawCounts.getOrDefault(e.getKey(), 0.0);
                double pairCount = lift * cntSku * cntP / Math.max(1.0, n);
                pCopick = Math.min(pCopick, Statistics.chiSquarePValue(pairCount, cntSku, cntP, n));
            }

            candidates.add(new Candidate(a, exp, Math.min(pDemand, pCopick), liftMax));
        }

        // ── Benjamini-Hochberg FDR gate → statistically distinguished, variable set ─
        double[] pvals = candidates.stream().mapToDouble(Candidate::p).toArray();
        Statistics.FdrResult fdr = Statistics.benjaminiHochberg(pvals, FDR_Q);

        recommendationRepo.deleteByWarehouseIdAndStatus(warehouseId, RecommendationStatus.PENDING);

        List<Recommendation> saved = new ArrayList<>();
        for (int i = 0; i < candidates.size(); i++) {
            if (!fdr.significant()[i]) continue;
            Candidate c = candidates.get(i);
            if (c.exp().impact().estimatedDailySavingsMin() <= 0) continue;

            ExplanationDetail exp = c.exp().withStats(
                    c.exp().impact(),
                    round4(c.p()), round4(fdr.qValues()[i]), round2(c.liftMax()), Boolean.TRUE);

            Map<String, Object> explanationJson = objectMapper.convertValue(exp, new TypeReference<>() {});

            saved.add(recommendationRepo.save(Recommendation.builder()
                    .warehouse(warehouse)
                    .sku(skuMap.get(c.a().skuId()))
                    .fromSlot(c.a().fromSlotId() != null ? slotMap.get(c.a().fromSlotId()) : null)
                    .toSlot(slotMap.get(c.a().toSlotId()))
                    .scoreDelta(BigDecimal.valueOf(c.a().scoreDelta()))
                    .explanationJson(explanationJson)
                    .status(RecommendationStatus.PENDING)
                    .build()));
        }

        log.info("Generated {} significant recommendations for warehouse={} ({} improving candidates, FDR q={})",
                saved.size(), warehouseId, candidates.size(), FDR_Q);
        return saved.stream().map(r -> toResponse(r, skuMap, slotMap)).collect(Collectors.toList());
    }

    private static double round4(double v) { return Math.round(v * 1e4) / 1e4; }
    private static double round2(double v) { return Math.round(v * 1e2) / 1e2; }

    @Transactional(readOnly = true)
    public List<RecommendationResponse> list(Long warehouseId, String sortBy, int limit, String status) {
        requireWarehouse(warehouseId);

        Sort sort = "savings".equalsIgnoreCase(sortBy)
                ? Sort.by(Sort.Direction.DESC, "scoreDelta")
                : Sort.by(Sort.Direction.DESC, "scoreDelta");

        RecommendationStatus statusEnum = parseStatus(status);

        List<Recommendation> recs = statusEnum != null
                ? recommendationRepo.findByWarehouseIdAndStatus(
                        warehouseId, statusEnum, PageRequest.of(0, limit, sort)).getContent()
                : recommendationRepo.findByWarehouseId(
                        warehouseId, PageRequest.of(0, limit, sort)).getContent();

        Map<Long, Sku>  skuMap  = skuRepo.findByWarehouseId(warehouseId).stream()
                .collect(Collectors.toMap(Sku::getId, s -> s));
        Map<Long, Slot> slotMap = slotRepo.findByWarehouseId(warehouseId).stream()
                .collect(Collectors.toMap(Slot::getId, s -> s));

        return recs.stream().map(r -> toResponse(r, skuMap, slotMap)).collect(Collectors.toList());
    }

    @Transactional
    public RecommendationResponse accept(Long id) {
        Recommendation rec = requireRecommendation(id);
        applyMove(rec);
        rec.setStatus(RecommendationStatus.ACCEPTED);
        rec.setDecidedAt(Instant.now());
        recommendationRepo.save(rec);
        return respond(rec);
    }

    /** Apply every PENDING (or given-status) recommendation to the layout in one shot. */
    @Transactional
    public BulkAcceptResult acceptAll(Long warehouseId, String status) {
        requireWarehouse(warehouseId);
        RecommendationStatus st = parseStatus(status);
        if (st == null) st = RecommendationStatus.PENDING;

        List<Recommendation> recs = recommendationRepo
                .findByWarehouseIdAndStatus(warehouseId, st,
                        PageRequest.of(0, 100_000, Sort.by(Sort.Direction.DESC, "scoreDelta")))
                .getContent();

        Set<Long> taken = new HashSet<>();
        int applied = 0, skipped = 0;
        for (Recommendation rec : recs) {
            Long toSlotId = rec.getToSlot() != null ? rec.getToSlot().getId() : null;
            if (toSlotId == null || taken.contains(toSlotId)) { skipped++; continue; }
            applyMove(rec);
            rec.setStatus(RecommendationStatus.ACCEPTED);
            rec.setDecidedAt(Instant.now());
            recommendationRepo.save(rec);
            taken.add(toSlotId);
            applied++;
        }
        log.info("acceptAll warehouse={}: applied={}, skipped={}", warehouseId, applied, skipped);
        return new BulkAcceptResult(applied, skipped, recs.size());
    }

    @Transactional
    public RecommendationResponse reject(Long id) {
        return updateStatus(id, RecommendationStatus.REJECTED);
    }

    /** Free the SKU's current slot(s) and occupy the recommended one. */
    private void applyMove(Recommendation rec) {
        Sku sku = rec.getSku();
        Slot toSlot = rec.getToSlot();
        if (sku == null || toSlot == null) return;
        Long whId = rec.getWarehouse().getId();
        for (Slot s : slotRepo.findByWarehouseIdAndCurrentSkuId(whId, sku.getId())) {
            s.setCurrentSku(null);
            slotRepo.save(s);
        }
        toSlot.setCurrentSku(sku);
        slotRepo.save(toSlot);
    }

    private RecommendationResponse respond(Recommendation rec) {
        Long whId = rec.getWarehouse().getId();
        Map<Long, Sku>  skuMap  = skuRepo.findByWarehouseId(whId).stream()
                .collect(Collectors.toMap(Sku::getId, s -> s));
        Map<Long, Slot> slotMap = slotRepo.findByWarehouseId(whId).stream()
                .collect(Collectors.toMap(Slot::getId, s -> s));
        return toResponse(rec, skuMap, slotMap);
    }

    @Transactional(readOnly = true)
    public RecommendationResponse getDetail(Long id) {
        Recommendation rec = requireRecommendation(id);
        Map<Long, Sku>  skuMap  = skuRepo.findByWarehouseId(rec.getWarehouse().getId()).stream()
                .collect(Collectors.toMap(Sku::getId, s -> s));
        Map<Long, Slot> slotMap = slotRepo.findByWarehouseId(rec.getWarehouse().getId()).stream()
                .collect(Collectors.toMap(Slot::getId, s -> s));
        return toResponse(rec, skuMap, slotMap);
    }

    // ──────────────────────────────────────────────────────────────────────────

    private RecommendationResponse updateStatus(Long id, RecommendationStatus newStatus) {
        Recommendation rec = requireRecommendation(id);
        rec.setStatus(newStatus);
        rec.setDecidedAt(Instant.now());
        recommendationRepo.save(rec);

        Map<Long, Sku>  skuMap  = skuRepo.findByWarehouseId(rec.getWarehouse().getId()).stream()
                .collect(Collectors.toMap(Sku::getId, s -> s));
        Map<Long, Slot> slotMap = slotRepo.findByWarehouseId(rec.getWarehouse().getId()).stream()
                .collect(Collectors.toMap(Slot::getId, s -> s));
        return toResponse(rec, skuMap, slotMap);
    }

    private RecommendationResponse toResponse(
            Recommendation rec, Map<Long, Sku> skuMap, Map<Long, Slot> slotMap) {

        ExplanationDetail explanation = null;
        if (rec.getExplanationJson() != null) {
            try {
                explanation = objectMapper.convertValue(rec.getExplanationJson(), ExplanationDetail.class);
            } catch (Exception e) {
                log.warn("Failed to deserialize explanation for rec={}", rec.getId());
            }
        }

        String fromLabel = rec.getFromSlot() != null ? rec.getFromSlot().getLabel() : null;
        String toLabel   = rec.getToSlot()   != null ? rec.getToSlot().getLabel()   : null;

        return new RecommendationResponse(
                rec.getId(),
                rec.getWarehouse().getId(),
                rec.getSku().getId(),
                rec.getSku().getCode(),
                fromLabel,
                toLabel,
                rec.getScoreDelta().doubleValue(),
                rec.getStatus().name(),
                explanation,
                rec.getCreatedAt(),
                rec.getDecidedAt()
        );
    }

    private Warehouse requireWarehouse(Long id) {
        return warehouseRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Warehouse not found: " + id));
    }

    private Recommendation requireRecommendation(Long id) {
        return recommendationRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Recommendation not found: " + id));
    }

    private static RecommendationStatus parseStatus(String status) {
        if (status == null || status.isBlank()) return null;
        try {
            return RecommendationStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
