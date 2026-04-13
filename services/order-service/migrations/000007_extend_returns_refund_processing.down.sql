DROP INDEX IF EXISTS idx_returns_refund_charge_payment_id;
DROP INDEX IF EXISTS idx_returns_refund_pending_retry;

ALTER TABLE returns
    DROP CONSTRAINT IF EXISTS returns_status_check;

ALTER TABLE returns
    DROP COLUMN IF EXISTS refund_processing_started_at,
    DROP COLUMN IF EXISTS refund_next_retry_at,
    DROP COLUMN IF EXISTS refund_completed_at,
    DROP COLUMN IF EXISTS refund_requested_at,
    DROP COLUMN IF EXISTS refund_attempt_count,
    DROP COLUMN IF EXISTS refund_last_error,
    DROP COLUMN IF EXISTS refund_idempotency_key,
    DROP COLUMN IF EXISTS refund_payment_id,
    DROP COLUMN IF EXISTS refund_charge_payment_id,
    DROP COLUMN IF EXISTS refund_amount;

ALTER TABLE returns
    ADD CONSTRAINT returns_status_check
    CHECK (status IN ('requested', 'approved', 'rejected', 'received', 'refunded', 'cancelled'));
