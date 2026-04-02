DROP INDEX IF EXISTS idx_product_reviews_product_created_at_id;

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_created_at
    ON product_reviews(product_id, created_at DESC);

DROP TABLE IF EXISTS product_review_summaries;
