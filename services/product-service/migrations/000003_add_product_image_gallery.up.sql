ALTER TABLE products
ADD COLUMN IF NOT EXISTS image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE products
SET image_urls = CASE
    WHEN image_url IS NULL OR image_url = '' THEN '[]'::jsonb
    ELSE jsonb_build_array(image_url)
END
WHERE image_urls = '[]'::jsonb;
