ALTER TABLE returns
    DROP CONSTRAINT IF EXISTS returns_status_check;

ALTER TABLE returns
    ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS refund_charge_payment_id VARCHAR(36) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS refund_payment_id VARCHAR(36) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS refund_idempotency_key VARCHAR(128) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS refund_last_error TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS refund_attempt_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS refund_completed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS refund_next_retry_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS refund_processing_started_at TIMESTAMP;

ALTER TABLE returns
    ADD CONSTRAINT returns_status_check
    CHECK (status IN ('requested', 'approved', 'rejected', 'received', 'refund_pending', 'refunded', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_returns_refund_pending_retry
ON returns(status, refund_next_retry_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_returns_refund_charge_payment_id
ON returns(refund_charge_payment_id);
