package com.warehouse.optimizer.dto;

import java.util.List;

public record WarehouseGraphResponse(
        Long             warehouseId,
        List<GraphNode>  nodes,
        List<GraphEdge>  edges
) {
    public record GraphNode(Long id, String label, int row, int col, boolean isDock) {}
    public record GraphEdge(Long source, Long target, double weightM) {}
}
