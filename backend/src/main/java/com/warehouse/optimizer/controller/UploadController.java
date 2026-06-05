package com.warehouse.optimizer.controller;

import com.warehouse.optimizer.dto.ApiResponse;
import com.warehouse.optimizer.dto.DatasetInfo;
import com.warehouse.optimizer.model.StorageStrategy;
import com.warehouse.optimizer.service.ExampleDatasetImporter;
import com.warehouse.optimizer.service.MendeleyDatasetImporter;
import com.warehouse.optimizer.service.UploadService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/upload")
@RequiredArgsConstructor
public class UploadController {

    private final UploadService uploadService;
    private final MendeleyDatasetImporter mendeleyImporter;
    private final ExampleDatasetImporter exampleImporter;

    @PostMapping("/orders")
    public ApiResponse<Map<String, Integer>> uploadOrders(
            @RequestParam Long warehouseId,
            @RequestParam("file") MultipartFile file) {
        int count = uploadService.importOrders(warehouseId, file);
        return ApiResponse.of(Map.of("imported", count));
    }

    @PostMapping("/layout")
    public ApiResponse<Map<String, Integer>> uploadLayout(
            @RequestParam Long warehouseId,
            @RequestParam("file") MultipartFile file) {
        int count = uploadService.importLayout(warehouseId, file);
        return ApiResponse.of(Map.of("imported", count));
    }

    @PostMapping("/skus")
    public ApiResponse<Map<String, Integer>> uploadSkus(
            @RequestParam Long warehouseId,
            @RequestParam("file") MultipartFile file) {
        int count = uploadService.importSkus(warehouseId, file);
        return ApiResponse.of(Map.of("imported", count));
    }

    @PostMapping("/mendeley")
    public ApiResponse<MendeleyDatasetImporter.ImportResult> importMendeley(
            @RequestParam(defaultValue = "RANDOM") StorageStrategy strategy) {
        return ApiResponse.of(mendeleyImporter.importDataset(strategy));
    }

    /** GET /api/v1/upload/examples — gallery of ready-to-load example warehouses. */
    @GetMapping("/examples")
    public ApiResponse<List<DatasetInfo>> listExamples() {
        return ApiResponse.of(exampleImporter.catalog());
    }

    /** POST /api/v1/upload/examples/{key} — load one example (optional strategy for Mendeley). */
    @PostMapping("/examples/{key}")
    public ApiResponse<MendeleyDatasetImporter.ImportResult> importExample(
            @PathVariable String key,
            @RequestParam(required = false) StorageStrategy strategy) {
        return ApiResponse.of(exampleImporter.importExample(key, strategy));
    }
}
