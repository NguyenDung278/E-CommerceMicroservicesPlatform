CREATE INDEX IF NOT EXISTS idx_orders_created_at_id_desc
    ON orders(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status_created_at_id_desc
    ON orders(status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_orders_user_created_at_id_desc
    ON orders(user_id, created_at DESC, id DESC);
