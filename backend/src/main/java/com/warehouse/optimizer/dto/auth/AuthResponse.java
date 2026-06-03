package com.warehouse.optimizer.dto.auth;

/** Returned on register/login and from /auth/me. {@code token} is null for /me. */
public record AuthResponse(String token, Long userId, String email, String role) {}
