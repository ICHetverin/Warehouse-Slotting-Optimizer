package com.warehouse.optimizer.security;

import com.warehouse.optimizer.model.Role;
import com.warehouse.optimizer.model.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

/**
 * Issues and validates stateless JWTs. The token carries everything needed to rebuild
 * the {@link AppUserPrincipal} (subject=email, {@code uid}, {@code role}) so no DB hit
 * is required to authenticate a request.
 */
@Service
public class JwtService {

    private final SecretKey key;
    private final long       expirySeconds;
    private final long       guestExpirySeconds;

    public JwtService(
            @Value("${app.jwt.secret:change-me-in-prod-please-use-a-long-random-secret-string}") String secret,
            @Value("${app.jwt.expiry-seconds:86400}")       long expirySeconds,
            @Value("${app.jwt.guest-expiry-seconds:7200}")  long guestExpirySeconds) {
        // HS256 needs >= 256-bit key; pad short secrets so dev defaults still work.
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            byte[] padded = new byte[32];
            System.arraycopy(bytes, 0, padded, 0, bytes.length);
            bytes = padded;
        }
        this.key                = Keys.hmacShaKeyFor(bytes);
        this.expirySeconds      = expirySeconds;
        this.guestExpirySeconds = guestExpirySeconds;
    }

    /** Token for a registered user. */
    public String issue(User user) {
        return build(user.getEmail(), user.getId(), user.getRole(), expirySeconds);
    }

    /** Short-lived token for an anonymous demo (GUEST) session — no DB user. */
    public String issueGuest() {
        return build("guest@demo.local", null, Role.GUEST, guestExpirySeconds);
    }

    private String build(String email, Long uid, Role role, long ttlSeconds) {
        Instant now = Instant.now();
        var builder = Jwts.builder()
                .subject(email)
                .claim("role", role.name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(ttlSeconds)))
                .signWith(key);
        if (uid != null) builder.claim("uid", uid);
        return builder.compact();
    }

    /** Parses and validates a token, returning the principal, or throws if invalid/expired. */
    public AppUserPrincipal parse(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        String email = claims.getSubject();
        Role   role  = Role.valueOf(claims.get("role", String.class));
        Number uid   = claims.get("uid", Number.class);
        return new AppUserPrincipal(uid != null ? uid.longValue() : null, email, role);
    }
}
