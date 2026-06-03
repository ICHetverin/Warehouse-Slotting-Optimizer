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
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Импортирует реальный датасет обувного склада (Footwear Warehouse Dataset).
 *
 * <p>Порядок загрузки:
 * <ol>
 *   <li>Support_Points.csv   — определяет координаты депо
 *   <li>Storage_Location.csv — создаёт ячейки (Slot)
 *   <li>Product.csv          — создаёт артикулы (Sku)
 *   <li>Customer_Order.csv   — создаёт заказы (Order + OrderLine)
 *   <li>*_Storage.csv        — начальное назначение SKU→ячейка (опционально)
 * </ol>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DatasetImportService {

    // ── Константы конвертации координат ──────────────────────────────────────
    /** Исходные координаты в сантиметрах, делим на 10 → дм (целые числа сетки) */
    private static final int    COORD_SCALE = 10;
    /** Смещение по y: минимальный y датасета = −29 → после смещения row=0 */
    private static final int    Y_OFFSET    = 29;
    /** Грузоподъёмность ячейки по умолчанию (нет в датасете) */
    private static final double DEFAULT_CAP = 50.0;
    /** Объём артикула по умолчанию (нет в датасете) */
    private static final double DEFAULT_VOL = 0.002;

    /** Формат даты: 19/10/2023 07:18 */
    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    /** Парсер координат "(66.0, -29.0, 1.0)" из Support_Points.csv */
    private static final Pattern COORD_RE =
            Pattern.compile("\\(\\s*([+-]?[\\d.]+)\\s*,\\s*([+-]?[\\d.]+)\\s*,\\s*([+-]?[\\d.]+)\\s*\\)");

    private final WarehouseRepository warehouseRepo;
    private final SlotRepository      slotRepo;
    private final SkuRepository       skuRepo;
    private final OrderRepository     orderRepo;
    private final OrderLineRepository orderLineRepo;

    // ── 1. Support_Points.csv → координаты депо ──────────────────────────────

    /**
     * Парсит Support_Points.csv, находит точки с минимальным y (вход склада),
     * вычисляет позицию депо и обновляет Warehouse.dockX / dockY.
     *
     * <p>Формат файла:
     * <pre>
     * points_specified      labels
     * (66.0, -29.0, 1.0)    LC-01
     * (403.0, -29.0, 1.0)   CC-01
     * </pre>
     */
    @Transactional
    public Map<String, Object> importSupportPoints(Long warehouseId, MultipartFile file) {
        Warehouse wh = requireWarehouse(warehouseId);

        double minY   = Double.MAX_VALUE;
        double sumX   = 0;
        int    countX = 0;

        try (CSVReader csv = reader(file)) {
            csv.readNext(); // пропускаем заголовок

            String[] line;
            while ((line = csv.readNext()) != null) {
                if (line.length < 1) continue;
                // Файл разделён табуляцией, но CSVReader парсит по запятой.
                // Координата "(66.0, -29.0, 1.0)" разбивается на несколько ячеек.
                // Склеиваем обратно через запятую — regex найдёт паттерн в любом случае.
                String fullLine = String.join(",", line);
                Matcher m = COORD_RE.matcher(fullLine);
                if (!m.find()) continue;

                double x = Double.parseDouble(m.group(1));
                double y = Double.parseDouble(m.group(2));

                if (y < minY) {
                    minY   = y;
                    sumX   = x;
                    countX = 1;
                } else if (y == minY) {
                    sumX  += x;
                    countX++;
                }
            }
        } catch (IOException | CsvValidationException e) {
            throw new ScoringException("Ошибка разбора Support_Points.csv: " + e.getMessage(), e);
        }

        if (countX == 0) throw new ScoringException("Support_Points.csv не содержит корректных координат");

        double avgX   = sumX / countX;
        int dockCol   = (int) avgX  / COORD_SCALE;
        int dockRow   = (int)(minY + Y_OFFSET) / COORD_SCALE;

        wh.setDockX(dockCol);
        wh.setDockY(dockRow);
        warehouseRepo.save(wh);

        log.info("Депо склада {}: raw ({}, {}) → сетка row={}, col={}", warehouseId,
                (int) avgX, (int) minY, dockRow, dockCol);

        return Map.of("dockCol", dockCol, "dockRow", dockRow,
                      "rawX",   (int) avgX, "rawY", (int) minY);
    }

    // ── 2. Storage_Location.csv → ячейки склада ──────────────────────────────

    /**
     * Формат файла:
     * <pre>
     * originalLocation  position   x    y  z
     * A-14-11           368, 0, 1  368  0  1
     * </pre>
     *
     * <p>Конвертация:
     * <ul>
     *   <li>col  = x / 10
     *   <li>row  = (y + 29) / 10
     *   <li>level = z
     *   <li>zone  = первая буква метки ("A" из "A-14-11")
     * </ul>
     */
    @Transactional
    public int importStorageLocations(Long warehouseId, MultipartFile file) {
        Warehouse wh = requireWarehouse(warehouseId);
        List<Slot> slots = new ArrayList<>();

        try (CSVReader csv = reader(file)) {
            csv.readNext(); // skip header

            String[] line;
            while ((line = csv.readNext()) != null) {
                if (line.length < 5) continue;
                String label = line[0].trim();
                if (label.isEmpty()) continue;

                int rawX = parseInt(line[2]);
                int rawY = parseInt(line[3]);
                int rawZ = parseInt(line[4]);

                String zone = label.contains("-")
                        ? label.substring(0, label.indexOf('-'))
                        : label.substring(0, Math.min(1, label.length()));

                slots.add(Slot.builder()
                        .warehouse(wh)
                        .label(label)
                        .col(rawX / COORD_SCALE)
                        .row((rawY + Y_OFFSET) / COORD_SCALE)
                        .level(rawZ)
                        .zone(zone)
                        .capacityKg(BigDecimal.valueOf(DEFAULT_CAP))
                        .build());
            }
        } catch (IOException | CsvValidationException e) {
            throw new ScoringException("Ошибка разбора Storage_Location.csv: " + e.getMessage(), e);
        }

        slotRepo.saveAll(slots);
        log.info("Импортировано {} ячеек для склада {}", slots.size(), warehouseId);
        return slots.size();
    }

    // ── 3. Product.csv → артикулы ─────────────────────────────────────────────

    /**
     * Формат файла:
     * <pre>
     * Reference  ABCCOD  Sector
     * TQBVRI     A       Z1
     * </pre>
     *
     * <p>Вес по ABC-классу: A=0.35 кг, B=0.55 кг, C=0.80 кг
     */
    @Transactional
    public int importProducts(Long warehouseId, MultipartFile file) {
        Warehouse wh = requireWarehouse(warehouseId);
        List<Sku> skus = new ArrayList<>();

        try (CSVReader csv = reader(file)) {
            csv.readNext(); // skip header

            String[] line;
            while ((line = csv.readNext()) != null) {
                if (line.length < 1) continue;
                String ref = line[0].trim();
                String abc = line.length > 1 ? line[1].trim() : "B";
                if (ref.isEmpty()) continue;

                skus.add(Sku.builder()
                        .warehouse(wh)
                        .code(ref)
                        .name(ref)
                        .weightKg(BigDecimal.valueOf(weightForAbc(abc))
                                .setScale(3, RoundingMode.HALF_UP))
                        .volumeM3(BigDecimal.valueOf(DEFAULT_VOL))
                        .category(abc.isEmpty() ? "B" : abc)
                        .build());
            }
        } catch (IOException | CsvValidationException e) {
            throw new ScoringException("Ошибка разбора Product.csv: " + e.getMessage(), e);
        }

        skuRepo.saveAll(skus);
        log.info("Импортировано {} артикулов для склада {}", skus.size(), warehouseId);
        return skus.size();
    }

    // ── 4. Customer_Order.csv → заказы ───────────────────────────────────────

    /**
     * Формат файла:
     * <pre>
     * codCustomer  orderNumber  orderToCollect  Reference  Size (US)  quantity (units)  creationDate       waveNumber  operator
     * CUST001      12345        1               TQBVRI     9.5        2                 19/10/2023 07:18   1           OP01
     * </pre>
     *
     * <p>Группировка: строки с одинаковым orderNumber → один Order.
     * SKU привязывается по Reference (без учёта размера).
     */
    @Transactional
    public int importCustomerOrders(Long warehouseId, MultipartFile file) {
        Warehouse wh = requireWarehouse(warehouseId);

        // Группируем строки по номеру заказа
        Map<String, List<String[]>> byOrder = new LinkedHashMap<>();
        Map<String, Instant>        orderTs = new LinkedHashMap<>();

        try (CSVReader csv = reader(file)) {
            csv.readNext(); // skip header

            String[] line;
            while ((line = csv.readNext()) != null) {
                if (line.length < 7) continue;
                String orderNo = line[1].trim();
                if (orderNo.isEmpty()) continue;

                byOrder.computeIfAbsent(orderNo, k -> new ArrayList<>()).add(line);
                final String dateCell = line[6].trim();
                orderTs.computeIfAbsent(orderNo, k -> parseDateTime(dateCell));
            }
        } catch (IOException | CsvValidationException e) {
            throw new ScoringException("Ошибка разбора Customer_Order.csv: " + e.getMessage(), e);
        }

        int imported = 0;
        for (Map.Entry<String, List<String[]>> entry : byOrder.entrySet()) {
            String  orderNo = entry.getKey();
            Instant ts      = orderTs.getOrDefault(orderNo, Instant.now());

            Order order = orderRepo.save(Order.builder()
                    .warehouse(wh)
                    .externalId(orderNo)
                    .createdAt(ts)
                    .build());

            List<OrderLine> lines = new ArrayList<>();
            Set<Long> pickedSkus  = new HashSet<>();

            for (String[] row : entry.getValue()) {
                if (row.length < 6) continue;
                String ref = row[3].trim();
                int    qty = parseInt(row[5]);
                if (ref.isEmpty() || qty <= 0) continue;

                Optional<Sku> skuOpt = skuRepo.findByWarehouseIdAndCode(warehouseId, ref);
                if (skuOpt.isEmpty()) continue;
                if (!pickedSkus.add(skuOpt.get().getId())) continue; // дубль в заказе

                lines.add(OrderLine.builder()
                        .order(order)
                        .sku(skuOpt.get())
                        .quantity(qty)
                        .build());
            }

            if (!lines.isEmpty()) {
                orderLineRepo.saveAll(lines);
                imported++;
            }
        }

        log.info("Импортировано {} заказов для склада {}", imported, warehouseId);
        return imported;
    }

    // ── 5. *_Storage.csv → начальное назначение SKU→ячейка ───────────────────

    /**
     * Поддерживаемые файлы:
     * <ul>
     *   <li>Class_Based_Storage.csv  — колонка Location + ABCCOD
     *   <li>Dedicated_Storage.csv    — колонка Location + XYZCOD
     *   <li>Hybrid_Storage.csv       — колонка Location + XYZCOD
     *   <li>Random_Storage.csv       — колонка originalLocation (без кода класса)
     * </ul>
     *
     * Формат col_1..col_18: {@code TQBVRI;7} (артикул;количество).
     * Берём SKU с максимальным количеством как основной для ячейки.
     */
    @Transactional
    public int importStorageStrategy(Long warehouseId, MultipartFile file) {
        requireWarehouse(warehouseId);

        Map<String, Slot> slotByLabel = new HashMap<>();
        for (Slot s : slotRepo.findByWarehouseId(warehouseId)) {
            slotByLabel.put(s.getLabel(), s);
        }
        if (slotByLabel.isEmpty()) {
            throw new ScoringException("Сначала загрузите Storage_Location.csv");
        }

        int assigned = 0;

        try (CSVReader csv = reader(file)) {
            String[] header = csv.readNext();
            if (header == null) return 0;

            // Автодетект колонок
            int         locIdx  = -1;
            List<Integer> colIdxs = new ArrayList<>();
            for (int i = 0; i < header.length; i++) {
                String h = header[i].trim().toLowerCase();
                if (h.equals("location") || h.equals("originallocation")) locIdx = i;
                if (h.startsWith("col_")) colIdxs.add(i);
            }
            if (locIdx < 0) throw new ScoringException(
                    "Не найдена колонка Location/originalLocation в файле стратегии");
            if (colIdxs.isEmpty()) throw new ScoringException(
                    "Не найдены колонки col_1..col_18 в файле стратегии");

            List<Slot> toSave = new ArrayList<>();
            String[] line;
            while ((line = csv.readNext()) != null) {
                if (line.length <= locIdx) continue;
                String loc  = line[locIdx].trim();
                Slot   slot = slotByLabel.get(loc);
                if (slot == null) continue;

                String bestCode = null;
                int    bestQty  = -1;
                for (int idx : colIdxs) {
                    if (idx >= line.length) continue;
                    String cell = line[idx].trim();
                    if (cell.isEmpty() || !cell.contains(";")) continue;
                    String[] parts = cell.split(";", 2);
                    String code = parts[0].trim();
                    int    qty;
                    try { qty = Integer.parseInt(parts[1].trim()); }
                    catch (NumberFormatException e) { continue; }
                    if (qty > bestQty) { bestQty = qty; bestCode = code; }
                }

                if (bestCode == null) continue;

                Optional<Sku> skuOpt = skuRepo.findByWarehouseIdAndCode(warehouseId, bestCode);
                if (skuOpt.isEmpty()) continue;

                slot.setCurrentSku(skuOpt.get());
                toSave.add(slot);
                assigned++;
            }

            slotRepo.saveAll(toSave);

        } catch (IOException | CsvValidationException e) {
            throw new ScoringException("Ошибка разбора файла стратегии хранения: " + e.getMessage(), e);
        }

        log.info("Назначено {} ячеек для склада {}", assigned, warehouseId);
        return assigned;
    }

    // ── Вспомогательные ──────────────────────────────────────────────────────

    private static double weightForAbc(String abc) {
        if (abc == null || abc.isEmpty()) return 0.55;
        return switch (abc.toUpperCase().charAt(0)) {
            case 'A' -> 0.35;
            case 'C' -> 0.80;
            default  -> 0.55;
        };
    }

    private static Instant parseDateTime(String raw) {
        if (raw == null || raw.isBlank()) return Instant.now();
        try {
            return LocalDateTime.parse(raw.trim(), DATE_FMT).toInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException e) {
            try {
                String iso = raw.trim().endsWith("Z") ? raw.trim() : raw.trim() + "Z";
                return Instant.parse(iso);
            } catch (Exception ex) {
                log.warn("Не удалось распознать дату '{}', используем текущее время", raw);
                return Instant.now();
            }
        }
    }

    private static int parseInt(String s) {
        if (s == null) return 0;
        try { return Integer.parseInt(s.trim()); }
        catch (NumberFormatException e) { return 0; }
    }

    private CSVReader reader(MultipartFile file) throws IOException {
        return new CSVReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8));
    }

    private Warehouse requireWarehouse(Long id) {
        return warehouseRepo.findById(id)
                .orElseThrow(() -> new ScoringException("Склад не найден: " + id));
    }
}
