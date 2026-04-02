CREATE TABLE IF NOT EXISTS product_review_summaries (
    product_id    VARCHAR(36) PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    review_count  BIGINT      NOT NULL DEFAULT 0,
    rating_total  BIGINT      NOT NULL DEFAULT 0,
    rating_one    BIGINT      NOT NULL DEFAULT 0,
    rating_two    BIGINT      NOT NULL DEFAULT 0,
    rating_three  BIGINT      NOT NULL DEFAULT 0,
    rating_four   BIGINT      NOT NULL DEFAULT 0,
    rating_five   BIGINT      NOT NULL DEFAULT 0,
    updated_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

INSERT INTO product_review_summaries (
    product_id,
    review_count,
    rating_total,
    rating_one,
    rating_two,
    rating_three,
    rating_four,
    rating_five,
    updated_at
)
SELECT
    product_id,
    COUNT(*) AS review_count,
    COALESCE(SUM(rating), 0) AS rating_total,
    COUNT(*) FILTER (WHERE rating = 1) AS rating_one,
    COUNT(*) FILTER (WHERE rating = 2) AS rating_two,
    COUNT(*) FILTER (WHERE rating = 3) AS rating_three,
    COUNT(*) FILTER (WHERE rating = 4) AS rating_four,
    COUNT(*) FILTER (WHERE rating = 5) AS rating_five,
    COALESCE(MAX(updated_at), NOW()) AS updated_at
FROM product_reviews
GROUP BY product_id
ON CONFLICT (product_id) DO UPDATE
SET review_count = EXCLUDED.review_count,
    rating_total = EXCLUDED.rating_total,
    rating_one = EXCLUDED.rating_one,
    rating_two = EXCLUDED.rating_two,
    rating_three = EXCLUDED.rating_three,
    rating_four = EXCLUDED.rating_four,
    rating_five = EXCLUDED.rating_five,
    updated_at = EXCLUDED.updated_at;

DROP INDEX IF EXISTS idx_product_reviews_product_created_at;

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_created_at_id
    ON product_reviews(product_id, created_at DESC, id DESC);
