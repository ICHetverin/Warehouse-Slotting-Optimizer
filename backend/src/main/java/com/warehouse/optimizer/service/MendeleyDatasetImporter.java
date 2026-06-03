package com.warehouse.optimizer.service;

import com.opencsv.CSVReader;
import com.opencsv.CSVReaderBuilder;
import com.warehouse.optimizer.model.*;
import com.warehouse.optimizer.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Imports the real-world footwear manufacturing warehouse dataset from Mendeley Data
 * (DOI: 10.17632/pf2w725pw3.1) into the application's data model.
 *
 * <p>The dataset contains:
 * <ul>
 *   <li>208 unique products (SKUs)</li>
 *   <li>2,292 storage locations (slots) across 17 aisles, 4 levels</li>
 *   <li>~32,635 customer orders (~61,277 order lines after size aggregation)</li>
 *   <li>4 storage strategies: Random, Class-Based, Dedicated, Hybrid</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MendeleyDatasetImporter {

    private static final String DATASET_DIR = "datasets/mendeley-footwear/";
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    // Physical parameters from the dataset paper
    private static final BigDecimal PICKING_CAPACITY_KG   = new BigDecimal("612.00");
    private static final BigDecimal REPLENISH_CAPACITY_KG = new BigDecimal("1293.00");
    private static final BigDecimal SMALL_BOX_M3          = new BigDecimal("0.0221"); // 0.381×0.381×0.152
    private static final BigDecimal LARGE_BOX_M3          = new BigDecimal("0.1539"); // 0.787×0.470×0.416
    private static final BigDecimal MIN_WEIGHT_KG         = new BigDecimal("1.200");
    private static final BigDecimal MAX_WEIGHT_KG         = new BigDecimal("2.600");

    private final WarehouseRepository warehouseRepo;
    private final SkuRepository       skuRepo;
    private final SlotRepository      slotRepo;
    private final OrderRepository     orderRepo;
    private final OrderLineRepository orderLineRepo;

    /**
     * Result of a dataset import operation.
     */
    public record ImportResult(
            Long warehouseId,
            int skuCount,
            int slotCount,
            int assignedSlotCount,
            int orderCount,
            int orderLineCount,
            StorageStrategy strategy
    ) {}

    /**
     * Imports the full Mendeley dataset for the given storage strategy.
     *
     * @param strategy which storage assignment to use as the "current" layout
     * @return summary of imported data
     */
    @Transactional
    public ImportResult importDataset(StorageStrategy strategy) {
        log.info("Starting Mendeley dataset import with strategy={}", strategy);
        long t0 = System.currentTimeMillis();

        Warehouse wh = createWarehouse();
        List<Sku> skus = importProducts(wh);
        List<Slot> slots = importStorageLocations(wh);
        int assigned = applyStorageAssignment(wh, slots, skus, strategy);
        int[] orderCounts = importCustomerOrders(wh, skus);

        long t1 = System.currentTimeMillis();
        log.info("Mendeley dataset import complete in {} ms: warehouse={}, skus={}, slots={}, assigned={}, orders={}, lines={}",
                t1 - t0, wh.getId(), skus.size(), slots.size(), assigned, orderCounts[0], orderCounts[1]);

        return new ImportResult(
                wh.getId(), skus.size(), slots.size(), assigned,
                orderCounts[0], orderCounts[1], strategy);
    }

    // ── Warehouse ─────────────────────────────────────────────────────────────

    private Warehouse createWarehouse() {
        return warehouseRepo.save(Warehouse.builder()
                .name("Mendeley Footwear Warehouse")
                .rows(32)
                .columns(34)
                .dockX(0)
                .dockY(0)
                .aisleWidthM(new BigDecimal("1.50"))
                .build());
    }

    // ── Products (SKUs) ───────────────────────────────────────────────────────

    private List<Sku> importProducts(Warehouse wh) {
        List<Sku> skus = new ArrayList<>();
        try (CSVReader csv = openReader("Product.csv", ';')) {
            String[] header = csv.readNext(); // Reference;ABCCOD;Sector
            String[] line;
            while ((line = csv.readNext()) != null) {
                if (line.length < 2) continue;
                String code = line[0].trim();
                String abc  = line[1].trim();
                skus.add(Sku.builder()
                        .warehouse(wh)
                        .code(code)
                        .name(code + " " + abc)
                        .weightKg(deterministicWeight(code))
                        .volumeM3(SMALL_BOX_M3)
                        .category(abc)
                        .build());
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to import Product.csv: " + e.getMessage(), e);
        }
        skuRepo.saveAll(skus);
        log.info("Imported {} SKUs", skus.size());
        return skus;
    }

    /** Deterministic pseudo-random weight in [1.2, 2.6] kg based on SKU code. */
    private BigDecimal deterministicWeight(String code) {
        int hash = code.hashCode();
        double ratio = Math.abs(hash % 1000) / 1000.0;
        double w = MIN_WEIGHT_KG.doubleValue()
                 + ratio * (MAX_WEIGHT_KG.doubleValue() - MIN_WEIGHT_KG.doubleValue());
        return BigDecimal.valueOf(w).setScale(3, RoundingMode.HALF_UP);
    }

    // ── Storage Locations (Slots) ─────────────────────────────────────────────

    private List<Slot> importStorageLocations(Warehouse wh) {
        List<Slot> slots = new ArrayList<>();
        Map<Integer, Integer> xToCol = new LinkedHashMap<>();
        Map<Integer, Integer> yToRow = new LinkedHashMap<>();

        // Two-pass: first collect unique x/y, then build mappings
        List<int[]> rawPositions = new ArrayList<>();
        try (CSVReader csv = openReader("Storage_Location.csv", ',')) {
            String[] header = csv.readNext();
            String[] line;
            while ((line = csv.readNext()) != null) {
                if (line.length < 5) continue;
                int x = Integer.parseInt(line[2].trim());
                int y = Integer.parseInt(line[3].trim());
                int z = Integer.parseInt(line[4].trim());
                rawPositions.add(new int[]{x, y, z});
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to import Storage_Location.csv: " + e.getMessage(), e);
        }

        // Build normalized coordinate mappings
        Set<Integer> xs = new TreeSet<>();
        Set<Integer> ys = new TreeSet<>();
        for (int[] p : rawPositions) {
            xs.add(p[0]);
            ys.add(p[1]);
        }
        int colIdx = 0;
        for (int x : xs) xToCol.put(x, colIdx++);
        int rowIdx = 0;
        for (int y : ys) yToRow.put(y, rowIdx++);

        // Second pass: create slots
        try (CSVReader csv = openReader("Storage_Location.csv", ',')) {
            csv.readNext(); // skip header
            String[] line;
            while ((line = csv.readNext()) != null) {
                if (line.length < 5) continue;
                String label = line[0].trim();
                int x = Integer.parseInt(line[2].trim());
                int y = Integer.parseInt(line[3].trim());
                int z = Integer.parseInt(line[4].trim());

                String zone = label.split("-")[0];
                boolean isReplenishment = (z >= 3);

                slots.add(Slot.builder()
                        .warehouse(wh)
                        .label(label)
                        .row(yToRow.get(y))
                        .col(xToCol.get(x))
                        .level(z)
                        .zone(zone)
                        .capacityKg(isReplenishment ? REPLENISH_CAPACITY_KG : PICKING_CAPACITY_KG)
                        .volumeM3(isReplenishment ? LARGE_BOX_M3 : SMALL_BOX_M3)
                        .build());
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to import Storage_Location.csv (pass 2): " + e.getMessage(), e);
        }

        slotRepo.saveAll(slots);
        log.info("Imported {} slots (x→col mapping={}, y→row mapping={})",
                slots.size(), xToCol.size(), yToRow.size());
        return slots;
    }

    // ── Storage Assignment ────────────────────────────────────────────────────

    private int applyStorageAssignment(Warehouse wh, List<Slot> slots, List<Sku> skus, StorageStrategy strategy) {
        String filename = switch (strategy) {
            case RANDOM       -> "Random_Storage.csv";
            case CLASS_BASED  -> "Class_Based_Storage.csv";
            case DEDICATED    -> "Dedicated_Storage.csv";
            case HYBRID       -> "Hybrid_Storage.csv";
        };
        char delimiter = (strategy == StorageStrategy.RANDOM) ? ',' : ';';

        Map<String, Slot> slotByLabel = slots.stream()
                .collect(Collectors.toMap(Slot::getLabel, s -> s));
        Map<String, Sku> skuByCode = skus.stream()
                .collect(Collectors.toMap(Sku::getCode, s -> s));

        int assigned = 0;
        try (CSVReader csv = openReader(filename, delimiter)) {
            String[] header = csv.readNext();
            String[] line;
            while ((line = csv.readNext()) != null) {
                if (line.length < 2) continue;
                String location = line[0].trim();
                Slot slot = slotByLabel.get(location);
                if (slot == null) continue;

                // Find first non-empty compartment with a valid SKU reference
                Sku assignedSku = null;
                for (int i = 1; i < line.length; i++) {
                    String cell = line[i].trim().replace("\"", "");
                    if (cell.isBlank() || !cell.contains(";")) continue;
                    String ref = cell.substring(0, cell.indexOf(';')).trim();
                    if (ref.isBlank()) continue;
                    Sku sku = skuByCode.get(ref);
                    if (sku != null) {
                        assignedSku = sku;
                        break;
                    }
                }

                if (assignedSku != null) {
                    slot.setCurrentSku(assignedSku);
                    assigned++;
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to apply storage assignment from " + filename + ": " + e.getMessage(), e);
        }

        slotRepo.saveAll(slots);
        log.info("Applied {} assignments using strategy={}", assigned, strategy);
        return assigned;
    }

    // ── Customer Orders ───────────────────────────────────────────────────────

    private int[] importCustomerOrders(Warehouse wh, List<Sku> skus) {
        // Aggregate by (orderNumber, reference) summing quantity
        Map<String, Sku> skuByCode = skus.stream()
                .collect(Collectors.toMap(Sku::getCode, s -> s));

        // (orderNumber, reference) -> [quantity, earliest timestamp string]
        Map<String, OrderAgg> aggMap = new LinkedHashMap<>();

        try (CSVReader csv = openReader("Customer_Order.csv", ';')) {
            String[] header = csv.readNext();
            String[] line;
            while ((line = csv.readNext()) != null) {
                if (line.length < 8) continue;
                String orderNum = line[1].trim();
                String ref      = line[3].trim();
                int qty;
                try {
                    qty = Integer.parseInt(line[5].trim());
                } catch (NumberFormatException ex) {
                    continue; // skip malformed
                }
                if (qty <= 0) continue;
                if (!skuByCode.containsKey(ref)) continue;

                String dateStr = line[6].trim();
                String key = orderNum + "\0" + ref;
                OrderAgg agg = aggMap.computeIfAbsent(key, k -> new OrderAgg(orderNum, ref, qty, dateStr));
                agg.quantity += qty;
                if (dateStr.compareTo(agg.earliestDate) < 0) {
                    agg.earliestDate = dateStr;
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to import Customer_Order.csv: " + e.getMessage(), e);
        }

        // Group by orderNumber
        Map<String, List<OrderAgg>> byOrder = new LinkedHashMap<>();
        for (OrderAgg agg : aggMap.values()) {
            byOrder.computeIfAbsent(agg.orderNumber, k -> new ArrayList<>()).add(agg);
        }

        List<Order> orders = new ArrayList<>(byOrder.size());
        List<OrderLine> lines = new ArrayList<>(aggMap.size());

        for (Map.Entry<String, List<OrderAgg>> entry : byOrder.entrySet()) {
            String orderNum = entry.getKey();
            List<OrderAgg> aggs = entry.getValue();

            // Use earliest date among lines
            String earliest = aggs.stream()
                    .map(a -> a.earliestDate)
                    .min(String::compareTo)
                    .orElse("01/01/2023 00:00");
            Instant ts = parseDate(earliest);

            Order order = Order.builder()
                    .warehouse(wh)
                    .externalId(orderNum)
                    .createdAt(ts)
                    .build();
            orders.add(order);

            for (OrderAgg agg : aggs) {
                Sku sku = skuByCode.get(agg.reference);
                if (sku == null) continue;
                lines.add(OrderLine.builder()
                        .order(order)
                        .sku(sku)
                        .quantity(agg.quantity)
                        .build());
            }
        }

        orderRepo.saveAll(orders);
        orderLineRepo.saveAll(lines);
        log.info("Imported {} orders, {} order lines (from {} raw rows)",
                orders.size(), lines.size(), aggMap.size());
        return new int[]{orders.size(), lines.size()};
    }

    private Instant parseDate(String s) {
        try {
            LocalDateTime ldt = LocalDateTime.parse(s, DATE_FMT);
            return ldt.toInstant(ZoneOffset.UTC);
        } catch (Exception e) {
            log.warn("Failed to parse date '{}', using epoch", s);
            return Instant.EPOCH;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private CSVReader openReader(String filename, char delimiter) throws IOException {
        ClassPathResource resource = new ClassPathResource(DATASET_DIR + filename);
        InputStream is = resource.getInputStream();
        // Skip UTF-8 BOM if present
        PushbackInputStream pbis = new PushbackInputStream(is, 3);
        byte[] bom = new byte[3];
        int read = pbis.read(bom);
        if (read < 3 || bom[0] != (byte) 0xEF || bom[1] != (byte) 0xBB || bom[2] != (byte) 0xBF) {
            pbis.unread(bom, 0, read);
        }
        return new CSVReaderBuilder(new InputStreamReader(pbis, StandardCharsets.UTF_8))
                .withCSVParser(new com.opencsv.CSVParserBuilder().withSeparator(delimiter).build())
                .build();
    }

    private static class OrderAgg {
        final String orderNumber;
        final String reference;
        int quantity;
        String earliestDate;

        OrderAgg(String orderNumber, String reference, int quantity, String earliestDate) {
            this.orderNumber = orderNumber;
            this.reference = reference;
            this.quantity = quantity;
            this.earliestDate = earliestDate;
        }
    }
}
