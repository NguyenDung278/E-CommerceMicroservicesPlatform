# Thiết Kế Cơ Sở Dữ Liệu Backend (Backend Database Schema)

Tài liệu này mô tả chi tiết lược đồ và thiết kế cơ sở dữ liệu (CSDL) cho các microservices backend trong hệ thống E-commerce. Nền tảng được tối ưu để hoạt động độc lập theo từng Domain, duy trì tính nhất quán mà không làm mất đi khả năng mở rộng.

## 1. Tổng quan (Overview)

Hệ thống tuân theo các nguyên tắc **Microservices & Domain-Driven Design (DDD)**. Thay vì dùng chung một CSDL duy nhất (Monolithic Database), mỗi service sẽ tự quản lý CSDL riêng của mình:
- **Cơ sở dữ liệu chính (Relational)**: PostgreSQL. Được sử dụng bởi User, Order, Product, Payment Service (bền vững, transaction ACID).
- **Cơ sở dữ liệu Cache/Ephemeral (In-Memory)**: Redis. Được sử dụng chủ yếu bởi Cart Service, Notification Service, hệ thống Rate Limiting và Tracking/Idempotency.
- **Pattern áp dụng**: 
  - **Transactional Outbox/Inbox Pattern**: Được áp dụng trong CSDL để đảm bảo phát sự kiện (events publish) bằng RabbitMQ đồng bộ với các database transaction (như tạo đơn hàng).
  - **Read-Optimized Denormalization**: Các bảng như `product_review_summaries` được tính toán trước để giảm tải việc đếm/tính trung bình query.

---

## 2. Các Service Và CSDL Tương Ứng

### 2.1. User Service (PostgreSQL)

Quản lý thông tin định danh và địa chỉ của khách hàng.

* **Bảng `users`**:
  - `id` (VARCHAR 36, PK): UUID của người dùng.
  - `email` (VARCHAR 255, UNIQUE): Đăng nhập & liên lạc chính.
  - `phone` (VARCHAR 20): Số điện thoại (Unique constraint).
  - `password` (VARCHAR 255): Mật khẩu đã được mã hóa (hash).
  - `role` (VARCHAR 20): Mặc định là `user`.
  - `email_verified`, `phone_verified` (BOOLEAN): Đánh dấu trạng thái xác thực.
* **Bảng `addresses`**:
  - `id` (VARCHAR 36, PK)
  - `user_id` (VARCHAR 36, FK -> users.id, ON DELETE CASCADE)
  - `recipient_name`, `phone`, `street`, `ward`, `district`, `city`
  - `is_default` (BOOLEAN)
* **Bảng `user_oauth_accounts`**:
  - Cho phép người dùng đăng nhập bằng Google/Facebook (Chứa `provider` và `provider_user_id`).
* **Bảng `user_phone_verification_challenges`**:
  - Quản lý quá trình gửi mã OTP (có trạng thái `attempt_count`, `max_attempts`, trạng thái `pending`/`verified`/`consumed`).

### 2.2. Product Service (PostgreSQL)

* **Bảng `products`**:
  - `id` (VARCHAR 36, PK)
  - `name`, `description`, `price` (DECIMAL), `stock` (INTEGER).
  - `sku`, `brand`, `category`, `status`, `tags` (JSONB) và `variants`/`image_urls` (JSONB).
  - *Lưu ý: Hỗ trợ FTS (Full Text Search) qua bảng ảo index hoặc các index Gin / tsvector.*
* **Bảng `product_reviews`**:
  - Đóng vai trò quản lý nhận xét của khách hàng đã mua sản phẩm (có check rating chỉ nằm trong khoảng 1-5).
  - Mối quan hệ UNIQUE `(product_id, user_id)`.
* **Bảng `product_review_summaries`**:
  - Sử dụng cho Read Model nhằm tổng quan trực tiếp `review_count`, `rating_total`, `rating_{1-5}`...
  - Khi thêm review mới, bảng này được UPSERT (`ON CONFLICT DO UPDATE`) chứ không select hàm tính toán mỗi lần truy cập trang.

### 2.3. Order Service (PostgreSQL)

* **Bảng `orders`**:
  - `id` (VARCHAR 36, PK), `user_id`
  - `status` (VARCHAR 20): Trạng thái (pending, fulfilled, cancelled...)
  - `total_price`, `subtotal_price`, `discount_amount`, `shipping_fee` (DECIMAL 10,2)
  - Thông tin giao hàng (shipping details).
* **Bảng `order_items`**:
  - Các mảng mục của đơn hàng (`order_id`, `product_id`, `price`, `quantity`).
* **Bảng `order_events`**: 
  - Lưu dấu vết sự kiện (Audit Log / Sourcing) đối với tiến trình của đơn hàng để giải quyết tranh chấp (dùng `actor_id`, `actor_role`, `event_type`).
* **Bảng `coupons`**: Mã giảm giá và số lượng giới hạn áp dụng, limit attempts...
* **Bảng Cơ sở hạ tầng hệ thống**: `outbox_events`, `inbox_messages`, `audit_entries`.

