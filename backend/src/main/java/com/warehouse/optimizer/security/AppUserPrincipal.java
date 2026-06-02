package com.warehouse.optimizer.security;

import com.warehouse.optimizer.model.Role;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/**
 * Authenticated principal reconstructed purely from JWT claims (stateless — no DB lookup
 * per request). {@code userId} is {@code null} for transient {@link Role#GUEST} demo sessions.
 */
public record AppUserPrincipal(Long userId, String email, Role role) implements UserDetails {

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }

    public boolean isGuest() {
        return role == Role.GUEST;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override public String getPassword()                { return null; }
    @Override public String getUsername()                { return email; }
    @Override public boolean isAccountNonExpired()       { return true; }
    @Override public boolean isAccountNonLocked()        { return true; }
    @Override public boolean isCredentialsNonExpired()   { return true; }
    @Override public boolean isEnabled()                 { return true; }
}
