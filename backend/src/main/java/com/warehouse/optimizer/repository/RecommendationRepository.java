package com.warehouse.optimizer.repository;

import com.warehouse.optimizer.model.Recommendation;
import com.warehouse.optimizer.model.RecommendationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecommendationRepository extends JpaRepository<Recommendation, Long> {

    Page<Recommendation> findByWarehouseIdAndStatus(Long warehouseId, RecommendationStatus status, Pageable pageable);

    Page<Recommendation> findByWarehouseId(Long warehouseId, Pageable pageable);

    void deleteByWarehouseIdAndStatus(Long warehouseId, RecommendationStatus status);
}
