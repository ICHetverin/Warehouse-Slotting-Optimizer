package com.warehouse.optimizer.service;

import com.warehouse.optimizer.dto.*;
import com.warehouse.optimizer.engine.ScoringEngine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScoringService {

    private final ScoringEngine engine;

    // In-memory job cache; for production use Redis or a job table
    private final Map<String, ScoringRunResponse> jobCache = new ConcurrentHashMap<>();

    public ScoringRunResponse run(ScoringRunRequest req) {
        String jobId = UUID.randomUUID().toString();
        log.info("Scoring job {} started: warehouse={}, weights={}", jobId, req.warehouseId(), req.weights());

        List<Assignment> assignments = engine.runGreedyAssignment(req.warehouseId(), req.weights());

        long improved = assignments.stream().filter(a -> a.scoreDelta() > 0).count();

        ScoringRunResponse response = new ScoringRunResponse(
                jobId,
                req.warehouseId(),
                req.weights(),
                req.velocityDays(),
                assignments.size(),
                (int) improved,
                assignments,
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
}
