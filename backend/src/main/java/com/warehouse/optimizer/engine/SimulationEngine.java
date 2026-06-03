package com.warehouse.optimizer.engine;

import com.warehouse.optimizer.dto.SimulationRequest;
import com.warehouse.optimizer.dto.SimulationResult;
import com.warehouse.optimizer.model.Order;
import com.warehouse.optimizer.model.OrderLine;
import com.warehouse.optimizer.model.Slot;
import com.warehouse.optimizer.model.Warehouse;
import com.warehouse.optimizer.repository.OrderLineRepository;
import com.warehouse.optimizer.repository.OrderRepository;
import com.warehouse.optimizer.repository.SlotRepository;
import com.warehouse.optimizer.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jgrapht.Graph;
import org.jgrapht.graph.DefaultWeightedEdge;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

/**
 * What-if simulation engine.
 *
 * <p>Replays historical orders through the {@link RoutingEngine} to compare
 * pick routes under the current slotting arrangement vs. a proposed arrangement.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SimulationEngine {

    private final WarehouseRepository   warehouseRepo;
    private final SlotRepository        slotRepo;
    private final OrderRepository       orderRepo;
    private final OrderLineRepository   orderLineRepo;
    private final RoutingEngine         routingEngine;

    private static final double WALK_SPEED_M_S = 1.2; // m/s (typical warehouse walk)

    /**
     * Runs a what-if simulation for the given warehouse and proposed assignments.
     *
     * @param request warehouse + proposed sku→slot overrides + sample size
     * @return aggregated before/after metrics
     */
    @Transactional(readOnly = true)
    public SimulationResult simulate(SimulationRequest request) {
        Long warehouseId = request.warehouseId();
        int sampleSize = request.sampleSize() != null ? request.sampleSize() : 100;

        Warehouse warehouse = warehouseRepo.findById(warehouseId)
                .orElseThrow(() -> new IllegalArgumentException("Warehouse not found: " + warehouseId));
        List<Slot> slots = slotRepo.findByWarehouseId(warehouseId);

        Graph<Long, DefaultWeightedEdge> graph = routingEngine.buildWarehouseGraph(warehouse, slots);

        // Build current sku→slot map from occupied slots
        Map<Long, Long> currentMap = slots.stream()
                .filter(s -> s.getCurrentSku() != null)
                .collect(Collectors.toMap(
                        s -> s.getCurrentSku().getId(),
                        Slot::getId,
                        (a, b) -> a)); // handle duplicates

        // Proposed map = current map overridden by request
        Map<Long, Long> proposedMap = new HashMap<>(currentMap);
        if (request.proposedAssignments() != null) {
            proposedMap.putAll(request.proposedAssignments());
        }

        // Sample orders
        List<Order> orders = orderRepo.findByWarehouseId(warehouseId);
        if (orders.isEmpty()) {
            return SimulationResult.empty(warehouseId);
        }
        if (orders.size() > sampleSize) {
            orders = new ArrayList<>(orders);
            Collections.shuffle(orders, new Random(42));
            orders = orders.subList(0, sampleSize);
        }

        double totalBeforeDist = 0.0;
        double totalAfterDist  = 0.0;
        int totalPicks = 0;
        int improvedOrders = 0;
        int sameOrders = 0;
        int worsenedOrders = 0;

        for (Order order : orders) {
            List<OrderLine> lines = orderLineRepo.findByOrderId(order.getId());
            if (lines.isEmpty()) continue;

            List<Long> skuIds = lines.stream()
                    .map(ol -> ol.getSku().getId())
                    .distinct()
                    .toList();

            List<Long> currentSlots = skuIds.stream()
                    .map(currentMap::get)
                    .filter(Objects::nonNull)
                    .toList();
            List<Long> proposedSlots = skuIds.stream()
                    .map(proposedMap::get)
                    .filter(Objects::nonNull)
                    .toList();

            if (currentSlots.isEmpty() || proposedSlots.isEmpty()) continue;

            Map<Long, Double> currentWeights = new HashMap<>();
            Map<Long, Double> proposedWeights = new HashMap<>();
            for (OrderLine ol : lines) {
                Long cSlot = currentMap.get(ol.getSku().getId());
                Long pSlot = proposedMap.get(ol.getSku().getId());
                double w = ol.getSku().getWeightKg().doubleValue();
                if (cSlot != null) currentWeights.put(cSlot, w);
                if (pSlot != null) proposedWeights.put(pSlot, w);
            }

            var currentRoute = routingEngine.optimizePickRoute(
                    graph, RoutingEngine.DOCK_NODE_ID, currentSlots, currentWeights, 0.0);
            var proposedRoute = routingEngine.optimizePickRoute(
                    graph, RoutingEngine.DOCK_NODE_ID, proposedSlots, proposedWeights, 0.0);

            double before = currentRoute.totalDistanceM();
            double after  = proposedRoute.totalDistanceM();

            totalBeforeDist += before;
            totalAfterDist  += after;
            totalPicks += skuIds.size();

            if (after < before) improvedOrders++;
            else if (after == before) sameOrders++;
            else worsenedOrders++;
        }

        double avgBefore = orders.isEmpty() ? 0.0 : totalBeforeDist / orders.size();
        double avgAfter  = orders.isEmpty() ? 0.0 : totalAfterDist / orders.size();
        double savingsM  = totalBeforeDist - totalAfterDist;
        double savingsPct = totalBeforeDist > 0 ? savingsM / totalBeforeDist * 100.0 : 0.0;

        double timeBeforeS = totalBeforeDist / WALK_SPEED_M_S;
        double timeAfterS  = totalAfterDist / WALK_SPEED_M_S;

        log.info("Simulation complete: warehouse={}, orders={}, savingsPct={}",
                warehouseId, orders.size(), Math.round(savingsPct * 10) / 10.0);

        return new SimulationResult(
                warehouseId,
                orders.size(),
                totalPicks,
                Math.round(avgBefore * 10) / 10.0,
                Math.round(avgAfter * 10) / 10.0,
                Math.round(savingsM * 10) / 10.0,
                Math.round(savingsPct * 10) / 10.0,
                Math.round(totalBeforeDist * 10) / 10.0,
                Math.round(totalAfterDist * 10) / 10.0,
                Duration.ofSeconds(Math.round(timeBeforeS)).toString(),
                Duration.ofSeconds(Math.round(timeAfterS)).toString(),
                improvedOrders, sameOrders, worsenedOrders
        );
    }
}
