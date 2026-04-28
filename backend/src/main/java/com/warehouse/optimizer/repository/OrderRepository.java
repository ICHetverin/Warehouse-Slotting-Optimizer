package com.warehouse.optimizer.repository;

import com.warehouse.optimizer.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

public interface OrderRepository extends JpaRepository<Order, Long> {

    @Query("SELECT COUNT(DISTINCT o.id) FROM Order o WHERE o.warehouse.id = :wid AND o.createdAt >= :since")
    long countByWarehouseIdSince(@Param("wid") Long warehouseId, @Param("since") Instant since);
}
