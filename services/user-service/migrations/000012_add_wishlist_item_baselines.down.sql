ALTER TABLE wishlist_items
    DROP COLUMN IF EXISTS baseline_price,
    DROP COLUMN IF EXISTS baseline_stock;
