package com.warehouse.optimizer.repository;

import com.warehouse.optimizer.model.OrderLine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface OrderLineRepository extends JpaRepository<OrderLine, Long> {

    /**
     * Returns [skuId, orderCount] pairs — distinct orders per SKU for the given warehouse/period.
     */
    @Query("""
            SELECT ol.sku.id, COUNT(DISTINCT ol.order.id)
            FROM OrderLine ol
            JOIN ol.order o
            WHERE o.warehouse.id = :wid
              AND o.createdAt >= :since
            GROUP BY ol.sku.id
            """)
    List<Object[]> countOrdersPerSku(@Param("wid") Long warehouseId, @Param("since") Instant since);

    /**
     * Returns co-pick pairs [skuI, skuJ, count] where skuI < skuJ, both in the same order.
     * Uses native SQL because JPQL self-join on the same entity table is awkward.
     */
    @Query(value = """
            SELECT ol1.sku_id     AS sku_i,
                   ol2.sku_id     AS sku_j,
                   COUNT(DISTINCT ol1.order_id) AS pair_count
            FROM order_lines ol1
            JOIN order_lines ol2
              ON ol1.order_id = ol2.order_id
             AND ol1.sku_id   < ol2.sku_id
            JOIN orders o ON ol1.order_id = o.id
            WHERE o.warehouse_id = :wid
              AND o.created_at  >= :since
            GROUP BY ol1.sku_id, ol2.sku_id
            HAVING COUNT(DISTINCT ol1.order_id) > 0
            """, nativeQuery = true)
    List<Object[]> findCopickPairsRaw(@Param("wid") Long warehouseId, @Param("since") Instant since);

    /**
     * Returns daily order counts per SKU: [skuId, date, count].
     * Date is returned as java.sql.Date.
     */
    @Query(value = """
            SELECT ol.sku_id AS sku_id,
                   DATE(o.created_at) AS order_date,
                   COUNT(DISTINCT o.id) AS cnt
            FROM order_lines ol
            JOIN orders o ON ol.order_id = o.id
            WHERE o.warehouse_id = :wid
              AND o.created_at >= :since
            GROUP BY ol.sku_id, DATE(o.created_at)
            """, nativeQuery = true)
    List<Object[]> findDailyOrderCounts(@Param("wid") Long warehouseId, @Param("since") Instant since);

    @Query("SELECT ol FROM OrderLine ol WHERE ol.order.id = :orderId")
    List<OrderLine> findByOrderId(@Param("orderId") Long orderId);
}
