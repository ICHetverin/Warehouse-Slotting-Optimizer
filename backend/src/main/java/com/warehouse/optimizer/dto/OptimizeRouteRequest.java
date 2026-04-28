package com.warehouse.optimizer.dto;

import java.util.List;

public record OptimizeRouteRequest(
        Long        warehouseId,
        List<Long>  skuIds,
        double      cartCapacityKg
) {}
