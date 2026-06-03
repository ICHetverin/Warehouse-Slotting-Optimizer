package com.warehouse.optimizer.service;

import com.warehouse.optimizer.model.*;
import com.warehouse.optimizer.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Seeds a demo warehouse with 1 000 SKUs, 500 slots, and 10 000 orders.
 * Activated by setting SEED_DATA=true (or app.seed.enabled=true in config).
 * Skipped if a warehouse named "Demo Warehouse" already exists.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private final WarehouseRepository warehouseRepo;
    private final SkuRepository       skuRepo;
    private final SlotRepository      slotRepo;
    private final OrderRepository     orderRepo;
    private final OrderLineRepository orderLineRepo;

    @Value("${app.seed.enabled:false}")
    private boolean seedEnabled;

    private static final String DEMO_NAME = "Demo Warehouse";
    private static final int SKU_COUNT    = 1_000;
    private static final int SLOT_COUNT   = 500;
    private static final int ORDER_COUNT  = 10_000;
    private static final int MAX_LINES    = 5;    // lines per order
    private static final int ZONES        = 5;    // A–E

    @Override
    @Transactional
    public void run(String... args) {
        if (!seedEnabled) return;
        seedDemoWarehouse();
    }

    /**
     * Seeds a demo warehouse if one does not already exist, and returns its ID.
     * Safe to call repeatedly — idempotent.
     */
    @Transactional
    public Long seedDemoWarehouse() {
        return warehouseRepo.findByName(DEMO_NAME)
                .map(w -> {
                    log.info("Demo data already present — warehouse id={}", w.getId());
                    return w.getId();
                })
                .orElseGet(() -> {
                    log.info("Seeding demo warehouse on demand...");
                    Warehouse wh   = seedWarehouse();
                    List<Sku> skus = seedSkus(wh);
                    seedSlots(wh);
                    seedOrders(wh, skus);
                    log.info("Demo warehouse created: id={}", wh.getId());
                    return wh.getId();
                });
    }

    private Warehouse seedWarehouse() {
        return warehouseRepo.save(Warehouse.builder()
                .name(DEMO_NAME)
                .rows(25)
                .columns(20)
                .dockX(0)
                .dockY(0)
                .aisleWidthM(new BigDecimal("1.5"))
                .demo(true)            // shared sandbox — never listed under a user's warehouses
                .build());
    }

    private List<Sku> seedSkus(Warehouse wh) {
        String[] categories = {"Electronics", "Apparel", "Food", "Tools", "Sporting"};
        Random rng = new Random(42);
        List<Sku> skus = new ArrayList<>(SKU_COUNT);

        for (int i = 1; i <= SKU_COUNT; i++) {
            skus.add(Sku.builder()
                    .warehouse(wh)
                    .code("SKU-%04d".formatted(i))
                    .name("Product " + i)
                    .weightKg(BigDecimal.valueOf(0.1 + rng.nextDouble() * 29.9).setScale(3, java.math.RoundingMode.HALF_UP))
                    .volumeM3(BigDecimal.valueOf(0.001 + rng.nextDouble() * 0.499).setScale(4, java.math.RoundingMode.HALF_UP))
                    .category(categories[rng.nextInt(categories.length)])
                    .build());
        }

        return skuRepo.saveAll(skus);
    }

    private void seedSlots(Warehouse wh) {
        char[] zoneChars = {'A', 'B', 'C', 'D', 'E'};
        List<Slot> slots = new ArrayList<>(SLOT_COUNT);
        int slotsPerZone = SLOT_COUNT / ZONES;

        for (int z = 0; z < ZONES; z++) {
            String zone = String.valueOf(zoneChars[z]);
            int rowOffset = z * (wh.getRows() / ZONES);

            for (int s = 0; s < slotsPerZone; s++) {
                int row = rowOffset + (s / wh.getColumns());
                int col = s % wh.getColumns();
                int level = (s % 3) + 1;

                slots.add(Slot.builder()
                        .warehouse(wh)
                        .label("%s%d-%02d".formatted(zone, row, col))
                        .row(row)
                        .col(col)
                        .level(level)
                        .zone(zone)
                        .capacityKg(new BigDecimal(level == 1 ? "50.00" : level == 2 ? "30.00" : "15.00"))
                        .build());
            }
        }

        slotRepo.saveAll(slots);
    }

    private void seedOrders(Warehouse wh, List<Sku> skus) {
        Random rng = new Random(7);
        // Pareto-like popularity: first 10% of SKUs get ~50% of orders
        int popularCount = Math.max(1, skus.size() / 10);

        Instant base = Instant.now().minus(120, ChronoUnit.DAYS);

        List<Order> orders = new ArrayList<>(ORDER_COUNT);
        List<OrderLine> lines = new ArrayList<>(ORDER_COUNT * 3);

        for (int i = 0; i < ORDER_COUNT; i++) {
            Instant ts = base.plus(rng.nextLong(120 * 24 * 60L), ChronoUnit.MINUTES);
            Order order = Order.builder()
                    .warehouse(wh)
                    .externalId("ORD-%06d".formatted(i + 1))
                    .createdAt(ts)
                    .build();
            orders.add(order);

            int lineCount = 1 + rng.nextInt(MAX_LINES);
            Set<Integer> picked = new HashSet<>();
            for (int l = 0; l < lineCount; l++) {
                int idx = rng.nextDouble() < 0.5
                        ? rng.nextInt(popularCount)
                        : rng.nextInt(skus.size());
                if (!picked.add(idx)) continue;

                lines.add(OrderLine.builder()
                        .order(order)
                        .sku(skus.get(idx))
                        .quantity(1 + rng.nextInt(5))
                        .build());
            }
        }

        orderRepo.saveAll(orders);
        orderLineRepo.saveAll(lines);
        log.info("Seeded {} orders, {} order lines", orders.size(), lines.size());
    }
}
