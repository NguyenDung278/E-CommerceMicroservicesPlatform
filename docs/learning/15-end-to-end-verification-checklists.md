# End-To-End Verification Checklists

Tài liệu này là checklist verify theo flow thật của repo hiện tại. Mục tiêu là:

- giảm kiểu verify "API 200 là xong"
- buộc FE, gateway, service, async event, và DB contract được kiểm tra cùng nhau
- giúp bạn có một playbook ngắn gọn mỗi lần sửa `checkout`, `payment`, `returns`, hoặc `admin`

Nếu bạn chỉ có ít thời gian, hãy ưu tiên:

1. `checkout + create order idempotency`
2. `payment retry + payment history`
3. `return/refund async flow`
4. `admin order ledger + admin returns`

---

## 1. Chuẩn Bị

Trước khi chạy checklist:

- `make compose-up`
- `make migrate-up`
- đăng nhập được bằng user thường và admin/staff
- frontend chạy ở `http://localhost:4173` hoặc `http://localhost:5174`
- gateway chạy ở `http://localhost:8080`

Nên mở song song:

- frontend
- terminal log của service liên quan
- Jaeger nếu flow đi qua nhiều boundary

---

## 2. Catalog Và Product Detail

### Happy path

- mở home page và xác nhận category rail render đúng
- mở catalog `/products` và xác nhận filter/search/sort hoạt động
- mở một product detail và xác nhận:
- gallery render đủ ảnh
- variant đổi được
- wishlist toggle phản hồi đúng
- buy-now dẫn sang checkout

### Negative path

- mở product id không tồn tại và xác nhận UI fail gracefully
- thử variant hết hàng và xác nhận CTA/feedback đúng

---

## 3. Cart Và Guest Merge

### Happy path

- thêm sản phẩm vào cart khi chưa login
- login
- xác nhận guest cart được merge vào server cart
- refresh page và xác nhận cart không mất

### Negative path

- thêm sản phẩm vượt stock rồi login/merge
- xác nhận lỗi rõ ràng, cart không bị nhân đôi

---

## 4. Checkout Và Create Order

### Happy path

- vào checkout với cart có ít nhất 1 sản phẩm
- điền contact, chọn shipping method, chọn payment method
- submit checkout
- xác nhận order được tạo
- xác nhận order detail hiển thị đúng items, total, shipping

### Idempotency path

- submit checkout
- retry cùng request ngay sau đó
- xác nhận không tạo thêm order mới
- xác nhận response replay đúng order cũ

### Reservation path

- tạo một order pending
- không thanh toán
- chờ quá TTL reservation hoặc mô phỏng thời gian/hit lại order sau khi TTL hết
- xác nhận order chuyển `cancelled`
- xác nhận stock được restore

### Negative path

- thử checkout với product không đủ stock
- thử checkout với `Idempotency-Key` cũ nhưng payload khác
- xác nhận server trả conflict, không sinh side effect mới

---

## 5. Payment Và Retry Story

### Happy path

- tạo order với `manual`
- xác nhận payment được tạo và order chuyển `paid`
- mở payment history và order detail để xác nhận trạng thái đồng bộ

### Hosted checkout path

- tạo order với `momo`
- xác nhận payment pending có `checkout_url`
- mở order detail và xác nhận user nhìn thấy đường tiếp tục thanh toán

### Retry path

- tạo order thành công nhưng làm payment fail hoặc gián đoạn
- quay lại checkout
- xác nhận UI giữ `createdOrderId` và chỉ retry payment
- xác nhận không sinh order mới

### Idempotency path

- gọi create payment 2 lần với cùng `Idempotency-Key`
- xác nhận payment được replay
- gọi với cùng key nhưng payload khác
- xác nhận conflict

### Webhook / eventual consistency path

- bắn webhook MoMo giả lập
- xác nhận payment update đúng
- xác nhận order-service consume event và cập nhật order status

---

## 6. Returns Và Refund Queue

### Happy path

- từ một order delivered, tạo return request
- upload evidence
- staff/admin approve
- queue refund
- worker xử lý refund
- xác nhận return chuyển `refunded`

### Retry path

- làm refund worker fail một lần
- xác nhận `refund_pending`, `refund_last_error`, `refund_next_retry_at` được set
- retry worker
- xác nhận refund hoàn tất và không bị nhân đôi side effect

### Negative path

- tạo return cho order chưa delivered
- upload evidence vào return đã đóng
- retry refund khi lease đang bị worker giữ

---

## 7. Admin Dashboard

### Order ledger

- mở admin dashboard
- xác nhận recent order ledger load thành công
- bấm `Tải thêm đơn hàng`
- xác nhận admin order list lấy thêm bằng cursor, không reset danh sách cũ
- cancel một order pending/paid và xác nhận item được update tại chỗ

### Returns

- filter theo status
- chuyển trang
- queue refund / retry refund từ admin
- xác nhận queue health cập nhật

### Catalog / users / coupons

- create product
- upload image
- update product
- create coupon
- list users và đổi role

---

## 8. Khi Nào Coi Là Verify Xong

Một thay đổi chỉ nên coi là verify xong khi:

- frontend render đúng
- gateway route đúng
- service trả đúng business outcome
- negative path không tạo side effect bẩn
- async path cuối cùng hội tụ về trạng thái đúng
- log hoặc trace đủ để giải thích chuyện vừa xảy ra

Nếu chỉ mới test mỗi happy path, coi như chưa verify đủ.
