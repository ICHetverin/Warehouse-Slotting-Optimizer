package com.warehouse.optimizer.engine;

import com.warehouse.optimizer.dto.SimulationRequest;
import com.warehouse.optimizer.dto.SimulationResult;
import com.warehouse.optimizer.model.*;
import com.warehouse.optimizer.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SimulationEngineTest {

    @Mock WarehouseRepository warehouseRepo;
    @Mock SlotRepository      slotRepo;
    @Mock OrderRepository     orderRepo;
    @Mock OrderLineRepository orderLineRepo;

    private SimulationEngine simulationEngine;

    private Warehouse warehouse;
    private Sku skuA, skuB;
    private Slot slot1, slot2;
    private Order order1;

    @BeforeEach
    void setUp() {
        simulationEngine = new SimulationEngine(
                warehouseRepo, slotRepo, orderRepo, orderLineRepo, new RoutingEngine());

        warehouse = Warehouse.builder()
                .id(1L).name("Test WH")
                .rows(5).columns(5)
                .dockX(0).dockY(0)
                .aisleWidthM(new BigDecimal("1.5"))
                .build();

        skuA = Sku.builder().id(1L).code("SKU-A").weightKg(new BigDecimal("5.0")).build();
        skuB = Sku.builder().id(2L).code("SKU-B").weightKg(new BigDecimal("3.0")).build();

        slot1 = Slot.builder().id(10L).label("A0-00").row(0).col(0).level(1).zone("A").capacityKg(new BigDecimal("50")).build();
        slot2 = Slot.builder().id(11L).label("A1-01").row(1).col(1).level(1).zone("A").capacityKg(new BigDecimal("50")).build();
        slot1.setCurrentSku(skuA);
        slot2.setCurrentSku(skuB);

        order1 = Order.builder().id(100L).warehouse(warehouse).externalId("ORD-001").createdAt(Instant.now()).build();
    }

    @Test
    @DisplayName("simulate returns empty result when no orders exist")
    void simulate_emptyOrders() {
        when(warehouseRepo.findById(1L)).thenReturn(Optional.of(warehouse));
        when(slotRepo.findByWarehouseId(1L)).thenReturn(List.of(slot1, slot2));
        when(orderRepo.findByWarehouseId(1L)).thenReturn(List.of());

        SimulationRequest req = new SimulationRequest(1L, null, 100);
        SimulationResult result = simulationEngine.simulate(req);

        assertThat(result.warehouseId()).isEqualTo(1L);
        assertThat(result.ordersSampled()).isEqualTo(0);
    }

    @Test
    @DisplayName("simulate computes before/after distances with proposed assignments")
    void simulate_withProposedAssignments() {
        when(warehouseRepo.findById(1L)).thenReturn(Optional.of(warehouse));
        when(slotRepo.findByWarehouseId(1L)).thenReturn(List.of(slot1, slot2));
        when(orderRepo.findByWarehouseId(1L)).thenReturn(List.of(order1));

        OrderLine lineA = OrderLine.builder().order(order1).sku(skuA).quantity(1).build();
        OrderLine lineB = OrderLine.builder().order(order1).sku(skuB).quantity(1).build();
        when(orderLineRepo.findByOrderId(100L)).thenReturn(List.of(lineA, lineB));

        Map<Long, Long> proposed = Map.of(1L, 11L, 2L, 10L);
        SimulationRequest req = new SimulationRequest(1L, proposed, 100);
        SimulationResult result = simulationEngine.simulate(req);

        assertThat(result.warehouseId()).isEqualTo(1L);
        assertThat(result.ordersSampled()).isEqualTo(1);
        assertThat(result.totalPicks()).isEqualTo(2);
        assertThat(result.totalBeforeDistanceM()).isGreaterThan(0.0);
        assertThat(result.totalAfterDistanceM()).isGreaterThan(0.0);
    }

    @Test
    @DisplayName("simulate respects sample size limit")
    void simulate_respectsSampleSize() {
        when(warehouseRepo.findById(1L)).thenReturn(Optional.of(warehouse));
        when(slotRepo.findByWarehouseId(1L)).thenReturn(List.of(slot1, slot2));

        List<Order> orders = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            Order o = Order.builder().id(100L + i).warehouse(warehouse)
                    .externalId("ORD-" + i).createdAt(Instant.now()).build();
            orders.add(o);
            // every order references skuA which is in slot1
            when(orderLineRepo.findByOrderId(100L + i)).thenReturn(List.of(
                    OrderLine.builder().order(o).sku(skuA).quantity(1).build()
            ));
        }
        when(orderRepo.findByWarehouseId(1L)).thenReturn(orders);

        SimulationRequest req = new SimulationRequest(1L, null, 5);
        SimulationResult result = simulationEngine.simulate(req);

        assertThat(result.ordersSampled()).isEqualTo(5);
    }
}
