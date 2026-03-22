CREATE TABLE IF NOT EXISTS orders (
    id              VARCHAR(36)    PRIMARY KEY,
    user_id         VARCHAR(36)    NOT NULL,
    status          VARCHAR(20)    NOT NULL DEFAULT 'pending',
    total_price     DECIMAL(10,2)  NOT NULL,
    subtotal_price  DECIMAL(10,2)  NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2)  NOT NULL DEFAULT 0,
    coupon_code             VARCHAR(64),
    shipping_method         VARCHAR(20)    NOT NULL DEFAULT 'standard',
    shipping_fee            DECIMAL(10,2)  NOT NULL DEFAULT 0,
    shipping_recipient_name VARCHAR(100),
    shipping_phone          VARCHAR(20),
    shipping_street         VARCHAR(255),
    shipping_ward           VARCHAR(100),
    shipping_district       VARCHAR(100),
    shipping_city           VARCHAR(100),
    created_at              TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
    id         VARCHAR(36)    PRIMARY KEY,
    order_id   VARCHAR(36)    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(36)    NOT NULL,
    name       VARCHAR(255)   NOT NULL,
    price      DECIMAL(10,2)  NOT NULL,
    quantity   INTEGER        NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

CREATE TABLE IF NOT EXISTS order_events (
    id          VARCHAR(36)  PRIMARY KEY,
    order_id    VARCHAR(36)  NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    event_type  VARCHAR(50)  NOT NULL,
    status      VARCHAR(20)  NOT NULL,
    actor_id    VARCHAR(36),
    actor_role  VARCHAR(20),
    message     TEXT         NOT NULL DEFAULT '',
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_events_order_created_at ON order_events(order_id, created_at);

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
