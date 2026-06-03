package com.warehouse.optimizer.model;

/**
 * Storage strategy variants from the Mendeley footwear dataset.
 * Each strategy represents a different product-to-slot assignment policy
 * that can be imported as the "current" layout for benchmarking.
 */
public enum StorageStrategy {
    RANDOM,
    CLASS_BASED,
    DEDICATED,
    HYBRID
}
