CREATE TABLE IF NOT EXISTS orders (
    id          VARCHAR(36)    PRIMARY KEY,
    user_id     VARCHAR(36)    NOT NULL,
    status      VARCHAR(20)    NOT NULL DEFAULT 'pending',
    total_price DECIMAL(10,2)  NOT NULL,
    created_at  TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP      NOT NULL DEFAULT NOW()
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
