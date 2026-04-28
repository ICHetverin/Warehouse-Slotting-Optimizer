-- ============================================================
--  V1: Initial schema for Warehouse Slot Optimization SaaS
-- ============================================================

-- ── warehouses ───────────────────────────────────────────────
CREATE TABLE warehouses (
    id             BIGSERIAL    PRIMARY KEY,
    name           VARCHAR(255) NOT NULL,
    rows           INTEGER      NOT NULL CHECK (rows > 0),
    columns        INTEGER      NOT NULL CHECK (columns > 0),
    dock_x         INTEGER      NOT NULL,
    dock_y         INTEGER      NOT NULL,
    aisle_width_m  NUMERIC(5,2) NOT NULL DEFAULT 1.5,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── skus ─────────────────────────────────────────────────────
CREATE TABLE skus (
    id            BIGSERIAL     PRIMARY KEY,
    warehouse_id  BIGINT        NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    code          VARCHAR(100)  NOT NULL,
    name          VARCHAR(255)  NOT NULL,
    weight_kg     NUMERIC(8,3)  NOT NULL CHECK (weight_kg >= 0),
    volume_m3     NUMERIC(8,4),
    category      VARCHAR(100),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_sku_code_warehouse UNIQUE (warehouse_id, code)
);

CREATE INDEX idx_skus_warehouse ON skus(warehouse_id);

-- ── slots ─────────────────────────────────────────────────────
CREATE TABLE slots (
    id               BIGSERIAL    PRIMARY KEY,
    warehouse_id     BIGINT       NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    current_sku_id   BIGINT       REFERENCES skus(id) ON DELETE SET NULL,
    label            VARCHAR(20)  NOT NULL,
    row              INTEGER      NOT NULL CHECK (row >= 0),
    col              INTEGER      NOT NULL CHECK (col >= 0),
    level            INTEGER      NOT NULL DEFAULT 1 CHECK (level >= 1),
    zone             VARCHAR(10),
    capacity_kg      NUMERIC(8,2) NOT NULL CHECK (capacity_kg > 0),

    CONSTRAINT uq_slot_label_warehouse UNIQUE (warehouse_id, label)
);

CREATE INDEX idx_slots_warehouse      ON slots(warehouse_id);
CREATE INDEX idx_slots_current_sku    ON slots(current_sku_id) WHERE current_sku_id IS NOT NULL;

-- ── orders ────────────────────────────────────────────────────
CREATE TABLE orders (
    id            BIGSERIAL     PRIMARY KEY,
    warehouse_id  BIGINT        NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    external_id   VARCHAR(100)  NOT NULL,
    created_at    TIMESTAMPTZ   NOT NULL
);

CREATE INDEX idx_orders_warehouse_created ON orders(warehouse_id, created_at DESC);

-- ── order_lines ───────────────────────────────────────────────
CREATE TABLE order_lines (
    id        BIGSERIAL  PRIMARY KEY,
    order_id  BIGINT     NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sku_id    BIGINT     NOT NULL REFERENCES skus(id),
    quantity  INTEGER    NOT NULL CHECK (quantity > 0)
);

CREATE INDEX idx_order_lines_order ON order_lines(order_id);
CREATE INDEX idx_order_lines_sku   ON order_lines(sku_id);

-- ── recommendations ───────────────────────────────────────────
CREATE TABLE recommendations (
    id               BIGSERIAL      PRIMARY KEY,
    warehouse_id     BIGINT         NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    sku_id           BIGINT         NOT NULL REFERENCES skus(id),
    from_slot_id     BIGINT         REFERENCES slots(id) ON DELETE SET NULL,
    to_slot_id       BIGINT         NOT NULL REFERENCES slots(id),
    score_delta      NUMERIC(10,4)  NOT NULL,
    explanation_json JSONB,
    status           VARCHAR(20)    NOT NULL DEFAULT 'PENDING'
                                    CHECK (status IN ('PENDING','ACCEPTED','REJECTED')),
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rec_warehouse_status ON recommendations(warehouse_id, status);
CREATE INDEX idx_rec_sku              ON recommendations(sku_id);
CREATE INDEX idx_rec_created          ON recommendations(created_at DESC);

-- GIN-индекс для быстрого поиска внутри explanation_json
CREATE INDEX idx_rec_explanation_gin  ON recommendations USING GIN (explanation_json);
