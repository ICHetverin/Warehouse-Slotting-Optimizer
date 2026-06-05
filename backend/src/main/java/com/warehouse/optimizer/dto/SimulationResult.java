package com.warehouse.optimizer.dto;

/**
 * What-if simulation result: comparing current vs proposed layout on historical orders.
 *
 * @param warehouseId         warehouse id
 * @param ordersSampled       number of historical orders evaluated
 * @param totalPicks          total number of pick items across all sampled orders
 * @param avgBeforeDistanceM  average route distance per order (current layout)
 * @param avgAfterDistanceM   average route distance per order (proposed layout)
 * @param savingsM            absolute meters saved in total
 * @param savingsPct          percentage reduction in total distance
 * @param totalBeforeDistanceM total distance across all orders (current)
 * @param totalAfterDistanceM  total distance across all orders (proposed)
 * @param totalBeforeTime      total walking time current (ISO-8601 duration string)
 * @param totalAfterTime       total walking time proposed (ISO-8601 duration string)
 * @param improvedOrders      number of orders with shorter routes
 * @param sameOrders          number of orders with unchanged routes
 * @param worsenedOrders      number of orders with longer routes
 */
public record SimulationResult(
        Long warehouseId,
        int ordersSampled,
        int totalPicks,
        double avgBeforeDistanceM,
        double avgAfterDistanceM,
        double savingsM,
        double savingsPct,
        double totalBeforeDistanceM,
        double totalAfterDistanceM,
        String totalBeforeTime,
        String totalAfterTime,
        int improvedOrders,
        int sameOrders,
        int worsenedOrders
) {
    public static SimulationResult empty(Long warehouseId) {
        return new SimulationResult(warehouseId, 0, 0, 0.0, 0.0, 0.0, 0.0,
                0.0, 0.0, "PT0S", "PT0S", 0, 0, 0);
    }
}
