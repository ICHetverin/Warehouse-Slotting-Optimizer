package com.warehouse.optimizer.controller;

import com.warehouse.optimizer.dto.ApiResponse;
import com.warehouse.optimizer.service.UploadService;
import com.warehouse.optimizer.service.WarehouseAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/upload")
@RequiredArgsConstructor
public class UploadController {

    private final UploadService          uploadService;
    private final WarehouseAccessService accessService;

    @PostMapping("/orders")
    public ApiResponse<Map<String, Integer>> uploadOrders(
            @RequestParam Long warehouseId,
            @RequestParam("file") MultipartFile file) {
        accessService.requireOwned(warehouseId);
        int count = uploadService.importOrders(warehouseId, file);
        return ApiResponse.of(Map.of("imported", count));
    }

    @PostMapping("/layout")
    public ApiResponse<Map<String, Integer>> uploadLayout(
            @RequestParam Long warehouseId,
            @RequestParam("file") MultipartFile file) {
        accessService.requireOwned(warehouseId);
        int count = uploadService.importLayout(warehouseId, file);
        return ApiResponse.of(Map.of("imported", count));
    }

    @PostMapping("/skus")
    public ApiResponse<Map<String, Integer>> uploadSkus(
            @RequestParam Long warehouseId,
            @RequestParam("file") MultipartFile file) {
        accessService.requireOwned(warehouseId);
        int count = uploadService.importSkus(warehouseId, file);
        return ApiResponse.of(Map.of("imported", count));
    }
}
