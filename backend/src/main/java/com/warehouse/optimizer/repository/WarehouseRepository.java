package com.warehouse.optimizer.repository;

import com.warehouse.optimizer.model.Warehouse;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WarehouseRepository extends JpaRepository<Warehouse, Long> {
}
