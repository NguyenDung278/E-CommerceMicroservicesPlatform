DROP INDEX IF EXISTS idx_featured_products_product_external_id;
DROP INDEX IF EXISTS idx_editorial_sections_category_position;
DROP INDEX IF EXISTS idx_category_aliases_category_slug;
DROP INDEX IF EXISTS idx_products_category_slug_rank;
DROP INDEX IF EXISTS idx_products_category_slug;

ALTER TABLE products
    DROP CONSTRAINT IF EXISTS products_category_slug_fkey;

DROP TABLE IF EXISTS featured_products;
DROP TABLE IF EXISTS editorial_sections;
DROP TABLE IF EXISTS category_aliases;
DROP TABLE IF EXISTS categories;

ALTER TABLE products
    DROP CONSTRAINT IF EXISTS products_external_id_unique;

ALTER TABLE products
    DROP COLUMN IF EXISTS merchandising_rank,
    DROP COLUMN IF EXISTS material,
    DROP COLUMN IF EXISTS category_slug,
    DROP COLUMN IF EXISTS external_id;
