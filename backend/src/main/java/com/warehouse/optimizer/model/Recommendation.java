package com.warehouse.optimizer.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

@Entity
@Table(
    name = "recommendations",
    indexes = {
        @Index(name = "idx_rec_warehouse_status", columnList = "warehouse_id, status"),
        @Index(name = "idx_rec_sku",              columnList = "sku_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Recommendation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "warehouse_id", nullable = false)
    private Warehouse warehouse;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sku_id", nullable = false)
    private Sku sku;

    /**
     * Nullable: SKU may not have a current slot (unplaced).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_slot_id")
    private Slot fromSlot;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "to_slot_id", nullable = false)
    private Slot toSlot;

    @Column(name = "score_delta", nullable = false, precision = 10, scale = 4)
    private BigDecimal scoreDelta;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "explanation_json", columnDefinition = "jsonb")
    private Map<String, Object> explanationJson;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private RecommendationStatus status = RecommendationStatus.PENDING;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** When the recommendation was accepted or rejected (null while pending). */
    @Column(name = "decided_at")
    private Instant decidedAt;

    @PrePersist
    private void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (status == null) status = RecommendationStatus.PENDING;
    }
}
