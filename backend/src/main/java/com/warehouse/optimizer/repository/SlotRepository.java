package com.warehouse.optimizer.repository;

import com.warehouse.optimizer.model.Slot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SlotRepository extends JpaRepository<Slot, Long> {

    List<Slot> findByWarehouseId(Long warehouseId);

    @Query("SELECT s FROM Slot s WHERE s.warehouse.id = :wid AND s.currentSku IS NULL")
    List<Slot> findEmptyByWarehouseId(@Param("wid") Long warehouseId);

    @Query("SELECT s FROM Slot s WHERE s.warehouse.id = :wid AND s.currentSku.id = :skuId")
    List<Slot> findByWarehouseIdAndCurrentSkuId(@Param("wid") Long warehouseId, @Param("skuId") Long skuId);

    @Query("SELECT s FROM Slot s LEFT JOIN FETCH s.currentSku WHERE s.warehouse.id = :wid")
    List<Slot> findByWarehouseIdWithSku(@Param("wid") Long warehouseId);
}
