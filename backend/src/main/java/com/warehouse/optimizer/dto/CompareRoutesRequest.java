package com.warehouse.optimizer.dto;

import java.util.List;
import java.util.Map;

public record CompareRoutesRequest(
        Long              warehouseId,
        List<Long>        skuIds,
        double            cartCapacityKg,
        Map<Long, Long>   currentSlots,   // skuId → slotId
        Map<Long, Long>   proposedSlots   // skuId → slotId
) {}
