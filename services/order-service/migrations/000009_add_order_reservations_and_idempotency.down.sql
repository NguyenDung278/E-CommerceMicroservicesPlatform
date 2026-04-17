DROP TABLE IF EXISTS order_idempotency_keys;

DROP INDEX IF EXISTS idx_orders_pending_reservations;

ALTER TABLE orders
    DROP COLUMN IF EXISTS reservation_allocated_at,
    DROP COLUMN IF EXISTS reservation_expires_at;
