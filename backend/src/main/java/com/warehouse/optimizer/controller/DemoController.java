package com.warehouse.optimizer.controller;

import com.warehouse.optimizer.dto.ApiResponse;
import com.warehouse.optimizer.dto.DemoSeedResponse;
import com.warehouse.optimizer.security.JwtService;
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
    private final JwtService jwtService;

    /**
     * POST /api/v1/demo/seed  (public)
     * Seeds the shared demo warehouse (1 000 SKUs, 500 slots, 10 000 orders) if absent and
     * returns a short-lived GUEST token so the visitor can explore the demo without signing up.
     * Idempotent — safe to call multiple times.
     */
    @PostMapping("/seed")
    public ApiResponse<DemoSeedResponse> seed() {
        Long warehouseId = dataSeeder.seedDemoWarehouse();
        String guestToken = jwtService.issueGuest();
        return ApiResponse.of(new DemoSeedResponse(warehouseId, guestToken, "Demo warehouse ready"));
    }
}
