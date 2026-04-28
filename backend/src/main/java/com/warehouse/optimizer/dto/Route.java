package com.warehouse.optimizer.dto;

import java.util.List;

/**
 * @param orderedSlotIds  pick-slot IDs in optimal visit order
 * @param totalDistanceM  total route distance in metres
 * @param tripCount       number of cart trips (capacity splits)
 * @param fullPath        complete node sequence for SVG rendering
 *                        (includes dock + all intermediate graph nodes)
 */
public record Route(
        List<Long>  orderedSlotIds,
        double      totalDistanceM,
        int         tripCount,
        List<Long>  fullPath
) {}
