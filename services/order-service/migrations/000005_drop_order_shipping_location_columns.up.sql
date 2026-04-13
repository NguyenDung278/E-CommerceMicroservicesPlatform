ALTER TABLE orders
    DROP COLUMN IF EXISTS shipping_street,
    DROP COLUMN IF EXISTS shipping_ward,
    DROP COLUMN IF EXISTS shipping_district,
    DROP COLUMN IF EXISTS shipping_city;
