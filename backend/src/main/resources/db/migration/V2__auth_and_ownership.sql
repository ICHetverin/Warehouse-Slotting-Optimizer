-- ============================================================
--  V2: Users, JWT auth, warehouse ownership & demo isolation
-- ============================================================

-- ── users ────────────────────────────────────────────────────
CREATE TABLE users (
    id             BIGSERIAL     PRIMARY KEY,
    email          VARCHAR(255)  NOT NULL,
    password_hash  VARCHAR(255)  NOT NULL,
    role           VARCHAR(20)   NOT NULL DEFAULT 'USER'
                                 CHECK (role IN ('USER', 'ADMIN')),
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_users_email UNIQUE (email)
);

-- ── warehouse ownership + demo flag ──────────────────────────
ALTER TABLE warehouses
    ADD COLUMN owner_id BIGINT  REFERENCES users(id) ON DELETE CASCADE,
    ADD COLUMN is_demo  BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_warehouses_owner ON warehouses(owner_id);
CREATE INDEX idx_warehouses_demo  ON warehouses(is_demo) WHERE is_demo = TRUE;

-- Any warehouse already named "Demo Warehouse" (seeded earlier) is marked demo.
UPDATE warehouses SET is_demo = TRUE WHERE name = 'Demo Warehouse';
