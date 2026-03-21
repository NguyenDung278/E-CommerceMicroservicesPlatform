DROP TABLE IF EXISTS order_events;
DROP TABLE IF EXISTS coupons;

ALTER TABLE orders
    DROP COLUMN IF EXISTS coupon_code,
    DROP COLUMN IF EXISTS discount_amount,
    DROP COLUMN IF EXISTS subtotal_price;
