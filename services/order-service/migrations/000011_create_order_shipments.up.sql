CREATE TABLE IF NOT EXISTS order_shipments (
    id                    VARCHAR(36)  PRIMARY KEY,
    order_id              VARCHAR(36)  NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    carrier               VARCHAR(80)  NOT NULL,
    tracking_number       VARCHAR(120) NOT NULL,
    tracking_url          VARCHAR(512) NOT NULL DEFAULT '',
    status                VARCHAR(40)  NOT NULL DEFAULT 'pending',
    estimated_delivery_at TIMESTAMP    NULL,
    last_checked_at       TIMESTAMP    NULL,
    created_at            TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_shipments_order_id ON order_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_shipments_status ON order_shipments(status);
