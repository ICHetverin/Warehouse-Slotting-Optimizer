package com.warehouse.optimizer.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.warehouse.optimizer.dto.*;
import com.warehouse.optimizer.engine.ExplainerEngine;
import com.warehouse.optimizer.engine.ScoringContext;
import com.warehouse.optimizer.engine.ScoringEngine;
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
    private final ObjectMapper              objectMapper;

    /**
     * Runs greedy assignment, persists recommendations with explanations, and returns them.
     * Clears any pending recommendations for the warehouse before inserting new ones.
     */
    @Transactional
    public List<RecommendationResponse> generate(Long warehouseId, ScoringWeights weights) {
        Warehouse warehouse = requireWarehouse(warehouseId);

        List<Assignment> assignments = scoringEngine.runGreedyAssignment(warehouseId, weights);

        // Build scoring context for explanations
        Map<Long, Double>            velocity  = scoringEngine.computeVelocity(warehouseId, 90);
        Map<Long, Map<Long, Double>> copick    = scoringEngine.computeCopickMatrix(warehouseId, 90);
        Map<Long, Double>            distances = scoringEngine.computeSlotDistances(warehouseId);

        List<Sku>  allSkus  = skuRepo.findByWarehouseId(warehouseId);
        List<Slot> allSlots = slotRepo.findByWarehouseId(warehouseId);

        Map<Long, Sku>  skuMap  = allSkus.stream().collect(Collectors.toMap(Sku::getId,  s -> s));
        Map<Long, Slot> slotMap = allSlots.stream().collect(Collectors.toMap(Slot::getId, s -> s));

        Map<Long, Long> assignmentMap = assignments.stream()
                .collect(Collectors.toMap(Assignment::skuId, Assignment::toSlotId));

        ScoringContext ctx = new ScoringContext(velocity, copick, distances, skuMap, slotMap, assignmentMap, weights);

        // Clear stale pending recommendations
        recommendationRepo.deleteByWarehouseIdAndStatus(warehouseId, RecommendationStatus.PENDING);

        List<Recommendation> saved = new ArrayList<>();
        for (Assignment a : assignments) {
            Sku  sku      = skuMap.get(a.skuId());
            Slot toSlot   = slotMap.get(a.toSlotId());
            Slot fromSlot = a.fromSlotId() != null ? slotMap.get(a.fromSlotId()) : null;
            if (sku == null || toSlot == null) continue;

            ExplanationDetail explanation = explainerEngine.explain(sku, fromSlot, toSlot, ctx);

            Map<String, Object> explanationJson = objectMapper.convertValue(
                    explanation, new TypeReference<>() {});

            Recommendation rec = Recommendation.builder()
                    .warehouse(warehouse)
                    .sku(sku)
                    .fromSlot(fromSlot)
                    .toSlot(toSlot)
                    .scoreDelta(BigDecimal.valueOf(a.scoreDelta()))
                    .explanationJson(explanationJson)
                    .status(RecommendationStatus.PENDING)
                    .build();

            saved.add(recommendationRepo.save(rec));
        }

        log.info("Generated {} recommendations for warehouse={}", saved.size(), warehouseId);
        return saved.stream().map(r -> toResponse(r, skuMap, slotMap)).collect(Collectors.toList());
    }

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
        return updateStatus(id, RecommendationStatus.ACCEPTED);
    }

    @Transactional
    public RecommendationResponse reject(Long id) {
        return updateStatus(id, RecommendationStatus.REJECTED);
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
                rec.getCreatedAt()
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
