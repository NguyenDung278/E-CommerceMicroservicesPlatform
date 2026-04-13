CREATE TABLE IF NOT EXISTS payment_idempotency_keys (
    user_id         VARCHAR(36)   NOT NULL,
    idempotency_key VARCHAR(128)  NOT NULL,
    request_hash    VARCHAR(64)   NOT NULL,
    payment_id      VARCHAR(36)   NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    created_at      TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP     NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_idempotency_payment_id
ON payment_idempotency_keys(payment_id);
