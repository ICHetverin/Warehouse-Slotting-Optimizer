package com.warehouse.optimizer.service;

import com.opencsv.CSVReader;
import com.opencsv.CSVReaderBuilder;
import com.warehouse.optimizer.dto.DatasetInfo;
import com.warehouse.optimizer.exception.NotFoundException;
import com.warehouse.optimizer.model.*;
import com.warehouse.optimizer.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Loads ready-to-demo "example warehouses" from bundled real-world datasets.
 *
 * <p>The footwear set (real CAD layout) is delegated to {@link MendeleyDatasetImporter}.
 * Order-only datasets (UK Online Retail, grocery baskets) are imported from our standard
 * {@code products.csv} / {@code orders.csv} format and get a <b>synthesized</b> warehouse
 * layout (category-banded grid) so there is a concrete "current" placement to optimize.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ExampleDatasetImporter {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final WarehouseRepository warehouseRepo;
    private final SkuRepository       skuRepo;
    private final SlotRepository      slotRepo;
    private final OrderRepository     orderRepo;
    private final OrderLineRepository orderLineRepo;
    private final MendeleyDatasetImporter mendeleyImporter;

    /** The example gallery. */
    public static final List<DatasetInfo> CATALOG = List.of(
            new DatasetInfo("mendeley-footwear", "Обувной склад (Mendeley)",
                    "Mendeley Data · реальные CAD-координаты",
                    "208 SKU, 2 292 ячейки, ~33 тыс. заказов. Реальный layout и 4 стратегии размещения.",
                    true, true),
            new DatasetInfo("online-retail", "Онлайн-ритейл (UCI)",
                    "UCI · Online Retail II",
                    "800 SKU, ~30 тыс. строк заказов. Реальные корзины UK-магазина — velocity и co-pick.",
                    false, false),
            new DatasetInfo("groceries", "Продуктовые корзины",
                    "Groceries (arules)",
                    "169 SKU, 9 835 корзин. Классический market-basket — очень плотный co-pick.",
                    false, false)
    );

    public List<DatasetInfo> catalog() {
        return CATALOG;
    }

    /**
     * Imports an example by key. Footwear delegates to the Mendeley importer; the rest use
     * the generic CSV + synthesized-layout path.
     */
    @Transactional
    public MendeleyDatasetImporter.ImportResult importExample(String key, StorageStrategy strategy) {
        DatasetInfo info = CATALOG.stream().filter(d -> d.key().equals(key)).findFirst()
                .orElseThrow(() -> new NotFoundException("Unknown example dataset: " + key));

        if (info.hasStrategies()) {
            return mendeleyImporter.importDataset(strategy != null ? strategy : StorageStrategy.CLASS_BASED);
        }
        return importGeneric(info);
    }

    // ── Generic CSV import + synthesized layout ────────────────────────────────

    private MendeleyDatasetImporter.ImportResult importGeneric(DatasetInfo info) {
        long t0 = System.currentTimeMillis();
        Warehouse wh = warehouseRepo.save(Warehouse.builder()
                .name(info.title()).rows(1).columns(1).dockX(0).dockY(0)
                .aisleWidthM(new BigDecimal("1.50")).build());

        List<Sku> skus = importProducts(wh, info.key());
        int[] grid = chooseGrid(skus.size());          // {rows, cols, levels}
        List<Slot> slots = synthesizeSlots(wh, grid, skus);
        wh.setRows(grid[0]);
        wh.setColumns(grid[1]);
        warehouseRepo.save(wh);
        int assigned = assignByCategory(slots, skus);
        int[] oc = importOrders(wh, info.key(), skus);

        log.info("Example '{}' imported in {} ms: skus={}, slots={}, assigned={}, orders={}, lines={}",
                info.key(), System.currentTimeMillis() - t0, skus.size(), slots.size(), assigned, oc[0], oc[1]);
        return new MendeleyDatasetImporter.ImportResult(
                wh.getId(), skus.size(), slots.size(), assigned, oc[0], oc[1], null);
    }

    private List<Sku> importProducts(Warehouse wh, String dir) {
        List<Sku> skus = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        try (CSVReader csv = open(dir, "products.csv")) {
            csv.readNext(); // header: code,name,weight_kg,volume_m3,category
            String[] r;
            while ((r = csv.readNext()) != null) {
                if (r.length < 5) continue;
                String code = r[0].trim();
                if (code.isBlank() || !seen.add(code)) continue;
                skus.add(Sku.builder()
                        .warehouse(wh).code(code)
                        .name(r[1].trim().isBlank() ? code : r[1].trim())
                        .weightKg(decimal(r[2], "1.0"))
                        .volumeM3(decimal(r[3], "0.01"))
                        .category(r[4].trim().isBlank() ? "General" : r[4].trim())
                        .build());
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to read products.csv for " + dir + ": " + e.getMessage(), e);
        }
        skuRepo.saveAll(skus);
        return skus;
    }

    /** Square-ish grid with 2 levels sized to ~1.18× the SKU count. */
    private int[] chooseGrid(int n) {
        int levels = 2;
        int cells = (int) Math.ceil(n * 1.18 / levels);
        int cols = Math.max(4, (int) Math.ceil(Math.sqrt(cells * 1.6)));
        int rows = Math.max(4, (int) Math.ceil(cells / (double) cols));
        return new int[]{rows, cols, levels};
    }

    private List<Slot> synthesizeSlots(Warehouse wh, int[] grid, List<Sku> skus) {
        int rows = grid[0], cols = grid[1], levels = grid[2];
        int zones = Math.min(6, Math.max(2, rows / 3));
        List<Slot> slots = new ArrayList<>(rows * cols * levels);
        for (int r = 0; r < rows; r++) {
            String zone = String.valueOf((char) ('A' + Math.min(zones - 1, r * zones / rows)));
            for (int c = 0; c < cols; c++) {
                for (int lvl = 1; lvl <= levels; lvl++) {
                    slots.add(Slot.builder()
                            .warehouse(wh)
                            .label("%s%02d-%02d-L%d".formatted(zone, r, c, lvl))
                            .row(r).col(c).level(lvl).zone(zone)
                            .capacityKg(new BigDecimal("80.00"))
                            .volumeM3(new BigDecimal("0.1200"))
                            .build());
                }
            }
        }
        slotRepo.saveAll(slots);
        return slots;
    }

    /**
     * "Current" placement: group SKUs by category and lay them into slots in row-major
     * order. This is a realistic but velocity-suboptimal layout, leaving headroom empty,
     * so the optimizer has meaningful moves to recommend.
     */
    private int assignByCategory(List<Slot> slots, List<Sku> skus) {
        List<Sku> ordered = skus.stream()
                .sorted(Comparator.comparing(Sku::getCategory, Comparator.nullsLast(String::compareTo))
                        .thenComparing(Sku::getCode))
                .toList();
        int assigned = 0;
        for (int i = 0; i < ordered.size() && i < slots.size(); i++) {
            slots.get(i).setCurrentSku(ordered.get(i));
            assigned++;
        }
        slotRepo.saveAll(slots);
        return assigned;
    }

    private int[] importOrders(Warehouse wh, String dir, List<Sku> skus) {
        Map<String, Sku> byCode = skus.stream().collect(Collectors.toMap(Sku::getCode, s -> s, (a, b) -> a));
        Map<String, Order> orders = new LinkedHashMap<>();
        List<OrderLine> lines = new ArrayList<>();
        try (CSVReader csv = open(dir, "orders.csv")) {
            csv.readNext(); // header: order_id,sku_code,quantity,timestamp
            String[] r;
            while ((r = csv.readNext()) != null) {
                if (r.length < 4) continue;
                Sku sku = byCode.get(r[1].trim());
                if (sku == null) continue;
                int qty;
                try { qty = Integer.parseInt(r[2].trim()); } catch (NumberFormatException e) { continue; }
                if (qty <= 0) continue;
                String oid = r[0].trim();
                Instant ts = parseTs(r[3].trim());
                Order order = orders.computeIfAbsent(oid, k -> Order.builder()
                        .warehouse(wh).externalId(k).createdAt(ts).build());
                lines.add(OrderLine.builder().order(order).sku(sku).quantity(qty).build());
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to read orders.csv for " + dir + ": " + e.getMessage(), e);
        }
        orderRepo.saveAll(orders.values());
        orderLineRepo.saveAll(lines);
        return new int[]{orders.size(), lines.size()};
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private static BigDecimal decimal(String s, String fallback) {
        try { return new BigDecimal(s.trim()); } catch (Exception e) { return new BigDecimal(fallback); }
    }

    private static Instant parseTs(String s) {
        try { return LocalDateTime.parse(s, ISO).toInstant(ZoneOffset.UTC); }
        catch (Exception e) { return Instant.EPOCH; }
    }

    private CSVReader open(String dir, String file) throws IOException {
        var res = new ClassPathResource("datasets/" + dir + "/" + file);
        return new CSVReaderBuilder(new InputStreamReader(res.getInputStream(), StandardCharsets.UTF_8)).build();
    }
}
