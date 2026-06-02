package com.warehouse.optimizer.controller;

import com.warehouse.optimizer.dto.ApiResponse;
import com.warehouse.optimizer.dto.DemoSeedResponse;
import com.warehouse.optimizer.service.DataSeeder;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/demo")
@RequiredArgsConstructor
public class DemoController {

    private final DataSeeder dataSeeder;

    /**
     * POST /api/v1/demo/seed
     * Seeds a demo warehouse (1 000 SKUs, 500 slots, 10 000 orders) if not already present.
     * Idempotent — safe to call multiple times.
     */
    @PostMapping("/seed")
    public ApiResponse<DemoSeedResponse> seed() {
        Long warehouseId = dataSeeder.seedDemoWarehouse();
        return ApiResponse.of(new DemoSeedResponse(warehouseId, "Demo warehouse ready"));
    }
}
