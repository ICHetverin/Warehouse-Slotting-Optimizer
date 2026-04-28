package com.warehouse.optimizer.dto;

import java.util.Map;

public record CopickMatrixResponse(
        Long warehouseId,
        int velocityDays,
        int skuCount,
        int pairCount,
        Map<Long, Map<Long, Double>> matrix
) {}
