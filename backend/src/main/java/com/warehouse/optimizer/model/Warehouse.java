package com.warehouse.optimizer.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "warehouses")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Warehouse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private Integer rows;

    @Column(nullable = false)
    private Integer columns;

    @Column(name = "dock_x", nullable = false)
    private Integer dockX;

    @Column(name = "dock_y", nullable = false)
    private Integer dockY;

    @Column(name = "aisle_width_m", nullable = false, precision = 5, scale = 2)
    private BigDecimal aisleWidthM;

    /** Owner of the warehouse. Null only for demo warehouses (shared sandbox). */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private User owner;

    /** Demo warehouses are a shared sandbox: never listed under a user's own warehouses. */
    @Column(name = "is_demo", nullable = false)
    @Builder.Default
    private boolean demo = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @JsonIgnore
    @OneToMany(mappedBy = "warehouse", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Slot> slots = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "warehouse", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Sku> skus = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "warehouse", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Order> orders = new ArrayList<>();

    @PrePersist
    private void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
