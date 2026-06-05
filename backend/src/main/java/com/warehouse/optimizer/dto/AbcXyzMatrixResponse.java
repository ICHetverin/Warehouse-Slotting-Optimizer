package com.warehouse.optimizer.dto;

import java.util.List;
import java.util.Map;

/**
 * Aggregated ABC/XYZ matrix for a warehouse.
 *
 * @param warehouseId   warehouse id
 * @param totalSkus     total number of SKUs analyzed
 * @param matrix        count of SKUs per cell, e.g. matrix["A"]["X"] = 42
 * @param profiles      full list of individual SKU profiles
 */
public record AbcXyzMatrixResponse(
        Long warehouseId,
        int totalSkus,
        Map<String, Map<String, Long>> matrix,
        List<AbcXyzProfile> profiles
) {}
