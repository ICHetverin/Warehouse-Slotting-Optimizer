package com.warehouse.optimizer.dto;

import java.util.List;

public record ExplanationDetail(
        String skuCode,
        String fromSlot,
        String toSlot,
        double scoreBefore,
        double scoreAfter,
        List<ExplanationReason> reasons,
        ExplanationImpact impact
) {}
