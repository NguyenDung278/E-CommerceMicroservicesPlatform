ALTER TABLE products
    ADD COLUMN IF NOT EXISTS external_id VARCHAR(120),
    ADD COLUMN IF NOT EXISTS category_slug VARCHAR(80),
    ADD COLUMN IF NOT EXISTS material VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS merchandising_rank INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'products_external_id_unique'
    ) THEN
        ALTER TABLE products
            ADD CONSTRAINT products_external_id_unique UNIQUE (external_id);
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS categories (
    slug          VARCHAR(80)   PRIMARY KEY,
    display_name  VARCHAR(120)  NOT NULL,
    nav_label     VARCHAR(80)   NOT NULL,
    status        VARCHAR(20)   NOT NULL DEFAULT 'active',
    hero          JSONB         NOT NULL DEFAULT '{}'::jsonb,
    filter_config JSONB         NOT NULL DEFAULT '[]'::jsonb,
    seo           JSONB         NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS category_aliases (
    category_slug VARCHAR(80)  NOT NULL REFERENCES categories(slug) ON DELETE CASCADE,
    alias         VARCHAR(120) NOT NULL,
    PRIMARY KEY (category_slug, alias),
    CONSTRAINT category_aliases_alias_unique UNIQUE (alias)
);

CREATE TABLE IF NOT EXISTS editorial_sections (
    id            VARCHAR(36)  PRIMARY KEY,
    category_slug VARCHAR(80)  NOT NULL REFERENCES categories(slug) ON DELETE CASCADE,
    section_type  VARCHAR(40)  NOT NULL,
    position      INTEGER      NOT NULL,
    payload       JSONB        NOT NULL,
    published     BOOLEAN      NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS featured_products (
    id                  VARCHAR(36)  PRIMARY KEY,
    product_external_id VARCHAR(120) NOT NULL REFERENCES products(external_id) ON DELETE CASCADE,
    category_slug       VARCHAR(80)  NOT NULL REFERENCES categories(slug) ON DELETE CASCADE,
    position            INTEGER      NOT NULL,
    CONSTRAINT featured_products_category_position_unique UNIQUE (category_slug, position)
);

-- Seed legacy product.category values into categories before adding the FK so
-- pre-existing products do not make the migration dirty.
INSERT INTO categories (
    slug,
    display_name,
    nav_label,
    status,
    hero,
    filter_config,
    seo,
    created_at,
    updated_at
)
SELECT DISTINCT
    TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(TRIM(category), '[^a-zA-Z0-9]+', '-', 'g'))) AS slug,
    TRIM(category) AS display_name,
    TRIM(category) AS nav_label,
    'active',
    '{}'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb,
    NOW(),
    NOW()
FROM products
WHERE NULLIF(TRIM(category), '') IS NOT NULL
ON CONFLICT (slug) DO NOTHING;

UPDATE products
SET category_slug = TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(TRIM(category), '[^a-zA-Z0-9]+', '-', 'g')))
WHERE category_slug IS NULL
  AND NULLIF(TRIM(category), '') IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'products_category_slug_fkey'
    ) THEN
        ALTER TABLE products
            ADD CONSTRAINT products_category_slug_fkey
            FOREIGN KEY (category_slug) REFERENCES categories(slug) ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_products_category_slug
    ON products (category_slug);

CREATE INDEX IF NOT EXISTS idx_products_category_slug_rank
    ON products (category_slug, merchandising_rank ASC, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_category_aliases_category_slug
    ON category_aliases (category_slug);

CREATE INDEX IF NOT EXISTS idx_editorial_sections_category_position
    ON editorial_sections (category_slug, position ASC);

CREATE INDEX IF NOT EXISTS idx_featured_products_product_external_id
    ON featured_products (product_external_id);
