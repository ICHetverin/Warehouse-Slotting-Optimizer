package com.warehouse.optimizer.repository;

import com.warehouse.optimizer.model.Sku;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SkuRepository extends JpaRepository<Sku, Long> {

    List<Sku> findByWarehouseId(Long warehouseId);

    Optional<Sku> findByWarehouseIdAndCode(Long warehouseId, String code);
}
