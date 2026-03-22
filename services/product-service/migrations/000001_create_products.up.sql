CREATE TABLE IF NOT EXISTS products (
    id          VARCHAR(36)    PRIMARY KEY,
    name        VARCHAR(255)   NOT NULL,
    description TEXT           DEFAULT '',
    price       DECIMAL(10,2)  NOT NULL,
    stock       INTEGER        NOT NULL DEFAULT 0,
    category    VARCHAR(100)   DEFAULT '',
    image_url   VARCHAR(500)   DEFAULT '',
    brand       VARCHAR(120)   NOT NULL DEFAULT '',
    tags        JSONB          NOT NULL DEFAULT '[]'::jsonb,
    status      VARCHAR(20)    NOT NULL DEFAULT 'active',
    sku         VARCHAR(120)   NOT NULL DEFAULT '',
    variants    JSONB          NOT NULL DEFAULT '[]'::jsonb,
    image_urls  JSONB          NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING gin(tags);
