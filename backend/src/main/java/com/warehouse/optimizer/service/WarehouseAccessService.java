package com.warehouse.optimizer.service;

import com.warehouse.optimizer.exception.ForbiddenException;
import com.warehouse.optimizer.exception.NotFoundException;
import com.warehouse.optimizer.model.User;
import com.warehouse.optimizer.model.Warehouse;
import com.warehouse.optimizer.repository.WarehouseRepository;
import com.warehouse.optimizer.security.AppUserPrincipal;
import com.warehouse.optimizer.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Central authorization guard for warehouse-scoped operations.
 *
 * <ul>
 *   <li><b>read</b>  — ADMIN (any), owner (own), anyone (demo warehouses).</li>
 *   <li><b>write/own</b> — ADMIN (any) or the owner only. Demo & guests are read-only.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class WarehouseAccessService {

    private final WarehouseRepository warehouseRepo;

    /** Loads a warehouse the current principal is allowed to <i>read</i>, or throws 403/404. */
    @Transactional(readOnly = true)
    public Warehouse requireReadable(Long warehouseId) {
        Warehouse wh = load(warehouseId);
        AppUserPrincipal me = CurrentUser.require();

        if (me.isAdmin())  return wh;
        if (wh.isDemo())   return wh;          // demo is a shared sandbox, readable by anyone
        if (isOwner(wh, me)) return wh;

        throw new ForbiddenException("Нет доступа к складу " + warehouseId);
    }

    /**
     * Loads a warehouse the current principal <i>owns</i> (data-ingestion ops), or throws 403/404.
     * Only the owner or an admin may upload/import data. The shared demo warehouse is
     * pre-seeded and read-only here.
     */
    @Transactional(readOnly = true)
    public Warehouse requireOwned(Long warehouseId) {
        Warehouse wh = load(warehouseId);
        AppUserPrincipal me = CurrentUser.require();

        if (me.isAdmin())    return wh;
        if (isOwner(wh, me)) return wh;

        throw new ForbiddenException("Недостаточно прав для изменения склада " + warehouseId);
    }

    private Warehouse load(Long warehouseId) {
        return warehouseRepo.findById(warehouseId)
                .orElseThrow(() -> new NotFoundException("Warehouse not found: " + warehouseId));
    }

    private static boolean isOwner(Warehouse wh, AppUserPrincipal me) {
        User owner = wh.getOwner();
        return owner != null && me.userId() != null && owner.getId().equals(me.userId());
    }
}
