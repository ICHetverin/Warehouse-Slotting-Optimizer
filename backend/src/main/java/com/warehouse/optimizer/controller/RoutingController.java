package com.warehouse.optimizer.controller;

import com.warehouse.optimizer.dto.*;
import com.warehouse.optimizer.service.RoutingService;
import com.warehouse.optimizer.service.WarehouseAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/routing")
@RequiredArgsConstructor
public class RoutingController {

    private final RoutingService         routingService;
    private final WarehouseAccessService accessService;

    /**
     * POST /api/v1/routing/optimize
     * Returns the optimal pick route for the given SKU list.
     */
    @PostMapping("/optimize")
    public ApiResponse<Route> optimize(@RequestBody OptimizeRouteRequest req) {
        accessService.requireReadable(req.warehouseId());
        return ApiResponse.of(routingService.optimizeRoute(req));
    }

    /**
     * POST /api/v1/routing/compare
     * Compares current vs proposed slot arrangement for the same pick list.
     */
    @PostMapping("/compare")
    public ApiResponse<RouteComparison> compare(@RequestBody CompareRoutesRequest req) {
        accessService.requireReadable(req.warehouseId());
        return ApiResponse.of(routingService.compareRoutes(req));
    }

    /**
     * GET /api/v1/routing/graph/{warehouseId}
     * Returns the full warehouse graph (nodes + edges) for visualisation.
     */
    @GetMapping("/graph/{warehouseId}")
    public ApiResponse<WarehouseGraphResponse> graph(@PathVariable Long warehouseId) {
        accessService.requireReadable(warehouseId);
        return ApiResponse.of(routingService.getWarehouseGraph(warehouseId));
    }
}
