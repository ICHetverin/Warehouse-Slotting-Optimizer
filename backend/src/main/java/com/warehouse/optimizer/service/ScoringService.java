package com.warehouse.optimizer.service;

import com.warehouse.optimizer.dto.*;
import com.warehouse.optimizer.engine.ScoringContext;
import com.warehouse.optimizer.engine.ScoringEngine;
import com.warehouse.optimizer.engine.ValidationEngine;
import com.warehouse.optimizer.model.Sku;
import com.warehouse.optimizer.model.Slot;
import com.warehouse.optimizer.repository.SkuRepository;
import com.warehouse.optimizer.repository.SlotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScoringService {

    private final ScoringEngine     engine;
    private final ValidationEngine  validationEngine;
    private final SkuRepository     skuRepo;
    private final SlotRepository    slotRepo;

    // In-memory job cache; for production use Redis or a job table
    private final Map<String, ScoringRunResponse> jobCache = new ConcurrentHashMap<>();

    public ScoringRunResponse run(ScoringRunRequest req) {
        String jobId = UUID.randomUUID().toString();
        log.info("Scoring job {} started: warehouse={}, weights={}", jobId, req.warehouseId(), req.weights());

        List<Assignment> assignments = engine.runGreedyAssignment(req.warehouseId(), req.weights(), req.constraints());

        long improved = assignments.stream().filter(a -> a.scoreDelta() > 0).count();

        // Build context for validation
        ScoringValidation validation = null;
        if (!assignments.isEmpty()) {
            Map<Long, Double> velocity = engine.computeEwVelocity(req.warehouseId(), req.velocityDays(), req.weights().decayLambda());
            Map<Long, Map<Long, Double>> copick = engine.computeCopickMatrix(req.warehouseId(), req.velocityDays());
            Map<Long, Double> distances = engine.computeSlotDistances(req.warehouseId());
            List<Sku> allSkus = skuRepo.findByWarehouseId(req.warehouseId());
            List<Slot> allSlots = slotRepo.findByWarehouseId(req.warehouseId());
            Map<Long, Sku> skuMap = allSkus.stream().collect(Collectors.toMap(Sku::getId, s -> s));
            Map<Long, Slot> slotMap = allSlots.stream().collect(Collectors.toMap(Slot::getId, s -> s));
            Map<Long, Long> assignmentMap = assignments.stream()
                    .collect(Collectors.toMap(Assignment::skuId, Assignment::toSlotId));
            Map<Long, Double> rawCounts = engine.computeRawCounts(req.warehouseId(), req.velocityDays());
            Map<Long, Double> abcBoost = req.weights().useAbcXyz() ? engine.computeAbcClassification(rawCounts) : Map.of();
            Map<Long, Double> xyzBoost = req.weights().useAbcXyz() ? engine.computeXyzStability(req.warehouseId(), req.velocityDays()) : Map.of();
            Map<Long, Double> ergonomics = engine.computeErgonomics(allSlots);

            ScoringContext ctx = new ScoringContext(
                    velocity, copick, distances, skuMap, slotMap, assignmentMap,
                    req.weights(), abcBoost, xyzBoost, ergonomics);

            validation = validationEngine.validate(req.warehouseId(), assignments, ctx);
        }

        ScoringRunResponse response = new ScoringRunResponse(
                jobId,
                req.warehouseId(),
                req.weights(),
                req.velocityDays(),
                assignments.size(),
                (int) improved,
                assignments,
                validation,
                Instant.now()
        );

        jobCache.put(jobId, response);
        return response;
    }

    public ScoringRunResponse getResult(String jobId) {
        ScoringRunResponse result = jobCache.get(jobId);
        if (result == null) {
            throw new com.warehouse.optimizer.exception.NotFoundException("Job not found: " + jobId);
        }
        return result;
    }

    public CopickMatrixResponse getCopickMatrix(Long warehouseId, int days) {
        Map<Long, Map<Long, Double>> matrix = engine.computeCopickMatrix(warehouseId, days);
        int pairCount = matrix.values().stream()
                .mapToInt(Map::size)
                .sum() / 2; // symmetric, count once
        return new CopickMatrixResponse(warehouseId, days, matrix.size(), pairCount, matrix);
    }

    public AbcXyzMatrixResponse getAbcXyzMatrix(Long warehouseId, int days) {
        Map<Long, Double> rawCounts = engine.computeRawCounts(warehouseId, days);
        Map<Long, Double> velocity = engine.computeEwVelocity(warehouseId, days, ScoringWeights.DEFAULT.decayLambda());
        Map<Long, Double> abcBoost = engine.computeAbcClassification(rawCounts);
        Map<Long, Double> xyzBoost = engine.computeXyzStability(warehouseId, days);
        List<Sku> skus = skuRepo.findByWarehouseId(warehouseId);

        List<AbcXyzProfile> profiles = new ArrayList<>();
        Map<String, Map<String, Long>> matrix = new HashMap<>();

        for (Sku sku : skus) {
            Long skuId = sku.getId();
            char abc = abcBoost.getOrDefault(skuId, 1.0) >= 1.2 ? 'A'
                    : abcBoost.getOrDefault(skuId, 1.0) >= 1.0 ? 'B' : 'C';
            char xyz = xyzBoost.getOrDefault(skuId, 1.0) >= 1.0 ? 'X'
                    : xyzBoost.getOrDefault(skuId, 1.0) >= 0.95 ? 'Y' : 'Z';

            profiles.add(new AbcXyzProfile(
                    skuId, sku.getCode(), abc, xyz,
                    velocity.getOrDefault(skuId, 0.0),
                    xyzBoost.getOrDefault(skuId, 1.0) >= 1.0 ? 0.3
                            : xyzBoost.getOrDefault(skuId, 1.0) >= 0.95 ? 0.7 : 1.5,
                    rawCounts.getOrDefault(skuId, 0.0).longValue()
            ));

            matrix.computeIfAbsent(String.valueOf(abc), k -> new HashMap<>())
                    .merge(String.valueOf(xyz), 1L, Long::sum);
        }

        return new AbcXyzMatrixResponse(warehouseId, skus.size(), matrix, profiles);
    }
}
