CREATE TABLE IF NOT EXISTS payments (
    id             VARCHAR(36)    PRIMARY KEY,
    order_id       VARCHAR(36)    UNIQUE NOT NULL,
    user_id        VARCHAR(36)    NOT NULL,
    amount         DECIMAL(10,2)  NOT NULL,
    status         VARCHAR(20)    NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50)    NOT NULL,
    created_at     TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
