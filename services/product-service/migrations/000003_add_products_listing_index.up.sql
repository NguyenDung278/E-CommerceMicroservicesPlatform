CREATE INDEX IF NOT EXISTS idx_products_listing_created_at_id
    ON products (created_at DESC, id DESC);
