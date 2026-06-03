package com.warehouse.optimizer.controller;

import com.warehouse.optimizer.dto.ApiResponse;
import com.warehouse.optimizer.dto.WarehouseCreateRequest;
import com.warehouse.optimizer.exception.ForbiddenException;
import com.warehouse.optimizer.exception.NotFoundException;
import com.warehouse.optimizer.model.User;
import com.warehouse.optimizer.model.Warehouse;
import com.warehouse.optimizer.repository.UserRepository;
import com.warehouse.optimizer.repository.WarehouseRepository;
import com.warehouse.optimizer.security.AppUserPrincipal;
import com.warehouse.optimizer.security.CurrentUser;
import com.warehouse.optimizer.service.WarehouseAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/warehouses")
@RequiredArgsConstructor
public class WarehouseController {

    private final WarehouseRepository    warehouseRepo;
    private final UserRepository         userRepo;
    private final WarehouseAccessService accessService;

    /** Lists warehouses visible to the caller: own (USER), all (ADMIN), or demo (GUEST). */
    @GetMapping
    public ApiResponse<List<Warehouse>> list() {
        AppUserPrincipal me = CurrentUser.require();
        if (me.isAdmin()) {
            return ApiResponse.of(warehouseRepo.findAll());
        }
        if (me.isGuest()) {
            return ApiResponse.of(warehouseRepo.findByDemoTrueOrderByCreatedAtDesc());
        }
        return ApiResponse.of(warehouseRepo.findByOwnerIdOrderByCreatedAtDesc(me.userId()));
    }

    @GetMapping("/{id}")
    public ApiResponse<Warehouse> get(@PathVariable Long id) {
        return ApiResponse.of(accessService.requireReadable(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Warehouse> create(@RequestBody WarehouseCreateRequest req) {
        AppUserPrincipal me = CurrentUser.require();
        if (me.isGuest()) {
            throw new ForbiddenException("Демо-режим доступен только для просмотра — войдите, чтобы создать склад");
        }
        User owner = userRepo.findById(me.userId())
                .orElseThrow(() -> new NotFoundException("User not found: " + me.userId()));

        Warehouse wh = Warehouse.builder()
                .name(req.name())
                .rows(req.rows())
                .columns(req.columns())
                .dockX(req.dockX())
                .dockY(req.dockY())
                .aisleWidthM(req.aisleWidthM())
                .owner(owner)
                .demo(false)
                .build();
        return ApiResponse.of(warehouseRepo.save(wh));
    }
}
