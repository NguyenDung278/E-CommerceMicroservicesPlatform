CREATE TABLE IF NOT EXISTS products (
    id          VARCHAR(36)    PRIMARY KEY,
    name        VARCHAR(255)   NOT NULL,
    description TEXT           DEFAULT '',
    price       DECIMAL(10,2)  NOT NULL,
    stock       INTEGER        NOT NULL DEFAULT 0,
    category    VARCHAR(100)   DEFAULT '',
    image_url   VARCHAR(500)   DEFAULT '',
    created_at  TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(to_tsvector('english', name));
