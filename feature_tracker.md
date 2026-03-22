# 🛒 Ecommerce Platform — Feature Tracker

> **Cập nhật lần cuối:** 2026-03-22
> Theo dõi tiến độ code dựa trên những gì đã được review trong codebase thực tế.

---

## Legend
| Symbol | Nghĩa |
|--------|-------|
| ✅ Done | Đã implement đầy đủ, production-ready |
| 🟡 Partial | Có code nhưng còn thiếu các tính năng quan trọng |
| 🔴 Planned | Chưa có, cần làm trong tương lai |
| ⬜ Backlog | Thấp ưu tiên, có thể để sau |

---

## 🔴 Ưu tiên Cao (Core Business)

### 1. Quản lý người dùng & Xác thực — ✅ Done
**Service:** `user-service`
**Stack:** Go + Echo, JWT (HS256), bcrypt (cost=12), PostgreSQL

**Đã làm:**
- [x] Đăng ký với email + số điện thoại
- [x] Đăng nhập bằng email HOẶC số điện thoại
- [x] Hashing mật khẩu với bcrypt (cost=12)
- [x] Phát access token + refresh token sau đăng ký / đăng nhập
- [x] Refresh token rotation qua `POST /api/v1/auth/refresh`
- [x] Xem và cập nhật profile
- [x] Đổi mật khẩu (`PUT /api/v1/users/password`)
- [x] RBAC: phân quyền `user` / `staff` / `admin` qua JWT claims
- [x] Shared [JWTAuth](file:///Users/nguyendung/FPT/projects/ecommerce-platform/pkg/middleware/auth.go#31-87) middleware & [RequireRole](file:///Users/nguyendung/FPT/projects/ecommerce-platform/pkg/middleware/auth.go#97-123) cho toàn bộ services
- [x] Bảo vệ chống email enumeration attack
- [x] Vai trò `staff` (hiện tại chỉ có `user` và `admin`)
- [x] Xác minh email sau đăng ký
- [x] Quên mật khẩu / reset (UI đã chừa sẵn slot)

---

### 2. Quản lý sản phẩm — 🟡 Partial
**Service:** `product-service`
**Stack:** Go + Echo, PostgreSQL

**Đã làm:**
- [x] CRUD sản phẩm (Name, Description, Price, Stock, Category, ImageURL)
- [x] Phân trang, tìm kiếm theo tên/mô tả (ILIKE), lọc theo category
- [x] Tìm kiếm và lọc cơ bản
- [x] Atomic UpdateStock (tránh race condition)
- [x] Admin-only routes với [RequireRole](file:///Users/nguyendung/FPT/projects/ecommerce-platform/pkg/middleware/auth.go#97-123)
- [x] gRPC server để Cart/Order service query sản phẩm
- [x] SKU / variants cơ bản lưu trong `products.variants`
- [x] Trạng thái bán: `draft` / `active` / `inactive`
- [x] Lọc theo `brand` / `tag` / `status`
- [x] Upload ảnh (hiện tại chỉ có URL field)
- [x] Multiple images cho một sản phẩm
- [x] Object storage (S3/MinIO)

---

### 3. Quản lý danh mục & Thuộc tính — 🟡 Partial
**Status:** Đã mở rộng trực tiếp trong `product-service`, chưa tách service/table riêng

**Đã làm:**
- [x] `Brand`, `Tag` fields trên `products`
- [x] Filter theo `brand` / `tag`
- [x] Product Variation cơ bản (size/màu dưới dạng SKU JSONB)

**Còn thiếu:**
- [ ] `Category` model với hierarchy (cha/con)
- [ ] `Brand`, `Tag` model riêng
- [ ] Cache danh mục với Redis

---

### 4. Giỏ hàng — ✅ Done
**Service:** `cart-service`
**Stack:** Go + Echo, PostgreSQL (lưu dưới dạng JSONB), gRPC client tới product-service

**Đã làm:**
- [x] Thêm sản phẩm vào giỏ (tự động tăng quantity nếu đã có)
- [x] Cập nhật số lượng sản phẩm
- [x] Xóa sản phẩm khỏi giỏ
- [x] Xem giỏ hàng của user
- [x] Xóa toàn bộ giỏ hàng (sau khi đặt hàng)
- [x] Kiểm tra tồn kho realtime qua gRPC trước khi thêm vào giỏ
- [x] Tự động tính tổng tiền
- [x] Merge cart dành cho khách vãng lai (guest cart merge)
- [x] TTL cho cart không hoạt động (qua Redis TTL, không cần cron job)

---

### 5. Tồn kho — 🟡 Partial
**Tích hợp trong:** `product-service`

**Đã làm:**
- [x] `stock` field trong bảng `products`
- [x] Atomic [UpdateStock](file:///Users/nguyendung/FPT/projects/ecommerce-platform/services/product-service/internal/repository/product_repository.go#18-19) SQL (`WHERE stock >= quantity`)
- [x] Kiểm tra tồn kho qua gRPC từ cart-service và order-service
- [x] Báo lỗi khi hết hàng
- [x] Cảnh báo tồn kho thấp bằng background monitor log-based

**Còn thiếu:**
- [ ] Service tồn kho riêng biệt (nếu muốn scale)
- [ ] Reservation/hold stock khi checkout (tránh oversell trong high traffic)
- [ ] Lịch sử nhập/xuất kho

---

### 6. Đơn hàng — ✅ Done
**Service:** `order-service`
**Stack:** Go + Echo, PostgreSQL, RabbitMQ

**Đã làm:**
- [x] Tạo đơn hàng với item snapshot + giá thực tế từ product-service
- [x] Kiểm tra tồn kho trước khi tạo đơn
- [x] Lưu trạng thái đơn: `pending`, `paid`, `shipped`, `delivered`, `cancelled`, `refunded`
- [x] Xem đơn hàng của user (bảo mật userID)
- [x] Hủy đơn pending từ phía user
- [x] Hoàn kho best-effort khi hủy đơn pending
- [x] Timeline/history của đơn qua `order_events`
- [x] Admin: xem tất cả đơn hàng, chi tiết, timeline, cập nhật trạng thái
- [x] Publish `order.created` event tới RabbitMQ
- [x] Publish `order.cancelled` event tới RabbitMQ
- [x] Event-driven architecture với notification-service

**Còn thiếu:**
- [x] Địa chỉ giao hàng lưu trong đơn

---

### 7. Thanh toán — 🟡 Partial
**Service:** `payment-service`
**Stack:** Go + Echo, PostgreSQL, RabbitMQ

**Đã làm:**
- [x] Tạo payment record
- [x] Kiểm tra duplicate payment
- [x] Xác minh total amount từ order-service (backend, không tin client)
- [x] Publish `payment.completed` / `payment.failed` events
- [x] Lấy thông tin payment theo ID hoặc orderID

**Còn thiếu:**
- [ ] Tích hợp cổng thanh toán thật (Stripe, VNPay, MoMo)
- [ ] Webhook nhận callback từ payment gateway
- [ ] Webhook signature verification
- [ ] Partial payment / split payment
- [ ] Refund API

---

### 8. Địa chỉ giao hàng & Checkout — 🟡 Partial
**Status:** CRUD địa chỉ đã có trong `user-service`, chưa nối đầy đủ vào checkout/order

**Đã làm:**
- [x] Model `Address` (người nhận, địa chỉ, SĐT)
- [x] CRUD địa chỉ nhận hàng theo user
- [x] Set địa chỉ mặc định

**Còn thiếu:**
- [x] Lưu địa chỉ vào đơn hàng khi checkout
- [x] Chọn phương thức vận chuyển
- [x] Tính phí ship

---

### 9. Tính giá, Khuyến mãi, Voucher — 🟡 Partial
**Status:** Đã implement backend core trong `order-service` để giữ stack đơn giản, chưa tách service riêng

**Đã làm:**
- [x] Model `Coupon` / `Voucher`
- [x] API admin tạo coupon
- [x] API admin xem danh sách coupon
- [x] Áp coupon khi tạo order (`coupon_code`)
- [x] Preview coupon ở cart/checkout trước khi đặt hàng
- [x] Giảm theo % hoặc số tiền cố định
- [x] Điều kiện: đơn tối thiểu, số lần dùng, thời hạn
- [x] Lock và consume voucher khi checkout bằng transaction + `SELECT ... FOR UPDATE`
- [x] UI quản trị coupon

**Còn thiếu:**
- [ ] Rule nâng cao: giới hạn theo user, category, product

---

### 10. Logging, Monitoring & Audit — ✅ Done
**Tích hợp trong:** `pkg/middleware`, mọi service, `api-gateway`

**Đã làm:**
- [x] Structured logging với Zap
- [x] HTTP request logging (method, path, status, latency, IP)
- [x] Log phân cấp theo status code (Info/Warn/Error)
- [x] Prometheus metrics endpoint (`/metrics`)
- [x] Middleware Recover cho panic
- [x] Error wrapping với `%w` để trace rõ ràng

**Còn thiếu:**
- [ ] Distributed tracing với OpenTelemetry / Jaeger
- [ ] Audit table cho các thao tác quan trọng (xóa đơn, refund)
- [ ] Grafana dashboard

---

### 11. Rate Limiting, Bảo mật API — ✅ Done
**Tích hợp trong:** `pkg/middleware`, mọi service

**Đã làm:**
- [x] In-memory rate limiter (token bucket) trên mỗi service
- [x] Identify bằng UserID (JWT) hoặc IP
- [x] Custom CORS chỉ cho phép origins cụ thể
- [x] HTTPS-safe headers với `echomw.Secure()`
- [x] Input validation bằng `go-playground/validator`
- [x] Parameterized SQL queries (chống SQL injection)
- [x] Circuit breaker + retry ở API Gateway

**Còn thiếu:**
- [ ] Redis-backed rate limiter (cho multi-instance deployment)
- [ ] Brute force protection cho login endpoint (vd: lock sau 5 lần sai)

---

## 🟡 Ưu tiên Trung bình

### 12. Tìm kiếm & Lọc sản phẩm — 🟡 Partial
**Tích hợp trong:** `product-service`

**Đã làm:**
- [x] Full-text search theo name + description (PostgreSQL ILIKE)
- [x] Lọc theo category
- [x] Lọc theo brand / tag / status
- [x] Phân trang

**Còn thiếu:**
- [ ] Lọc theo khoảng giá
- [ ] Lọc theo thuộc tính (size, màu)
- [ ] Sort theo giá, mới nhất, phổ biến
- [ ] Elasticsearch/Meilisearch nếu cần full-text nâng cao

---

### 13. Quản trị đơn hàng (Admin) — 🟡 Partial
**Đã làm:**
- [x] API: Xem tất cả đơn hàng (admin)
- [x] API: Tìm kiếm/lọc đơn theo user, status, ngày
- [x] API: Xem chi tiết đơn hàng (admin)
- [x] API: Xem timeline đơn hàng (admin)
- [x] API: Cập nhật trạng thái đơn (paid, shipped, delivered, cancelled, refunded)
- [x] API: Báo cáo admin giữ tương thích route cũ `/api/v1/orders/admin/report`

**Còn thiếu:**
- [ ] API: Hủy đơn thủ công, hoàn tiền
- [ ] RBAC phân quyền `staff`

---

### 14. Thông báo hệ thống — 🟡 Partial
**Service:** `notification-service`
**Stack:** Go, RabbitMQ consumer, SMTP sender

**Đã làm:**
- [x] Consumer RabbitMQ (đọc `order.created`, `payment.completed`, `payment.failed`)
- [x] Log thông báo dạng mô phỏng (simulate email/SMS)
- [x] Retry + nack message khi lỗi parse
- [x] Gửi email thật qua SMTP nếu có config
- [x] Fallback sang log nếu môi trường chưa cấu hình SMTP
- [x] Email template text cơ bản cho order created / payment completed / payment failed

**Còn thiếu:**
- [ ] Gửi SMS (Twilio hoặc nhà cung cấp nội địa)
- [ ] In-app notification
- [ ] HTML template / đa ngôn ngữ

---

### 15. Lịch sử & Theo dõi trạng thái đơn — 🟡 Partial
**Đã làm:**
- [x] Bảng `order_events` (audit log mỗi lần tạo đơn / đổi trạng thái)
- [x] API timeline cho user: `GET /api/v1/orders/:id/events`
- [x] API timeline cho admin: `GET /api/v1/admin/orders/:id/events`

**Còn thiếu:**
- [ ] Liên kết payment history với order history

---

### 16. Báo cáo & Thống kê kinh doanh — 🟡 Partial
**Đã làm:**
- [x] Báo cáo admin theo cửa sổ 7/30/90 ngày
- [x] Số lượng đơn hàng, tỷ lệ hủy
- [x] Top sản phẩm bán chạy
- [x] Giá trị đơn hàng trung bình (AOV)
- [x] Dashboard admin frontend cho snapshot kinh doanh

**Còn thiếu:**
- [ ] Chuỗi doanh thu theo ngày/tháng
- [ ] Materialized views cho query nhanh
- [ ] Export CSV / BI-oriented endpoints

---

### 17. Hoàn tiền & Hủy đơn — 🟡 Partial
**Đã làm:**
- [x] API hủy đơn phía user cho đơn `pending`
- [x] Hoàn kho best-effort khi hủy đơn pending
- [x] Payment status có trạng thái `refunded` để sẵn cho bước tích hợp sau

**Còn thiếu:**
- [ ] API hủy đơn sau thanh toán / hủy thủ công từ admin
- [ ] API refund (partial và full)
- [ ] Tích hợp refund với payment gateway

---

### 18. Job nền & Tác vụ định kỳ — 🟡 Partial
**Đã làm:**
- [x] Background job monitor tồn kho thấp trong `product-service`

**Còn thiếu:**
- [ ] Cron job dọn cart cũ (TTL)
- [ ] Sync trạng thái thanh toán với gateway
- [ ] Retry gửi thông báo thất bại
- [ ] Tổng hợp báo cáo hàng ngày

---

## ⬜ Ưu tiên Thấp (Backlog)

### 19. Đánh giá & Nhận xét sản phẩm — 🔴 Planned
- [ ] Model `Review` (rating 1-5 sao, comment, user đã mua)
- [ ] Kiểm tra user đã mua trước khi cho review
- [ ] Hiển thị rating trung bình
- [ ] Moderation cơ bản

---

### 20. Danh sách yêu thích — 🔴 Planned
- [ ] `Wishlist` table theo user
- [ ] Thêm/xóa sản phẩm yêu thích
- [ ] Xem danh sách yêu thích

---

## 📊 Tổng kết tiến độ

| Trạng thái | Số lượng |
|------------|----------|
| ✅ Done | 5 |
| 🟡 Partial | 13 |
| 🔴 Planned | 2 |
| ⬜ Backlog | 0 |
| **Tổng** | **20** |

---

## 🎯 Roadmap đề xuất

### Giai đoạn tiếp theo (Sprint 1-2)
1. **Quên mật khẩu + xác minh email** → user-service
2. **Nối địa chỉ vào checkout/order + phí ship** → user-service + order-service
3. **Tích hợp thanh toán thật** (Stripe/VNPay) → payment-service
4. **Refund + admin cancel sau thanh toán** → payment-service + order-service

### Giai đoạn 2 (Sprint 3-4)
5. **Voucher/Coupon** → implemented trong `order-service` để giữ stack đơn giản
6. **Admin quản trị đơn hàng** → order-service
7. **Notification email thật** → notification-service
8. **Order timeline** → order-service

### Giai đoạn 3 (Sprint 5-6)
9. **Category/Brand/Tag** → đã triển khai theo hướng mở rộng `product-service`
10. **Product variants/SKU** → đã triển khai mức cơ bản trong `product-service`
11. **Báo cáo & thống kê** → đã triển khai snapshot admin report trong `order-service`
12. **Job nền** → đã triển khai low-stock monitor, các cron khác còn backlog
