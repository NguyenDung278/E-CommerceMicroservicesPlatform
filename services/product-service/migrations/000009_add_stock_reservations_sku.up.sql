-- Giữ chỗ tồn kho phải phân biệt được từng variant, không chỉ từng product.
-- Trước migration này, ledger khoá theo (order_id, product_id) nên hai variant
-- khác nhau của cùng một sản phẩm (size M và size L) cùng rút một bộ đếm
-- `products.stock` — vẫn oversell theo size dù pattern reservation đã đúng.
--
-- sku = '' nghĩa là giữ chỗ ở mức product, chỉ hợp lệ cho sản phẩm không khai
-- báo variant nào. Default '' cũng chính là giá trị các dòng ledger cũ nhận
-- được, nên reservation đang treo lúc migrate vẫn release đúng về kho tổng.
ALTER TABLE stock_reservations
    ADD COLUMN IF NOT EXISTS sku VARCHAR(120) NOT NULL DEFAULT '';

-- Khoá chính mở rộng theo sku: một order giữ chỗ nhiều variant của cùng một
-- sản phẩm là hợp lệ, nhưng giữ chỗ hai lần cùng một variant thì không.
ALTER TABLE stock_reservations DROP CONSTRAINT IF EXISTS stock_reservations_pkey;
ALTER TABLE stock_reservations ADD PRIMARY KEY (order_id, product_id, sku);
