package com.warehouse.optimizer.dto;

import java.util.Map;

public record ExplanationReason(
        String type,
        String description,
        double value,
        Map<String, Object> detail
) {}
