package com.warehouse.optimizer.dto;

/**
 * ABC/XYZ classification profile for a single SKU.
 *
 * @param skuId          internal SKU id
 * @param skuCode        human-readable SKU code
 * @param abcClass       'A' (top ~80% picks), 'B' (~15%), 'C' (~5%)
 * @param xyzClass       'X' (stable, CV < 0.5), 'Y' (moderate), 'Z' (volatile, CV > 1.0)
 * @param velocityScore  normalized velocity [0, 1]
 * @param stabilityCv    coefficient of variation (σ / μ) of weekly picks
 * @param pickCount      total distinct orders containing this SKU in the analysis window
 */
public record AbcXyzProfile(
        Long skuId,
        String skuCode,
        char abcClass,
        char xyzClass,
        double velocityScore,
        double stabilityCv,
        long pickCount
) {}