### 2.4. Payment Service (PostgreSQL)

* **Bảng `payments`**:
  - Thiết kế có tính chống lỗi (Fault tolerance).
  - `id`, `order_id` (Không còn bị ràng buộc UNIQUE 1-1 khắt khe, thay vào đó cho phép nhiều payment log liên kết với một đơn qua `order_total`, `transaction_type`).
  - `status` (VARCHAR 20), `payment_method`
  - Thêm các gateway identifiers như `gateway_order_id`, `gateway_transaction_id` để reconciliation dữ liệu với Stripe, PayPal, vnpay.
* Tự động chứa các bảng `outbox_events` và `inbox_messages` tương tự như order service.

### 2.5. Cart Service (Redis)

* **Không dùng Table trong RDBMS.**
* **Nguyên nhân**: Dữ liệu giỏ hàng thường là dữ liệu không cần lưu vĩnh viễn (ephemeral) nếu người dùng không mua.
* **Cấu trúc lưu (JSON String)**:
  - Cache Key: `cart:{userID}`
  - Dữ liệu: `{"user_id": "...", "items": [{"product_id": "..", "quantity": 1}], "total": ...}`
* **TTL**: Carts được set Expire, ví dụ 7 ngày sau lần cuối update sẽ tự động purge giúp giải phóng bộ nhớ.

---

## 3. Mối Quan Hệ Giữa Các Bảng (Relationships)

Một đặc thù của kiểu kiến trúc Microservices này là **Foreign Keys (FK) chỉ tồn tại bên trong giới hạn của 1 service (Bounded Context)** để giữ nguyên tắc Loose Coupling:

1. **Inside Bounded Context**: Service quản lý liên kết trực tiếp bằng ID (Ví dụ: `user_oauth_accounts` tham chiếu foreign key trực tiếp đến bảng `users.id` kèm `ON DELETE CASCADE`).
2. **Across Bounded Contexts**: `orders.user_id` chỉ lưu `VARCHAR(36)` thay vì liên kết khoá ngoại tới user database. Khi truy xuất chi tiết, gateway/front-end hoặc internal gRPC service tự aggregate dữ liệu.

---

## 4. Ví dụ Dữ Liệu Mẫu

`orders` record:
| id | user_id | status | total_price | shipping_method | created_at |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ord_98bfe1` | `usr_a1b2` | `pending` | 250.00 | `express` | `2023-11-20 10:00:00` |

`order_items` record:
| id | order_id | product_id | name | price | quantity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `item_001` | `ord_98bfe1` | `prod_x7` | `Sneaker X` | 125.00 | 2 |

`outbox_events` (Trưởng thành hệ thống bất đồng bộ):
| id | aggregate_type | aggregate_id | event_type | routing_key | payload |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `evt_xxx` | `order` | `ord_98bfe1` | `OrderCreated` | `order.created` | `{"id": "ord_98bfe1", "total": 250.00}` |

---

## 5. Hướng Dẫn Cài Đặt và Migration

Dự án sử dụng file `.sql` raw được triển khai qua công cụ CLI `golang-migrate/migrate`.

Để tạo bảng hoặc chạy migration cho từng service, các module Makefile thường được setup (ví dụ `make migrate-up service=user-service`).

**Cấu trúc thư mục Migration:**
```text
services/<tên-service>/migrations/
├── 000001_create_users.up.sql    # Dùng khi migrate up
├── 000001_create_users.down.sql  # Dùng khi rollback
```

**Cách chạy manual (Ví dụ):**
```bash
migrate -path services/user-service/migrations -database "postgresql://user:pass@localhost:5432/user_db?sslmode=disable" up
```

---

## 6. Lưu Ý Quan Trọng Về Security và Hiệu Suất (Performance)

1. **Denormalization cho Read-Heavy**: `product_review_summaries` được update trực tiếp bằng `ON CONFLICT DO UPDATE`. Không bao giờ Count raw records cho endpoint listing.
2. **Postgres Pagination**: Tránh dùng `OFFSET`/`LIMIT` quá sâu trong `order-service` / `product-service` nếu dữ liệu lớn (như đã note trong `AGENTS.md`), ưu tiên `cursor pagination`.
3. **Index Tối Ưu Mật Độ Cột**:
   - Các trường status (`idx_products_status`, `idx_orders_status`).
   - Các field liên quan `created_at` thường được kẹp chung với khoá khoá ngoại để xử lý sorting hiệu năng cao: `idx_product_reviews_product_created_at_id`.
   - Cột `tags` (JSONB) và tên được đánh Full Text GIN Index.
4. **Idempotency (Bảo mật giao dịch)**: Bảng `inbox_messages` chỉ nhận `PRIMARY KEY(consumer, message_id)`. Nó chặn hoàn toàn việc nhận một Webhook/RabbitMQ message hai lần gây nguy hiểm tới việc thanh toán dupicated.
5. **Soft Rule về Ràng buộc (Constraints)**: Sử dụng check constraints (VD: `CHECK (rating BETWEEN 1 AND 5)` trong DB) thay vì chỉ xác thực trên code application, tránh được lỗi Race Conditions.
