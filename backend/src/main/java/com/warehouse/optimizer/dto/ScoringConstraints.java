package com.warehouse.optimizer.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

/**
 * Optional constraints for the greedy assignment.
 *
 * @param familyToZone           preferred zone per SKU category (soft constraint)
 * @param enableFamilyGrouping   if true, SKU of the same category gets a proximity bonus
 * @param maxAClassPerZone       congestion limit: max A-class SKUs per zone (0 = disabled)
 * @param familyAffinityWeight   bonus weight for family grouping (default 0.15)
 * @param congestionPenalty      penalty weight for exceeding maxAClassPerZone (default 0.3)
 */
public record ScoringConstraints(
        Map<String, String> familyToZone,
        boolean enableFamilyGrouping,
        int maxAClassPerZone,
        double familyAffinityWeight,
        double congestionPenalty
) {

    public static final ScoringConstraints DEFAULT = new ScoringConstraints(
            Map.of(), false, 0, 0.15, 0.3);

    @JsonCreator
    public ScoringConstraints(
            @JsonProperty("familyToZone") Map<String, String> familyToZone,
            @JsonProperty("enableFamilyGrouping") Boolean enableFamilyGrouping,
            @JsonProperty("maxAClassPerZone") Integer maxAClassPerZone,
            @JsonProperty("familyAffinityWeight") Double familyAffinityWeight,
            @JsonProperty("congestionPenalty") Double congestionPenalty) {
        this(
            familyToZone != null ? familyToZone : Map.of(),
            enableFamilyGrouping != null ? enableFamilyGrouping : false,
            maxAClassPerZone != null ? maxAClassPerZone : 0,
            familyAffinityWeight != null ? familyAffinityWeight : 0.15,
            congestionPenalty != null ? congestionPenalty : 0.3
        );
    }
}
