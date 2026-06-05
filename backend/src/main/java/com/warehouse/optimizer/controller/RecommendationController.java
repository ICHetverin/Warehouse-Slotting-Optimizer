package com.warehouse.optimizer.controller;

import com.warehouse.optimizer.dto.*;
import com.warehouse.optimizer.service.RecommendationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/recommendations")
@RequiredArgsConstructor
public class RecommendationController {

    private final RecommendationService recommendationService;

    /** POST /api/v1/recommendations/generate — run scoring and persist recommendations. */
    @PostMapping("/generate")
    public ApiResponse<List<RecommendationResponse>> generate(@RequestBody ScoringRunRequest req) {
        ScoringWeights weights = req.weights() != null
                ? req.weights()
                : ScoringWeights.DEFAULT;
        ScoringConstraints constraints = req.constraints() != null
                ? req.constraints()
                : ScoringConstraints.DEFAULT;
        int days = req.velocityDays() != null ? req.velocityDays() : 90;
        return ApiResponse.of(recommendationService.generate(req.warehouseId(), weights, constraints, days));
    }

    /** POST /api/v1/recommendations/{warehouseId}/accept-all — apply all matching recommendations. */
    @PostMapping("/{warehouseId}/accept-all")
    public ApiResponse<BulkAcceptResult> acceptAll(
            @PathVariable Long warehouseId,
            @RequestParam(defaultValue = "PENDING") String status) {
        return ApiResponse.of(recommendationService.acceptAll(warehouseId, status));
    }

    /** GET /api/v1/recommendations/{warehouseId} — list with optional filters. */
    @GetMapping("/{warehouseId}")
    public ApiResponse<List<RecommendationResponse>> list(
            @PathVariable Long warehouseId,
            @RequestParam(defaultValue = "score_delta") String sortBy,
            @RequestParam(defaultValue = "50")          int    limit,
            @RequestParam(required = false)             String status) {
        return ApiResponse.of(recommendationService.list(warehouseId, sortBy, limit, status));
    }

    /** GET /api/v1/recommendations/detail/{id} — single recommendation with full explanation. */
    @GetMapping("/detail/{id}")
    public ApiResponse<RecommendationResponse> detail(@PathVariable Long id) {
        return ApiResponse.of(recommendationService.getDetail(id));
    }

    /** PATCH /api/v1/recommendations/{id}/accept */
    @PatchMapping("/{id}/accept")
    public ApiResponse<RecommendationResponse> accept(@PathVariable Long id) {
        return ApiResponse.of(recommendationService.accept(id));
    }

    /** PATCH /api/v1/recommendations/{id}/reject */
    @PatchMapping("/{id}/reject")
    public ApiResponse<RecommendationResponse> reject(@PathVariable Long id) {
        return ApiResponse.of(recommendationService.reject(id));
    }
}
