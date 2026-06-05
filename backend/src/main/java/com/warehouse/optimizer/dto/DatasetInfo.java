package com.warehouse.optimizer.dto;

/**
 * Catalog entry for a ready-to-load example warehouse (shown in the UI gallery).
 *
 * @param key           stable id used in the load endpoint
 * @param title         human title
 * @param source        provenance (dataset + license hint)
 * @param description   short blurb (size, what it demonstrates)
 * @param hasStrategies whether a storage strategy can be chosen (Mendeley only)
 * @param realLayout    whether the layout uses real coordinates vs synthesized
 */
public record DatasetInfo(
        String key,
        String title,
        String source,
        String description,
        boolean hasStrategies,
        boolean realLayout
) {}
