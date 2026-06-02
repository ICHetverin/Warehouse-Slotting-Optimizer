package com.warehouse.optimizer.repository;

import com.warehouse.optimizer.model.Warehouse;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WarehouseRepository extends JpaRepository<Warehouse, Long> {
    Optional<Warehouse> findByName(String name);

    /** Warehouses owned by a given user (excludes demo warehouses, which have no owner). */
    List<Warehouse> findByOwnerIdOrderByCreatedAtDesc(Long ownerId);

    /** Shared demo warehouses. */
    List<Warehouse> findByDemoTrueOrderByCreatedAtDesc();
}
