package com.warehouse.optimizer.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.opencsv.CSVWriter;
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

import java.io.IOException;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
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
    private final WarehouseAccessService    accessService;

    /**
     * Runs greedy assignment, persists recommendations with explanations, and returns them.
     * Clears any pending recommendations for the warehouse before inserting new ones.
     */
    @Transactional
    public List<RecommendationResponse> generate(Long warehouseId, ScoringWeights weights) {
        accessService.requireReadable(warehouseId);
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
        accessService.requireReadable(warehouseId);
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
    public byte[] exportToCsv(Long warehouseId) {
        accessService.requireReadable(warehouseId);
        requireWarehouse(warehouseId);

        Sort sort = Sort.by(Sort.Direction.DESC, "scoreDelta");
        List<Recommendation> recs = recommendationRepo
                .findByWarehouseId(warehouseId, PageRequest.of(0, 10_000, sort))
                .getContent();

        try (StringWriter sw = new StringWriter(); CSVWriter csv = new CSVWriter(sw)) {
            csv.writeNext(new String[]{
                "id", "sku_code", "from_slot", "to_slot",
                "score_delta", "status", "created_at"
            });
            for (Recommendation r : recs) {
                csv.writeNext(new String[]{
                    String.valueOf(r.getId()),
                    r.getSku().getCode(),
                    r.getFromSlot() != null ? r.getFromSlot().getLabel() : "",
                    r.getToSlot()   != null ? r.getToSlot().getLabel()   : "",
                    r.getScoreDelta().toPlainString(),
                    r.getStatus().name(),
                    r.getCreatedAt().toString()
                });
            }
            return sw.toString().getBytes(StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate CSV export", e);
        }
    }

    @Transactional(readOnly = true)
    public RecommendationResponse getDetail(Long id) {
        Recommendation rec = requireRecommendation(id);
        accessService.requireReadable(rec.getWarehouse().getId());
        Map<Long, Sku>  skuMap  = skuRepo.findByWarehouseId(rec.getWarehouse().getId()).stream()
                .collect(Collectors.toMap(Sku::getId, s -> s));
        Map<Long, Slot> slotMap = slotRepo.findByWarehouseId(rec.getWarehouse().getId()).stream()
                .collect(Collectors.toMap(Slot::getId, s -> s));
        return toResponse(rec, skuMap, slotMap);
    }

    // ──────────────────────────────────────────────────────────────────────────

    private RecommendationResponse updateStatus(Long id, RecommendationStatus newStatus) {
        Recommendation rec = requireRecommendation(id);
        accessService.requireReadable(rec.getWarehouse().getId());

        // Apply the physical move only on the PENDING → ACCEPTED transition (idempotent).
        if (newStatus == RecommendationStatus.ACCEPTED
                && rec.getStatus() != RecommendationStatus.ACCEPTED) {
            applyAssignment(rec);
        }

        rec.setStatus(newStatus);
        recommendationRepo.save(rec);

        Map<Long, Sku>  skuMap  = skuRepo.findByWarehouseId(rec.getWarehouse().getId()).stream()
                .collect(Collectors.toMap(Sku::getId, s -> s));
        Map<Long, Slot> slotMap = slotRepo.findByWarehouseId(rec.getWarehouse().getId()).stream()
                .collect(Collectors.toMap(Slot::getId, s -> s));
        return toResponse(rec, skuMap, slotMap);
    }

    /**
     * Physically applies an accepted recommendation to the warehouse state:
     * the SKU is moved into the target slot, its previous slot is freed, and any SKU
     * already occupying the target slot is swapped into the freed slot (or left
     * unplaced if there is none). This makes accepted recommendations stick — the next
     * scoring run sees the updated {@code currentSku} placements as the new baseline.
     */
    private void applyAssignment(Recommendation rec) {
        Long wid = rec.getWarehouse().getId();
        Sku  sku = rec.getSku();

        // Re-load managed slot instances so mutations are persisted.
        Slot toSlot = slotRepo.findById(rec.getToSlot().getId())
                .orElseThrow(() -> new NotFoundException("Target slot not found"));

        // Where the SKU currently lives (usually 0 or 1 slot).
        List<Slot> currentSlotsOfSku = slotRepo.findByWarehouseIdAndCurrentSkuId(wid, sku.getId());

        Sku occupant = toSlot.getCurrentSku();   // who currently sits in the target slot

        // 1. Free the SKU from its current slot(s).
        for (Slot s : currentSlotsOfSku) {
            s.setCurrentSku(null);
        }

        // 2. Swap: if the target was held by a *different* SKU, relocate that occupant
        //    into the slot we just freed (if any); otherwise it becomes unplaced.
        if (occupant != null && !occupant.getId().equals(sku.getId())) {
            Slot freed = currentSlotsOfSku.isEmpty() ? null : currentSlotsOfSku.get(0);
            if (freed != null) {
                freed.setCurrentSku(occupant);
            }
        }

        // 3. Place the SKU into the target slot.
        toSlot.setCurrentSku(sku);

        slotRepo.saveAll(currentSlotsOfSku);
        slotRepo.save(toSlot);

        log.info("Applied recommendation {}: SKU {} -> slot {} (warehouse {})",
                rec.getId(), sku.getCode(), toSlot.getLabel(), wid);
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
