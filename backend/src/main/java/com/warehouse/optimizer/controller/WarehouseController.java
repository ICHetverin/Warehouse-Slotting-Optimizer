package com.warehouse.optimizer.controller;

import com.warehouse.optimizer.dto.ApiResponse;
import com.warehouse.optimizer.dto.WarehouseCreateRequest;
import com.warehouse.optimizer.exception.NotFoundException;
import com.warehouse.optimizer.model.Warehouse;
import com.warehouse.optimizer.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/warehouses")
@RequiredArgsConstructor
public class WarehouseController {

    private final WarehouseRepository warehouseRepo;

    @GetMapping
    public ApiResponse<List<Warehouse>> list() {
        return ApiResponse.of(warehouseRepo.findAll());
    }

    @GetMapping("/{id}")
    public ApiResponse<Warehouse> get(@PathVariable Long id) {
        return ApiResponse.of(warehouseRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Warehouse not found: " + id)));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Warehouse> create(@RequestBody WarehouseCreateRequest req) {
        Warehouse wh = Warehouse.builder()
                .name(req.name())
                .rows(req.rows())
                .columns(req.columns())
                .dockX(req.dockX())
                .dockY(req.dockY())
                .aisleWidthM(req.aisleWidthM())
                .build();
        return ApiResponse.of(warehouseRepo.save(wh));
    }
}
