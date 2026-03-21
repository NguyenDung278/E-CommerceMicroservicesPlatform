ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS subtotal_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(64);

UPDATE orders
SET subtotal_price = total_price
WHERE subtotal_price = 0;

CREATE TABLE IF NOT EXISTS coupons (
    id               VARCHAR(36)   PRIMARY KEY,
    code             VARCHAR(64)   NOT NULL UNIQUE,
    description      VARCHAR(255)  NOT NULL DEFAULT '',
    discount_type    VARCHAR(20)   NOT NULL CHECK (discount_type IN ('fixed', 'percentage')),
    discount_value   DECIMAL(10,2) NOT NULL,
    min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    usage_limit      INTEGER       NOT NULL DEFAULT 0,
    used_count       INTEGER       NOT NULL DEFAULT 0,
    active           BOOLEAN       NOT NULL DEFAULT TRUE,
    expires_at       TIMESTAMP     NULL,
    created_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(active);

CREATE TABLE IF NOT EXISTS order_events (
    id         VARCHAR(36)  PRIMARY KEY,
    order_id    VARCHAR(36) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    event_type  VARCHAR(50) NOT NULL,
    status      VARCHAR(20) NOT NULL,
    actor_id    VARCHAR(36),
    actor_role  VARCHAR(20),
    message     TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_events_order_created_at ON order_events(order_id, created_at);
