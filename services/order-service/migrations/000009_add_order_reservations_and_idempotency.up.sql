ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS reservation_allocated_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_orders_pending_reservations
    ON orders(status, reservation_expires_at)
    WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS order_idempotency_keys (
    user_id                 VARCHAR(36)  NOT NULL,
    idempotency_key         VARCHAR(128) NOT NULL,
    request_hash            CHAR(64)     NOT NULL,
    order_id                VARCHAR(36)  NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    reservation_expires_at  TIMESTAMP    NOT NULL,
    created_at              TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP    NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_order_idempotency_order_id
    ON order_idempotency_keys(order_id);
