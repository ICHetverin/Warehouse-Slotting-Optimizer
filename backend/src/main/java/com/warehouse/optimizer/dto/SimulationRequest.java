package com.warehouse.optimizer.dto;

import java.util.Map;

/**
 * Request to run a what-if simulation.
 *
 * @param warehouseId          target warehouse
 * @param proposedAssignments  skuId → proposed slotId overrides (remaining keep current)
 * @param sampleSize           max number of historical orders to replay (default 100)
 */
public record SimulationRequest(
        Long warehouseId,
        Map<Long, Long> proposedAssignments,
        Integer sampleSize
) {}
