package com.warehouse.optimizer.dto;

/** Demo bootstrap result. {@code token} is a short-lived GUEST JWT so the demo works without sign-up. */
public record DemoSeedResponse(Long warehouseId, String token, String message) {}
