package com.warehouse.optimizer.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

/** Convenience accessor for the authenticated {@link AppUserPrincipal}. */
public final class CurrentUser {

    private CurrentUser() {}

    public static Optional<AppUserPrincipal> get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AppUserPrincipal p) {
            return Optional.of(p);
        }
        return Optional.empty();
    }

    public static AppUserPrincipal require() {
        return get().orElseThrow(() ->
                new org.springframework.security.access.AccessDeniedException("Not authenticated"));
    }
}
