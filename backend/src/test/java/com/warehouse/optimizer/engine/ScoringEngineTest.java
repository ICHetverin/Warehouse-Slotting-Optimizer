package com.warehouse.optimizer.engine;

import com.warehouse.optimizer.dto.Assignment;
import com.warehouse.optimizer.dto.ScoringWeights;
import com.warehouse.optimizer.exception.ScoringException;
import com.warehouse.optimizer.model.*;
import com.warehouse.optimizer.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ScoringEngineTest {

    @Mock OrderLineRepository orderLineRepo;
    @Mock SlotRepository      slotRepo;
    @Mock SkuRepository       skuRepo;
    @Mock WarehouseRepository warehouseRepo;

    @InjectMocks ScoringEngine engine;

    // ── Test fixtures ──────────────────────────────────────────────────────────

    private Warehouse warehouse;
    private Sku       skuA, skuB, skuC;
    private Slot      slotNear, slotFar, slotMid;

    @BeforeEach
    void setUp() {
        warehouse = Warehouse.builder()
                .id(1L).name("Test WH")
                .rows(5).columns(5)
                .dockX(0).dockY(0)
                .aisleWidthM(new BigDecimal("1.5"))
                .build();

        // SKU A — heavy (25 kg), SKU B — light (5 kg), SKU C — medium (10 kg)
        skuA = sku(1L, "SKU-A", 25.0);
        skuB = sku(2L, "SKU-B",  5.0);
        skuC = sku(3L, "SKU-C", 10.0);

        // Slot near dock (0,0), slot far (4,4), slot mid (2,2)
        slotNear = slot(10L, "A0-00", 0, 0, 50.0, null);
        slotFar  = slot(11L, "E4-44", 4, 4, 50.0, null);
        slotMid  = slot(12L, "C2-22", 2, 2, 50.0, null);
    }

    // ── computeVelocity ───────────────────────────────────────────────────────

    @Test
    @DisplayName("computeVelocity normalizes to [0,1] and highest SKU gets 1.0")
    void computeVelocity_normalizesCorrectly() {
        when(orderLineRepo.countOrdersPerSku(eq(1L), any(Instant.class)))
                .thenReturn(List.of(
                        new Object[]{1L, 100L},  // SKU-A: 100 orders
                        new Object[]{2L,  50L},  // SKU-B:  50 orders
                        new Object[]{3L,  20L}   // SKU-C:  20 orders
                ));

        Map<Long, Double> velocity = engine.computeVelocity(1L, 90);

        assertThat(velocity).hasSize(3);
        assertThat(velocity.get(1L)).isEqualTo(1.0);
        assertThat(velocity.get(2L)).isCloseTo(0.5, within(1e-9));
        assertThat(velocity.get(3L)).isCloseTo(0.2, within(1e-9));
    }

    @Test
    @DisplayName("computeVelocity returns empty map when no orders")
    void computeVelocity_emptyWhenNoOrders() {
        when(orderLineRepo.countOrdersPerSku(any(), any())).thenReturn(List.of());
        assertThat(engine.computeVelocity(1L, 90)).isEmpty();
    }

    @Test
    @DisplayName("computeVelocity single SKU gets velocity 1.0")
    void computeVelocity_singleSkuIsOne() {
        when(orderLineRepo.countOrdersPerSku(any(), any()))
                .thenReturn(List.of(new Object[]{1L, 42L}));
        assertThat(engine.computeVelocity(1L, 90).get(1L)).isEqualTo(1.0);
    }

    // ── computeSlotDistances ──────────────────────────────────────────────────

    @Test
    @DisplayName("slot at dock position gets distance score 1.0")
    void computeSlotDistances_dockSlotGetsOne() {
        when(warehouseRepo.findById(1L)).thenReturn(Optional.of(warehouse));
        when(slotRepo.findByWarehouseId(1L)).thenReturn(List.of(slotNear, slotFar));

        Map<Long, Double> dist = engine.computeSlotDistances(1L);

        assertThat(dist.get(slotNear.getId())).isEqualTo(1.0);
        assertThat(dist.get(slotFar.getId())).isEqualTo(0.0);
    }

    @Test
    @DisplayName("mid slot gets distance score between 0 and 1")
    void computeSlotDistances_midSlotInRange() {
        when(warehouseRepo.findById(1L)).thenReturn(Optional.of(warehouse));
        when(slotRepo.findByWarehouseId(1L)).thenReturn(List.of(slotNear, slotMid, slotFar));

        Map<Long, Double> dist = engine.computeSlotDistances(1L);

        double midScore = dist.get(slotMid.getId());
        assertThat(midScore).isGreaterThan(0.0).isLessThan(1.0);
    }

    @Test
    @DisplayName("computeSlotDistances throws when warehouse missing")
    void computeSlotDistances_throwsWhenMissingWarehouse() {
        when(warehouseRepo.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> engine.computeSlotDistances(99L))
                .isInstanceOf(ScoringException.class)
                .hasMessageContaining("99");
    }

    // ── computeCopickMatrix ───────────────────────────────────────────────────

    @Test
    @DisplayName("copick matrix is symmetric and normalized to [0,1]")
    void computeCopickMatrix_symmetricAndNormalized() {
        // SKU-A and SKU-B appear together 80 times; SKU-A and SKU-C 40 times
        when(orderLineRepo.findCopickPairsRaw(eq(1L), any()))
                .thenReturn(List.of(
                        new Object[]{1L, 2L, 80},
                        new Object[]{1L, 3L, 40}
                ));

        Map<Long, Map<Long, Double>> matrix = engine.computeCopickMatrix(1L, 90);

        // Symmetric
        assertThat(matrix.get(1L).get(2L)).isEqualTo(matrix.get(2L).get(1L));
        assertThat(matrix.get(1L).get(3L)).isEqualTo(matrix.get(3L).get(1L));

        // SKU-A's strongest partner (SKU-B, 80 orders) → 1.0; SKU-C → 0.5
        assertThat(matrix.get(1L).get(2L)).isEqualTo(1.0);
        assertThat(matrix.get(1L).get(3L)).isCloseTo(0.5, within(1e-9));

        // All values in [0, 1]
        matrix.values().forEach(row ->
                row.values().forEach(v -> assertThat(v).isBetween(0.0, 1.0)));
    }

    @Test
    @DisplayName("empty copick matrix when no co-picked orders")
    void computeCopickMatrix_emptyWhenNoPairs() {
        when(orderLineRepo.findCopickPairsRaw(any(), any())).thenReturn(List.of());
        assertThat(engine.computeCopickMatrix(1L, 90)).isEmpty();
    }

    // ── scoreAssignment ───────────────────────────────────────────────────────

    @Test
    @DisplayName("high-velocity SKU scores higher in near slot than far slot")
    void scoreAssignment_highVelocityPreferNearSlot() {
        Map<Long, Double> velocity  = Map.of(1L, 1.0);
        Map<Long, Double> distances = Map.of(slotNear.getId(), 1.0, slotFar.getId(), 0.0);

        ScoringContext ctx = new ScoringContext(
                velocity, Map.of(), distances,
                Map.of(1L, skuA),
                Map.of(slotNear.getId(), slotNear, slotFar.getId(), slotFar),
                Map.of(), ScoringWeights.DEFAULT);

        double nearScore = engine.scoreAssignment(1L, slotNear.getId(), ctx);
        double farScore  = engine.scoreAssignment(1L, slotFar.getId(),  ctx);

        assertThat(nearScore).isGreaterThan(farScore);
    }

    @Test
    @DisplayName("SKU exceeding slot capacity gets lower fit score")
    void scoreAssignment_overweightReducesScore() {
        Slot tinySlot = slot(20L, "X0-00", 0, 0, 3.0, null); // capacity only 3 kg
        Map<Long, Double> velocity  = Map.of(2L, 0.5);
        Map<Long, Double> distances = Map.of(slotNear.getId(), 1.0, tinySlot.getId(), 1.0);

        ScoringContext ctxFit = new ScoringContext(
                velocity, Map.of(), distances,
                Map.of(2L, skuB),   // 5 kg > 3 kg capacity
                Map.of(tinySlot.getId(), tinySlot, slotNear.getId(), slotNear),
                Map.of(), new ScoringWeights(0.0, 0.0, 1.0)); // only fit matters

        // SKU-B (5 kg) should score 0 in tiny slot (3 kg capacity)
        double score = engine.scoreAssignment(2L, tinySlot.getId(), ctxFit);
        assertThat(score).isEqualTo(0.0);

        // SKU-B in normal slot (50 kg) should score > 0
        double normalScore = engine.scoreAssignment(2L, slotNear.getId(), ctxFit);
        assertThat(normalScore).isGreaterThan(0.0);
    }

    // ── runGreedyAssignment ───────────────────────────────────────────────────

    @Test
    @DisplayName("greedy assignment places all SKUs in distinct slots")
    void runGreedyAssignment_allSkusAssignedUnique() {
        when(warehouseRepo.findById(1L)).thenReturn(Optional.of(warehouse));
        when(skuRepo.findByWarehouseId(1L)).thenReturn(List.of(skuA, skuB, skuC));
        when(slotRepo.findByWarehouseId(1L)).thenReturn(List.of(slotNear, slotFar, slotMid));
        when(orderLineRepo.countOrdersPerSku(any(), any())).thenReturn(List.of());
        when(orderLineRepo.findCopickPairsRaw(any(), any())).thenReturn(List.of());

        List<Assignment> assignments = engine.runGreedyAssignment(1L, ScoringWeights.DEFAULT);

        assertThat(assignments).hasSize(3);

        // All toSlotIds are unique
        Set<Long> usedSlots = new HashSet<>();
        for (Assignment a : assignments) {
            assertThat(usedSlots.add(a.toSlotId()))
                    .as("Slot %d assigned to two SKUs", a.toSlotId())
                    .isTrue();
        }
    }

    @Test
    @DisplayName("greedy assignment respects weight capacity")
    void runGreedyAssignment_respectsCapacity() {
        Slot smallSlot = slot(20L, "Z0-00", 0, 0, 5.0, null); // 5 kg max

        when(warehouseRepo.findById(1L)).thenReturn(Optional.of(warehouse));
        when(skuRepo.findByWarehouseId(1L)).thenReturn(List.of(skuA)); // SKU-A = 25 kg
        when(slotRepo.findByWarehouseId(1L)).thenReturn(List.of(smallSlot)); // only 5 kg slot
        when(orderLineRepo.countOrdersPerSku(any(), any())).thenReturn(List.of());
        when(orderLineRepo.findCopickPairsRaw(any(), any())).thenReturn(List.of());

        // SKU-A (25 kg) cannot fit in small slot (5 kg) → no assignments
        List<Assignment> assignments = engine.runGreedyAssignment(1L, ScoringWeights.DEFAULT);
        assertThat(assignments).isEmpty();
    }

    @Test
    @DisplayName("greedy assignment throws when warehouse has no SKUs or slots")
    void runGreedyAssignment_throwsWhenEmpty() {
        when(warehouseRepo.findById(1L)).thenReturn(Optional.of(warehouse));
        when(skuRepo.findByWarehouseId(1L)).thenReturn(List.of());
        when(slotRepo.findByWarehouseId(1L)).thenReturn(List.of());

        assertThatThrownBy(() -> engine.runGreedyAssignment(1L, ScoringWeights.DEFAULT))
                .isInstanceOf(ScoringException.class);
    }

    @Test
    @DisplayName("high-velocity SKU is assigned near dock when all weights equal zero except w1")
    void runGreedyAssignment_highVelocityNearDock() {
        // Only velocity×distance matters (w1=1, w2=0, w3=0)
        ScoringWeights w = new ScoringWeights(1.0, 0.0, 0.0);

        when(warehouseRepo.findById(1L)).thenReturn(Optional.of(warehouse));
        when(skuRepo.findByWarehouseId(1L)).thenReturn(List.of(skuA, skuB));
        when(slotRepo.findByWarehouseId(1L)).thenReturn(List.of(slotNear, slotFar));
        // SKU-A has 10x more orders than SKU-B
        when(orderLineRepo.countOrdersPerSku(any(), any()))
                .thenReturn(List.of(new Object[]{1L, 100L}, new Object[]{2L, 10L}));
        when(orderLineRepo.findCopickPairsRaw(any(), any())).thenReturn(List.of());

        List<Assignment> assignments = engine.runGreedyAssignment(1L, w);

        // SKU-A (highest velocity) should get slotNear (closest to dock)
        Assignment skuAAssignment = assignments.stream()
                .filter(a -> a.skuId().equals(1L))
                .findFirst().orElseThrow();

        assertThat(skuAAssignment.toSlotId()).isEqualTo(slotNear.getId());
    }

    // ── Factories ─────────────────────────────────────────────────────────────

    private static Sku sku(Long id, String code, double weightKg) {
        Sku s = new Sku();
        s.setId(id);
        s.setCode(code);
        s.setName(code);
        s.setWeightKg(BigDecimal.valueOf(weightKg));
        s.setVolumeM3(BigDecimal.valueOf(0.01));
        return s;
    }

    private static Slot slot(Long id, String label, int row, int col, double capacityKg, Sku currentSku) {
        Slot s = new Slot();
        s.setId(id);
        s.setLabel(label);
        s.setRow(row);
        s.setCol(col);
        s.setLevel(1);
        s.setCapacityKg(BigDecimal.valueOf(capacityKg));
        s.setCurrentSku(currentSku);
        return s;
    }
}
