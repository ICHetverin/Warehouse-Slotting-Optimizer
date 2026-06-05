-- Add volume_m3 to slots for cube-utilization scoring
ALTER TABLE slots
    ADD COLUMN volume_m3 NUMERIC(8,4);

-- Table for cached ABC/XYZ classification profiles
CREATE TABLE abc_xyz_profiles (
    id BIGSERIAL PRIMARY KEY,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    sku_id BIGINT NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    abc_class VARCHAR(1) NOT NULL CHECK (abc_class IN ('A','B','C')),
    xyz_class VARCHAR(1) NOT NULL CHECK (xyz_class IN ('X','Y','Z')),
    velocity_score DOUBLE PRECISION,
    stability_cv DOUBLE PRECISION,
    pick_count BIGINT NOT NULL DEFAULT 0,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_abcxyz_warehouse_sku UNIQUE (warehouse_id, sku_id)
);

CREATE INDEX idx_abcxyz_warehouse ON abc_xyz_profiles(warehouse_id);
CREATE INDEX idx_abcxyz_class ON abc_xyz_profiles(warehouse_id, abc_class, xyz_class);
