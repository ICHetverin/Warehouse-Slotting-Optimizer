package com.warehouse.optimizer.controller;

import com.warehouse.optimizer.dto.ApiResponse;
import com.warehouse.optimizer.dto.auth.AuthResponse;
import com.warehouse.optimizer.dto.auth.LoginRequest;
import com.warehouse.optimizer.dto.auth.RegisterRequest;
import com.warehouse.optimizer.security.AppUserPrincipal;
import com.warehouse.optimizer.security.CurrentUser;
import com.warehouse.optimizer.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AuthResponse> register(@RequestBody RegisterRequest req) {
        return ApiResponse.of(authService.register(req));
    }

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@RequestBody LoginRequest req) {
        return ApiResponse.of(authService.login(req));
    }

    /** Returns the current principal (no token). Requires a valid JWT. */
    @GetMapping("/me")
    public ApiResponse<AuthResponse> me() {
        AppUserPrincipal p = CurrentUser.require();
        return ApiResponse.of(new AuthResponse(null, p.userId(), p.email(), p.role().name()));
    }
}
