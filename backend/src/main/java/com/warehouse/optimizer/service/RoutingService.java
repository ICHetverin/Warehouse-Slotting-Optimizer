package com.warehouse.optimizer.service;

import com.warehouse.optimizer.dto.*;
import com.warehouse.optimizer.engine.RoutingEngine;
import com.warehouse.optimizer.exception.RoutingException;
import com.warehouse.optimizer.model.Slot;
import com.warehouse.optimizer.model.Warehouse;
import com.warehouse.optimizer.repository.SlotRepository;
import com.warehouse.optimizer.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jgrapht.Graph;
import org.jgrapht.graph.DefaultWeightedEdge;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RoutingService {

    private final RoutingEngine       routingEngine;
    private final WarehouseRepository warehouseRepo;
    private final SlotRepository      slotRepo;

    /**
     * Optimises the pick route for the given SKU IDs using their current slot assignments.
     */
    @Transactional(readOnly = true)
    public Route optimizeRoute(OptimizeRouteRequest req) {
        Warehouse warehouse = requireWarehouse(req.warehouseId());
        List<Slot> slots    = slotRepo.findByWarehouseIdWithSku(req.warehouseId());

        Graph<Long, DefaultWeightedEdge> graph =
                routingEngine.buildWarehouseGraph(warehouse, slots);

        Map<Long, Long>   skuToSlot      = buildSkuToSlotMap(slots);
        Map<Long, Double> itemWeights    = buildItemWeights(slots);

        List<Long> pickSlotIds = req.skuIds().stream()
                .map(skuToSlot::get)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        if (pickSlotIds.isEmpty()) {
            throw new RoutingException("None of the requested SKUs have a current slot assignment");
        }

        log.info("Optimising route: {} pick slots, warehouse={}", pickSlotIds.size(), req.warehouseId());
        return routingEngine.optimizePickRoute(
                graph, RoutingEngine.DOCK_NODE_ID, pickSlotIds, itemWeights, req.cartCapacityKg());
    }

    /**
     * Compares current vs proposed slot arrangement for the same pick list.
     */
    @Transactional(readOnly = true)
    public RouteComparison compareRoutes(CompareRoutesRequest req) {
        Warehouse warehouse = requireWarehouse(req.warehouseId());
        List<Slot> slots    = slotRepo.findByWarehouseIdWithSku(req.warehouseId());

        Graph<Long, DefaultWeightedEdge> graph =
                routingEngine.buildWarehouseGraph(warehouse, slots);

        Map<Long, Double> itemWeights = buildItemWeights(slots);

        List<Long> currentPickSlots = req.skuIds().stream()
                .map(req.currentSlots()::get)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        List<Long> proposedPickSlots = req.skuIds().stream()
                .map(req.proposedSlots()::get)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        log.info("Comparing routes: {} current / {} proposed pick slots, warehouse={}",
                currentPickSlots.size(), proposedPickSlots.size(), req.warehouseId());

        return routingEngine.compareRoutes(
                graph, RoutingEngine.DOCK_NODE_ID,
                currentPickSlots, proposedPickSlots,
                itemWeights, req.cartCapacityKg());
    }

    /**
     * Returns the full warehouse graph as node/edge lists for frontend visualisation.
     */
    @Transactional(readOnly = true)
    public WarehouseGraphResponse getWarehouseGraph(Long warehouseId) {
        Warehouse warehouse = requireWarehouse(warehouseId);
        List<Slot> slots    = slotRepo.findByWarehouseId(warehouseId);

        Graph<Long, DefaultWeightedEdge> graph =
                routingEngine.buildWarehouseGraph(warehouse, slots);

        // Build node list: dock + all slots
        List<WarehouseGraphResponse.GraphNode> nodes = new ArrayList<>(slots.size() + 1);
        nodes.add(new WarehouseGraphResponse.GraphNode(
                RoutingEngine.DOCK_NODE_ID, "DOCK",
                warehouse.getDockX(), warehouse.getDockY(), true));
        for (Slot slot : slots) {
            nodes.add(new WarehouseGraphResponse.GraphNode(
                    slot.getId(), slot.getLabel(), slot.getRow(), slot.getCol(), false));
        }

        // Build edge list
        List<WarehouseGraphResponse.GraphEdge> edges = graph.edgeSet().stream()
                .map(e -> new WarehouseGraphResponse.GraphEdge(
                        graph.getEdgeSource(e),
                        graph.getEdgeTarget(e),
                        graph.getEdgeWeight(e)))
                .collect(Collectors.toList());

        return new WarehouseGraphResponse(warehouseId, nodes, edges);
    }

    // ──────────────────────────────────────────────────────────────────────────

    private Warehouse requireWarehouse(Long warehouseId) {
        return warehouseRepo.findById(warehouseId)
                .orElseThrow(() -> new RoutingException("Warehouse not found: " + warehouseId));
    }

    private static Map<Long, Long> buildSkuToSlotMap(List<Slot> slots) {
        return slots.stream()
                .filter(s -> s.getCurrentSku() != null)
                .collect(Collectors.toMap(
                        s -> s.getCurrentSku().getId(),
                        Slot::getId,
                        (a, b) -> a));
    }

    private static Map<Long, Double> buildItemWeights(List<Slot> slots) {
        Map<Long, Double> weights = new HashMap<>();
        for (Slot slot : slots) {
            if (slot.getCurrentSku() != null) {
                weights.put(slot.getId(),
                        slot.getCurrentSku().getWeightKg().doubleValue());
            }
        }
        return weights;
    }
}
