CREATE TABLE IF NOT EXISTS product_reviews (
    id           VARCHAR(36)   PRIMARY KEY,
    product_id   VARCHAR(36)   NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id      VARCHAR(36)   NOT NULL,
    author_label VARCHAR(120)  NOT NULL,
    rating       SMALLINT      NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment      TEXT          NOT NULL DEFAULT '',
    created_at   TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP     NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_created_at
    ON product_reviews(product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_reviews_user_id
    ON product_reviews(user_id);
