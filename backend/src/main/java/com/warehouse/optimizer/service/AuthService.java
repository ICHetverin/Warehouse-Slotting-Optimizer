package com.warehouse.optimizer.service;

import com.warehouse.optimizer.dto.auth.AuthResponse;
import com.warehouse.optimizer.dto.auth.LoginRequest;
import com.warehouse.optimizer.dto.auth.RegisterRequest;
import com.warehouse.optimizer.exception.ConflictException;
import com.warehouse.optimizer.exception.UnauthorizedException;
import com.warehouse.optimizer.model.Role;
import com.warehouse.optimizer.model.User;
import com.warehouse.optimizer.repository.UserRepository;
import com.warehouse.optimizer.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository  userRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtService      jwtService;

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        String email = normalizeEmail(req.email());
        validateCredentials(email, req.password());

        if (userRepo.existsByEmail(email)) {
            throw new ConflictException("Пользователь с таким email уже существует");
        }

        // First registered account becomes ADMIN; everyone else is a regular USER.
        Role role = userRepo.count() == 0 ? Role.ADMIN : Role.USER;

        User user = userRepo.save(User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(req.password()))
                .role(role)
                .build());

        log.info("Registered user id={} email={} role={}", user.getId(), email, role);
        return token(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest req) {
        String email = normalizeEmail(req.email());
        User user = userRepo.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException("Неверный email или пароль"));

        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("Неверный email или пароль");
        }
        return token(user);
    }

    private AuthResponse token(User user) {
        return new AuthResponse(jwtService.issue(user), user.getId(), user.getEmail(), user.getRole().name());
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private static void validateCredentials(String email, String password) {
        if (email.isBlank() || !email.contains("@")) {
            throw new IllegalArgumentException("Введите корректный email");
        }
        if (password == null || password.length() < 6) {
            throw new IllegalArgumentException("Пароль должен быть не короче 6 символов");
        }
    }
}
