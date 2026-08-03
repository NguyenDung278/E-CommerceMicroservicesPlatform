-- Dòng đơn hàng phải nhớ đã bán variant nào, không chỉ sản phẩm nào.
--
-- Thiếu cột này thì đơn "áo thun size M" và "áo thun size L" lưu xuống giống hệt
-- nhau, kéo theo ba hệ quả: giữ chỗ tồn kho không biết trừ variant nào, returns
-- không biết nhận lại size nào, và người vận hành đọc đơn không biết cần lấy
-- hàng nào khỏi kho.
--
-- sku = '' là dòng của sản phẩm không khai báo variant, cũng là giá trị các đơn
-- cũ nhận được sau migration.
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS sku VARCHAR(120) NOT NULL DEFAULT '';

-- variant_label giữ nhãn hiển thị tại thời điểm mua ("Đen / size M"). Đây là
-- snapshot có chủ đích giống name và price: catalog đổi tên variant về sau
-- không được làm đơn cũ hiển thị sai thứ khách đã nhận.
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS variant_label VARCHAR(255) NOT NULL DEFAULT '';
