CREATE TABLE IF NOT EXISTS returns (
    id         VARCHAR(36)   PRIMARY KEY,
    order_id    VARCHAR(36)   NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id     VARCHAR(36)   NOT NULL,
    user_email  VARCHAR(255)  NOT NULL DEFAULT '',
    status      VARCHAR(20)   NOT NULL CHECK (status IN ('requested', 'approved', 'rejected', 'received', 'refunded', 'cancelled')),
    reason      VARCHAR(255)  NOT NULL DEFAULT '',
    created_at  TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_returns_order_created_at ON returns(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_returns_user_id ON returns(user_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);

CREATE TABLE IF NOT EXISTS return_items (
    id            VARCHAR(36)   PRIMARY KEY,
    return_id      VARCHAR(36)   NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    order_item_id  VARCHAR(36)   NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
    product_id     VARCHAR(36)   NOT NULL,
    quantity       INTEGER       NOT NULL CHECK (quantity > 0),
    reason         VARCHAR(255)  NOT NULL DEFAULT '',
    created_at     TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON return_items(return_id);

CREATE TABLE IF NOT EXISTS return_events (
    id         VARCHAR(36)  PRIMARY KEY,
    return_id   VARCHAR(36)  NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    status      VARCHAR(20)  NOT NULL,
    actor_id    VARCHAR(36),
    actor_role  VARCHAR(20),
    message     TEXT         NOT NULL DEFAULT '',
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_events_return_created_at ON return_events(return_id, created_at);
