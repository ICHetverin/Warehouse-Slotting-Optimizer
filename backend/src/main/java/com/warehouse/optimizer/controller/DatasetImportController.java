package com.warehouse.optimizer.controller;

import com.warehouse.optimizer.dto.ApiResponse;
import com.warehouse.optimizer.service.DatasetImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * Эндпоинты для загрузки реального датасета обувного склада.
 *
 * <p>Порядок вызовов:
 * <ol>
 *   <li>POST /api/v1/warehouses                       — создать склад
 *   <li>POST /api/v1/import/support-points            — определить депо
 *   <li>POST /api/v1/import/storage-locations         — загрузить ячейки
 *   <li>POST /api/v1/import/products                  — загрузить артикулы
 *   <li>POST /api/v1/import/customer-orders           — загрузить заказы
 *   <li>POST /api/v1/import/storage-strategy          — начальное назначение (опционально)
 * </ol>
 */
@RestController
@RequestMapping("/api/v1/import")
@RequiredArgsConstructor
public class DatasetImportController {

    private final DatasetImportService importService;

    /** Шаг 1 — Support_Points.csv: определяет координаты депо */
    @PostMapping("/support-points")
    public ApiResponse<Map<String, Object>> supportPoints(
            @RequestParam Long warehouseId,
            @RequestParam("file") MultipartFile file) {
        return ApiResponse.of(importService.importSupportPoints(warehouseId, file));
    }

    /** Шаг 2 — Storage_Location.csv: создаёт ячейки склада (Slot) */
    @PostMapping("/storage-locations")
    public ApiResponse<Map<String, Integer>> storageLocations(
            @RequestParam Long warehouseId,
            @RequestParam("file") MultipartFile file) {
        return ApiResponse.of(Map.of("imported", importService.importStorageLocations(warehouseId, file)));
    }

    /** Шаг 3 — Product.csv: создаёт артикулы (Sku) */
    @PostMapping("/products")
    public ApiResponse<Map<String, Integer>> products(
            @RequestParam Long warehouseId,
            @RequestParam("file") MultipartFile file) {
        return ApiResponse.of(Map.of("imported", importService.importProducts(warehouseId, file)));
    }

    /** Шаг 4 — Customer_Order.csv: создаёт заказы (Order + OrderLine) */
    @PostMapping("/customer-orders")
    public ApiResponse<Map<String, Integer>> customerOrders(
            @RequestParam Long warehouseId,
            @RequestParam("file") MultipartFile file) {
        return ApiResponse.of(Map.of("imported", importService.importCustomerOrders(warehouseId, file)));
    }

    /** Шаг 5 — *_Storage.csv: начальное назначение SKU → ячейка (опционально) */
    @PostMapping("/storage-strategy")
    public ApiResponse<Map<String, Integer>> storageStrategy(
            @RequestParam Long warehouseId,
            @RequestParam("file") MultipartFile file) {
        return ApiResponse.of(Map.of("assigned", importService.importStorageStrategy(warehouseId, file)));
    }
}
