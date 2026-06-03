package com.warehouse.optimizer.model;

/**
 * Application roles.
 * <ul>
 *   <li>{@code USER}  — sees and manages only warehouses they own.</li>
 *   <li>{@code ADMIN} — sees and manages every warehouse.</li>
 *   <li>{@code GUEST} — transient demo principal; may read/play with demo warehouses only.
 *       Never persisted to the {@code users} table.</li>
 * </ul>
 */
public enum Role {
    USER,
    ADMIN,
    GUEST
}
