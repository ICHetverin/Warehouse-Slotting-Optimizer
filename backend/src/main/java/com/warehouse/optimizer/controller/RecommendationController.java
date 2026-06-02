package com.warehouse.optimizer.controller;

import com.warehouse.optimizer.dto.*;
import com.warehouse.optimizer.service.RecommendationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
                : new ScoringWeights(0.5, 0.35, 0.15);
        return ApiResponse.of(recommendationService.generate(req.warehouseId(), weights));
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

    /** GET /api/v1/recommendations/{warehouseId}/export — download all recommendations as CSV. */
    @GetMapping("/{warehouseId}/export")
    public ResponseEntity<byte[]> export(@PathVariable Long warehouseId) {
        byte[] csv = recommendationService.exportToCsv(warehouseId);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv"));
        headers.setContentDispositionFormData("attachment",
                "recommendations-warehouse-" + warehouseId + ".csv");
        return ResponseEntity.ok().headers(headers).body(csv);
    }
}
