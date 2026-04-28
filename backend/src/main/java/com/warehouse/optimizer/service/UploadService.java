package com.warehouse.optimizer.service;

import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvValidationException;
import com.warehouse.optimizer.exception.ScoringException;
import com.warehouse.optimizer.model.*;
import com.warehouse.optimizer.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class UploadService {

    private final WarehouseRepository warehouseRepo;
    private final SkuRepository       skuRepo;
    private final SlotRepository      slotRepo;
    private final OrderRepository     orderRepo;
    private final OrderLineRepository orderLineRepo;

    // ── Orders CSV ────────────────────────────────────────────────────────────
    // Expected header: order_id,sku_code,quantity,timestamp

    @Transactional
    public int importOrders(Long warehouseId, MultipartFile file) {
        Warehouse wh = requireWarehouse(warehouseId);
        int imported = 0;

        try (CSVReader csv = reader(file)) {
            String[] header = csv.readNext(); // skip header
            validateHeader(header, new String[]{"order_id", "sku_code", "quantity", "timestamp"});

            String[] line;
            Order currentOrder = null;
            List<OrderLine> lineBuffer = new ArrayList<>();

            while ((line = csv.readNext()) != null) {
                if (line.length < 4) continue;

                String  externalId = line[0].trim();
                String  skuCode    = line[1].trim();
                int     qty        = Integer.parseInt(line[2].trim());
                Instant ts         = Instant.parse(line[3].trim());

                // Reuse or create Order entity
                if (currentOrder == null || !currentOrder.getExternalId().equals(externalId)) {
                    if (currentOrder != null) {
                        orderRepo.save(currentOrder);
                        orderLineRepo.saveAll(lineBuffer);
                        lineBuffer.clear();
                        imported++;
                    }
                    currentOrder = Order.builder()
                            .warehouse(wh)
                            .externalId(externalId)
                            .createdAt(ts)
                            .build();
                }

                Sku sku = skuRepo.findByWarehouseIdAndCode(warehouseId, skuCode)
                        .orElseThrow(() -> new ScoringException("SKU not found: " + skuCode));

                Order finalOrder = currentOrder;
                lineBuffer.add(OrderLine.builder()
                        .order(finalOrder)
                        .sku(sku)
                        .quantity(qty)
                        .build());
            }

            if (currentOrder != null) {
                orderRepo.save(currentOrder);
                orderLineRepo.saveAll(lineBuffer);
                imported++;
            }

        } catch (IOException | CsvValidationException e) {
            throw new ScoringException("Failed to parse orders CSV: " + e.getMessage(), e);
        }

        log.info("Imported {} orders for warehouse={}", imported, warehouseId);
        return imported;
    }

    // ── Layout CSV ────────────────────────────────────────────────────────────
    // Expected header: slot_label,row,col,level,zone,capacity_kg

    @Transactional
    public int importLayout(Long warehouseId, MultipartFile file) {
        Warehouse wh = requireWarehouse(warehouseId);
        List<Slot> slots = new ArrayList<>();

        try (CSVReader csv = reader(file)) {
            String[] header = csv.readNext();
            validateHeader(header, new String[]{"slot_label", "row", "col", "level", "zone", "capacity_kg"});

            String[] line;
            while ((line = csv.readNext()) != null) {
                if (line.length < 6) continue;

                slots.add(Slot.builder()
                        .warehouse(wh)
                        .label(line[0].trim())
                        .row(Integer.parseInt(line[1].trim()))
                        .col(Integer.parseInt(line[2].trim()))
                        .level(Integer.parseInt(line[3].trim()))
                        .zone(line[4].trim())
                        .capacityKg(new BigDecimal(line[5].trim()))
                        .build());
            }

        } catch (IOException | CsvValidationException e) {
            throw new ScoringException("Failed to parse layout CSV: " + e.getMessage(), e);
        }

        slotRepo.saveAll(slots);
        log.info("Imported {} slots for warehouse={}", slots.size(), warehouseId);
        return slots.size();
    }

    // ── SKUs CSV ─────────────────────────────────────────────────────────────
    // Expected header: code,name,weight_kg,volume_m3,category

    @Transactional
    public int importSkus(Long warehouseId, MultipartFile file) {
        Warehouse wh = requireWarehouse(warehouseId);
        List<Sku> skus = new ArrayList<>();

        try (CSVReader csv = reader(file)) {
            String[] header = csv.readNext();
            validateHeader(header, new String[]{"code", "name", "weight_kg"});

            String[] line;
            while ((line = csv.readNext()) != null) {
                if (line.length < 3) continue;

                skus.add(Sku.builder()
                        .warehouse(wh)
                        .code(line[0].trim())
                        .name(line[1].trim())
                        .weightKg(new BigDecimal(line[2].trim()))
                        .volumeM3(line.length > 3 && !line[3].isBlank() ? new BigDecimal(line[3].trim()) : null)
                        .category(line.length > 4 ? line[4].trim() : null)
                        .build());
            }

        } catch (IOException | CsvValidationException e) {
            throw new ScoringException("Failed to parse SKUs CSV: " + e.getMessage(), e);
        }

        skuRepo.saveAll(skus);
        log.info("Imported {} SKUs for warehouse={}", skus.size(), warehouseId);
        return skus.size();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private CSVReader reader(MultipartFile file) throws IOException {
        return new CSVReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8));
    }

    private void validateHeader(String[] actual, String[] expected) {
        if (actual == null) throw new ScoringException("CSV file is empty");
        for (int i = 0; i < expected.length; i++) {
            if (i >= actual.length || !actual[i].trim().equalsIgnoreCase(expected[i])) {
                throw new ScoringException(
                        "Invalid CSV header at column %d: expected '%s', got '%s'"
                                .formatted(i, expected[i], i < actual.length ? actual[i] : "<missing>"));
            }
        }
    }

    private Warehouse requireWarehouse(Long warehouseId) {
        return warehouseRepo.findById(warehouseId)
                .orElseThrow(() -> new ScoringException("Warehouse not found: " + warehouseId));
    }
}
