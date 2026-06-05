-- Audit trail for recommendation decisions: when it was accepted/rejected.
-- Lets the UI show *what* was accepted and *when*, and keeps that history.
ALTER TABLE recommendations
    ADD COLUMN decided_at TIMESTAMPTZ;

CREATE INDEX idx_rec_decided ON recommendations(warehouse_id, decided_at DESC);
