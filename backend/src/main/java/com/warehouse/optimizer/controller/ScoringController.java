package com.warehouse.optimizer.controller;

import com.warehouse.optimizer.dto.*;
import com.warehouse.optimizer.engine.AutoTuningEngine;
import com.warehouse.optimizer.engine.SimulationEngine;
import com.warehouse.optimizer.service.ScoringService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/scoring")
@RequiredArgsConstructor
public class ScoringController {

    private final ScoringService      scoringService;
    private final SimulationEngine    simulationEngine;
    private final AutoTuningEngine    autoTuningEngine;

    /**
     * POST /api/v1/scoring/run
     * Runs greedy assignment for a warehouse and returns the result synchronously.
     */
    @PostMapping("/run")
    public ApiResponse<ScoringRunResponse> run(@RequestBody ScoringRunRequest req) {
        return ApiResponse.of(scoringService.run(req));
    }

    /**
     * GET /api/v1/scoring/results/{jobId}
     * Retrieves a previously computed scoring result by job id.
     */
    @GetMapping("/results/{jobId}")
    public ApiResponse<ScoringRunResponse> result(@PathVariable String jobId) {
        return ApiResponse.of(scoringService.getResult(jobId));
    }

    /**
     * GET /api/v1/scoring/matrix/{warehouseId}
     * Returns the full co-pick affinity matrix for visualization.
     */
    @GetMapping("/matrix/{warehouseId}")
    public ApiResponse<CopickMatrixResponse> matrix(
            @PathVariable Long warehouseId,
            @RequestParam(defaultValue = "90") int days) {
        return ApiResponse.of(scoringService.getCopickMatrix(warehouseId, days));
    }

    /**
     * GET /api/v1/scoring/abcxyz/{warehouseId}
     * Returns ABC/XYZ classification matrix for all SKUs in the warehouse.
     */
    @GetMapping("/abcxyz/{warehouseId}")
    public ApiResponse<AbcXyzMatrixResponse> abcXyz(
            @PathVariable Long warehouseId,
            @RequestParam(defaultValue = "90") int days) {
        return ApiResponse.of(scoringService.getAbcXyzMatrix(warehouseId, days));
    }

    /**
     * PATCH /api/v1/scoring/weights
     * Validates and echoes back the provided weights (client-side storage for MVP).
     */
    @PatchMapping("/weights")
    public ApiResponse<ScoringWeights> updateWeights(@RequestBody ScoringWeights weights) {
        return ApiResponse.of(weights);
    }

    /**
     * POST /api/v1/scoring/simulate
     * What-if simulation: replay historical orders under a proposed layout.
     */
    @PostMapping("/simulate")
    public ApiResponse<SimulationResult> simulate(@RequestBody SimulationRequest req) {
        return ApiResponse.of(simulationEngine.simulate(req));
    }

    /**
     * POST /api/v1/scoring/tune
     * Auto-tune scoring weights via grid search.
     */
    @PostMapping("/tune")
    public ApiResponse<TuningResult> tune(@RequestBody TuningRequest req) {
        return ApiResponse.of(autoTuningEngine.tune(req));
    }
}
