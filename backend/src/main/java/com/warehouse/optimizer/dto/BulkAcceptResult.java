package com.warehouse.optimizer.dto;

/**
 * Outcome of applying many recommendations at once.
 *
 * @param applied number of moves actually applied to the layout
 * @param skipped number skipped due to slot conflicts (target already taken this batch)
 * @param total   number of candidate recommendations considered
 */
public record BulkAcceptResult(int applied, int skipped, int total) {}
