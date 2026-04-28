package com.warehouse.optimizer.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(
    name = "slots",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_slot_label_warehouse",
        columnNames = {"warehouse_id", "label"}
    )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Slot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "warehouse_id", nullable = false)
    private Warehouse warehouse;

    /**
     * Nullable: slot can be empty.
     * Updated when a recommendation is accepted.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_sku_id")
    private Sku currentSku;

    @Column(nullable = false, length = 20)
    private String label;

    @Column(nullable = false)
    private Integer row;

    @Column(nullable = false)
    private Integer col;

    @Column(nullable = false)
    private Integer level;

    @Column(length = 10)
    private String zone;

    @Column(name = "capacity_kg", nullable = false, precision = 8, scale = 2)
    private BigDecimal capacityKg;

    public boolean isEmpty() {
        return currentSku == null;
    }
}
