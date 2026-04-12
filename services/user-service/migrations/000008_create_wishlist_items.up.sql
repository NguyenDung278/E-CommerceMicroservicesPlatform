CREATE TABLE IF NOT EXISTS wishlist_items (
    user_id    VARCHAR(36)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id VARCHAR(120) NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_items_user_updated
    ON wishlist_items (user_id, updated_at DESC);
