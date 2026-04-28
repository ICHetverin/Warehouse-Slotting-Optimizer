package com.warehouse.optimizer.dto;

import java.time.Instant;

public record ApiResponse<T>(T data, Meta meta) {

    public record Meta(Instant timestamp, String version) {}

    public static <T> ApiResponse<T> of(T data) {
        return new ApiResponse<>(data, new Meta(Instant.now(), "1.0"));
    }
}
