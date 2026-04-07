# API Testing Guide

## 1. Giới thiệu

Tài liệu này hướng dẫn test toàn bộ bề mặt HTTP backend của dự án bằng Postman theo cách thực tế, dễ lặp lại, và đủ rõ cho cả dev mới lẫn người đã quen với hệ thống microservices.

Guide này bám theo source code hiện tại của repo:

- entrypoint HTTP chính là `api-gateway`
- contract public đi qua các route `/api/v1/*`
- xác thực dùng JWT Bearer Token
- response theo envelope chuẩn của `pkg/response`

Mục tiêu của file:

- giúp dựng bộ Postman Collection có cấu trúc rõ ràng
- giúp test happy path và các lỗi phổ biến
- giúp chain dữ liệu giữa các request bằng biến môi trường
- giúp verify nhanh các flow auth, catalog, cart, order, payment, admin

## 2. Phạm vi áp dụng

Guide này tập trung vào HTTP API có thể gọi trực tiếp qua Postman:

- xác thực và người dùng
- địa chỉ giao hàng và xác minh số điện thoại
- storefront public
- sản phẩm và đánh giá sản phẩm
- giỏ hàng
- đơn hàng, coupon, báo cáo admin
- thanh toán, refund, webhook

Không nằm trong phạm vi Postman trực tiếp:

- gRPC nội bộ giữa service
- RabbitMQ consumer của `notification-service`
- outbox/inbox internals

Các luồng async vẫn có thể được kiểm tra gián tiếp qua:

- order status
- payment history
- admin report
- log và trace

## 3. Cách dùng tài liệu này

Luồng khuyến nghị:

1. Chạy toàn bộ stack local bằng Docker Compose.
2. Tạo một Postman Environment theo mẫu biến ở dưới.
3. Tạo Collection theo thứ tự folder đề xuất.
4. Chạy tuần tự các request nền tảng:
   - health
   - register hoặc login
   - profile
   - products
   - cart
   - preview order
   - create order
   - process payment
5. Sau khi có token và ID cơ bản, chạy các case admin, review, refund, webhook.

## 4. Chuẩn bị môi trường Postman

### 4.1. Cài đặt

- Cài Postman Desktop hoặc Postman web + Postman Agent.
- Dùng Postman Desktop sẽ thuận tiện hơn khi test redirect, cookie và file upload.

### 4.2. Chạy backend local

Từ root repo:

```bash
cp .env.local.example .env.local
make compose-up
```

Base URL mặc định để test qua gateway:

```text
http://localhost:8080
```

### 4.3. Tài khoản test local

Nếu `user-service` bật `bootstrap.dev_accounts.enabled`, repo tạo sẵn:

- `admin.dev@ndshop.local` / `AdminTest!2026-ChangeMe`
- `staff.dev@ndshop.local` / `StaffTest!2026-ChangeMe`

Tài khoản này rất hữu ích để test:

- `/api/v1/admin/users`
- `/api/v1/admin/orders`
- `/api/v1/admin/coupons`
- `/api/v1/admin/payments`
- `/api/v1/products` với role staff/admin

### 4.4. Tạo Postman Environment

Tạo một environment ví dụ tên `ecommerce-local` với các biến sau:

| Biến | Giá trị gợi ý | Ghi chú |
| --- | --- | --- |
| `base_url` | `http://localhost:8080` | Base URL qua API Gateway |
| `access_token` | để trống | Token user thường |
| `refresh_token` | để trống | Refresh token user thường |
| `admin_access_token` | để trống | Token admin/staff |
| `user_id` | để trống | Lấy từ login/register |
| `address_id` | để trống | Lấy từ create address |
| `product_id` | để trống | Lấy từ list/get/create product |
| `review_id` | để trống | Thường không cần riêng, route dùng product ID |
| `order_id` | để trống | Lấy từ create order |
| `payment_id` | để trống | Lấy từ process payment |
| `coupon_code` | để trống | Lấy từ create coupon |
| `phone_verification_id` | để trống | Lấy từ send OTP |
| `oauth_ticket` | để trống | Lấy sau flow OAuth callback/exchange |
| `momo_signature` | để trống | Dùng nếu test webhook có chữ ký hợp lệ |

### 4.5. Import biến nếu muốn dùng file JSON

Bạn có thể tạo JSON thủ công để import:

```json
{
  "name": "ecommerce-local",
  "values": [
    { "key": "base_url", "value": "http://localhost:8080", "enabled": true },
    { "key": "access_token", "value": "", "enabled": true },
    { "key": "refresh_token", "value": "", "enabled": true },
    { "key": "admin_access_token", "value": "", "enabled": true },
    { "key": "user_id", "value": "", "enabled": true },
    { "key": "address_id", "value": "", "enabled": true },
    { "key": "product_id", "value": "", "enabled": true },
    { "key": "order_id", "value": "", "enabled": true },
    { "key": "payment_id", "value": "", "enabled": true },
    { "key": "coupon_code", "value": "", "enabled": true },
    { "key": "phone_verification_id", "value": "", "enabled": true }
  ]
}
```

## 5. Chuẩn response của API

Tất cả service HTTP đang dùng envelope chung:

```json
{
  "success": true,
  "message": "human-readable message",
  "data": {},
  "error": null,
  "meta": null
}
```

Khi lỗi:

```json
{
  "success": false,
  "message": "validation failed",
  "error": "email already exists"
}
```

Khi có phân trang:

```json
{
  "success": true,
  "message": "products retrieved",
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

Hoặc với cursor pagination:

```json
{
  "success": true,
  "message": "products retrieved",
  "data": [],
  "meta": {
    "limit": 20,
    "next_cursor": "eyJzb3J0IjoiLi4uIn0=",
    "has_next": true
  }
}
```

## 6. Cấu trúc Collection Postman đề xuất

Tạo collection theo các folder sau:

```text
E-Commerce Platform API
  00. Health
  01. Auth
  02. Users
  03. Addresses
  04. Phone Verification
  05. Storefront
  06. Products
  07. Product Reviews
  08. Cart
  09. Orders
  10. Coupons & Admin Orders
  11. Payments
  12. Admin Users
  99. Negative Tests
```

## 7. Header chuẩn

### 7.1. Header thường dùng

| Header | Giá trị |
| --- | --- |
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer {{access_token}}` |
| `Accept` | `application/json` |

### 7.2. Với request admin

```text
Authorization: Bearer {{admin_access_token}}
```

### 7.3. Với upload file

Không set tay `Content-Type: multipart/form-data` trong Postman. Hãy dùng tab `form-data`, Postman sẽ tự gắn boundary.

## 8. Danh sách endpoint theo nhóm

## 8.1. Health và kiểm tra gateway

### GET `/health`

- URL: `{{base_url}}/health`
- Mô tả: kiểm tra gateway còn sống.
- Header bắt buộc: không.
- Body request: không có.
- Thành công: `200 OK`.
- Lỗi thường gặp: `502`, `503` nếu gateway hoặc upstream có sự cố runtime.
- Lưu ý: đây là request nên chạy đầu tiên trước toàn bộ test suite.

## 8.2. Nhóm Auth

### Tổng quan

| Method | URL | Auth | Mục đích |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Public | Đăng ký tài khoản |
| `POST` | `/api/v1/auth/login` | Public | Đăng nhập bằng email hoặc phone |
| `POST` | `/api/v1/auth/refresh` | Public | Cấp lại token |
| `POST` | `/api/v1/auth/verify-email` | Public | Xác minh email |
| `POST` | `/api/v1/auth/forgot-password` | Public | Gửi yêu cầu reset password |
| `POST` | `/api/v1/auth/reset-password` | Public | Reset password bằng token |
| `GET` | `/api/v1/auth/oauth/google/start` | Public | Khởi động Google OAuth |
| `GET` | `/api/v1/auth/oauth/google/callback` | Public | Callback OAuth |
| `POST` | `/api/v1/auth/oauth/exchange` | Public | Đổi OAuth ticket lấy JWT |

### POST `/api/v1/auth/register`

- URL: `{{base_url}}/api/v1/auth/register`
- Headers: `Content-Type: application/json`
- Body mẫu:

```json
{
  "email": "alice@example.com",
  "phone": "0987654321",
  "password": "Password@123",
  "first_name": "Alice",
  "last_name": "Nguyen"
}
```

- Thành công: `201 Created`

```json
{
  "success": true,
  "message": "user registered successfully",
  "data": {
    "token": "jwt-access-token",
    "refresh_token": "refresh-token",
    "user": {
      "id": "uuid",
      "email": "alice@example.com",
      "phone": "0987654321",
      "phone_verified": false,
      "first_name": "Alice",
      "last_name": "Nguyen",
      "role": "user",
      "email_verified": false
    }
  }
}
```

- Lỗi thường gặp:
  - `400` nếu JSON sai hoặc email không hợp lệ
  - `409` nếu email hoặc phone đã tồn tại
- Lưu ý:
  - request này rất phù hợp để capture `access_token`, `refresh_token`, `user_id`
  - nếu muốn test nhanh admin flow, nên dùng tài khoản bootstrap thay vì đăng ký mới

### POST `/api/v1/auth/login`

- URL: `{{base_url}}/api/v1/auth/login`
- Headers: `Content-Type: application/json`
- Body mẫu:

```json
{
  "identifier": "alice@example.com",
  "password": "Password@123"
}
```

- Thành công: `200 OK`, `data` có `token`, `refresh_token`, `user`
- Lỗi thường gặp:
  - `400` nếu thiếu `identifier`
  - `401` nếu sai mật khẩu
  - `429` nếu bị khóa tạm thời vì login fail nhiều lần
- Lưu ý:
  - service có login protection, nên negative test sai mật khẩu liên tiếp có thể ra `429`

### POST `/api/v1/auth/refresh`

- URL: `{{base_url}}/api/v1/auth/refresh`
- Headers: `Content-Type: application/json`
- Body mẫu:

```json
{
  "refresh_token": "{{refresh_token}}"
}
```

- Thành công: `200 OK`, `data` có token mới
- Lỗi thường gặp:
  - `400` nếu thiếu `refresh_token`
  - `401` nếu refresh token hết hạn hoặc sai
- Lưu ý:
  - nên dùng test script để tự cập nhật `access_token`

### POST `/api/v1/auth/verify-email`

- URL: `{{base_url}}/api/v1/auth/verify-email`
- Headers: `Content-Type: application/json`
- Body mẫu:

```json
{
  "token": "email-verification-token"
}
```

- Thành công: `200 OK`
- Lỗi thường gặp:
  - `400` nếu body sai
  - `401` nếu token không hợp lệ hoặc đã hết hạn
- Lưu ý:
  - token thường đến từ email/link frontend

### POST `/api/v1/auth/forgot-password`

- URL: `{{base_url}}/api/v1/auth/forgot-password`
- Headers: `Content-Type: application/json`
- Body mẫu:

```json
{
  "email": "alice@example.com"
}
```

- Thành công: `200 OK`
- Lỗi thường gặp:
  - `400` nếu email không hợp lệ
  - `500` nếu queue/email delivery lỗi nội bộ
- Lưu ý:
  - API này có chủ đích trả shape thành công để không lộ thông tin tồn tại email

### POST `/api/v1/auth/reset-password`

- URL: `{{base_url}}/api/v1/auth/reset-password`
- Headers: `Content-Type: application/json`
- Body mẫu:

```json
{
  "token": "password-reset-token",
  "new_password": "NewPassword@123"
}
```

- Thành công: `200 OK`
- Lỗi thường gặp:
  - `400` nếu mật khẩu mới ngắn
  - `401` nếu token sai hoặc hết hạn

### GET `/api/v1/auth/oauth/google/start`

- URL: `{{base_url}}/api/v1/auth/oauth/google/start?redirect_to=/profile`
- Headers: tùy chọn `Origin`
- Body request: không có
- Thành công: `302 Found`, redirect tới Google OAuth
- Lỗi thường gặp:
  - `302` redirect về frontend với mã lỗi nếu provider chưa cấu hình
- Lưu ý:
  - đây là endpoint browser-oriented; Postman chỉ nên dùng để kiểm tra redirect và cookie

### GET `/api/v1/auth/oauth/google/callback`

- URL: callback do Google gọi lại
- Thành công: `302 Found`, redirect về frontend
- Lỗi thường gặp:
  - redirect lỗi khi `state` không hợp lệ
- Lưu ý:
  - Postman không phải công cụ lý tưởng để kiểm thử end-to-end callback này

### POST `/api/v1/auth/oauth/exchange`

- URL: `{{base_url}}/api/v1/auth/oauth/exchange`
- Headers: `Content-Type: application/json`
- Body mẫu:

```json
{
  "ticket": "{{oauth_ticket}}"
}
```

- Thành công: `200 OK`, `data` có token pair giống login
- Lỗi thường gặp:
  - `400` nếu thiếu `ticket`
  - `401` nếu ticket hết hạn

## 8.3. Nhóm Users, Profile, Address, Phone Verification

### Tổng quan

| Method | URL | Auth | Mục đích |
| --- | --- | --- | --- |
| `GET` | `/api/v1/users/profile` | JWT | Lấy profile |
| `PUT` | `/api/v1/users/profile` | JWT | Cập nhật profile |
| `PUT` | `/api/v1/users/password` | JWT | Đổi mật khẩu |
| `POST` | `/api/v1/users/verify-email/resend` | JWT | Gửi lại email verify |
| `GET` | `/api/v1/users/profile/phone-verification` | JWT | Xem trạng thái verify phone |
| `POST` | `/api/v1/users/profile/phone-verification/send-otp` | JWT | Gửi OTP |
| `POST` | `/api/v1/users/profile/phone-verification/verify-otp` | JWT | Xác thực OTP |
| `POST` | `/api/v1/users/profile/phone-verification/resend-otp` | JWT | Gửi lại OTP |
| `POST` | `/api/v1/users/addresses` | JWT | Tạo địa chỉ |
| `GET` | `/api/v1/users/addresses` | JWT | Danh sách địa chỉ |
| `PUT` | `/api/v1/users/addresses/:id` | JWT | Cập nhật địa chỉ |
| `DELETE` | `/api/v1/users/addresses/:id` | JWT | Xóa địa chỉ |
| `PUT` | `/api/v1/users/addresses/:id/default` | JWT | Đặt địa chỉ mặc định |
| `GET` | `/api/v1/admin/users` | Admin | Danh sách user |
| `PUT` | `/api/v1/admin/users/:id/role` | Admin | Đổi role |

### GET `/api/v1/users/profile`

- URL: `{{base_url}}/api/v1/users/profile`
- Headers: `Authorization: Bearer {{access_token}}`
- Thành công: `200 OK`, `data` là user profile
- Lỗi thường gặp:
  - `401` nếu thiếu token
  - `404` nếu user không tồn tại

### PUT `/api/v1/users/profile`

- URL: `{{base_url}}/api/v1/users/profile`
- Headers:
  - `Authorization: Bearer {{access_token}}`
  - `Content-Type: application/json`
- Body mẫu:

```json
{
  "first_name": "Alice",
  "last_name": "Tran",
  "phone": "0909123123",
  "default_address": {
    "recipient_name": "Alice Tran",
    "phone": "0909123123",
    "street": "123 Nguyen Hue",
    "ward": "Ben Nghe",
    "district": "District 1",
    "city": "Ho Chi Minh"
  }
}
```

- Thành công: `200 OK`
- Lỗi thường gặp:
  - `400` nếu phone không hợp lệ
  - `400` nếu đổi phone nhưng chưa có `phone_verification_id` hợp lệ
  - `409` nếu phone đã tồn tại
- Lưu ý:
  - nếu update phone mới, flow đúng là `send-otp -> verify-otp -> update profile`

### PUT `/api/v1/users/password`

- URL: `{{base_url}}/api/v1/users/password`
- Headers:
  - `Authorization: Bearer {{access_token}}`
  - `Content-Type: application/json`
- Body mẫu:

```json
{
  "current_password": "Password@123",
  "new_password": "Password@456"
}
```

- Thành công: `200 OK`
- Lỗi thường gặp:
  - `401` nếu `current_password` sai
  - `400` nếu `new_password` quá ngắn

### POST `/api/v1/users/verify-email/resend`

- URL: `{{base_url}}/api/v1/users/verify-email/resend`
- Headers: `Authorization: Bearer {{access_token}}`
- Body request: không có
- Thành công: `200 OK`
- Lỗi thường gặp:
  - `401` nếu không có token
  - `404` nếu user không còn tồn tại

### GET `/api/v1/users/profile/phone-verification`

- URL: `{{base_url}}/api/v1/users/profile/phone-verification`
- Headers: `Authorization: Bearer {{access_token}}`
- Thành công: `200 OK`, `data` ví dụ:

```json
{
  "verification_id": "uuid",
  "phone": "0909123123",
  "phone_masked": "0909***123",
  "status": "pending",
  "expires_at": "2026-04-06T04:00:00Z",
  "resend_available_at": "2026-04-06T03:56:00Z",
  "expires_in_seconds": 300,
  "resend_in_seconds": 30,
  "max_attempts": 5,
  "remaining_attempts": 4
}
```

### POST `/api/v1/users/profile/phone-verification/send-otp`

- URL: `{{base_url}}/api/v1/users/profile/phone-verification/send-otp`
- Headers:
  - `Authorization: Bearer {{access_token}}`
  - `Content-Type: application/json`
- Body mẫu:

```json
{
  "phone": "0909123123"
}
```

- Thành công: `200 OK`, `data` chứa `verification_id`
- Lỗi thường gặp:
  - `400` nếu phone sai format
  - `400` nếu Telegram chat chưa liên kết
  - `409` nếu phone đã được dùng
  - `429` nếu vượt rate limit
- Lưu ý:
  - đây là request nên dùng script lưu `phone_verification_id`

### POST `/api/v1/users/profile/phone-verification/verify-otp`

- URL: `{{base_url}}/api/v1/users/profile/phone-verification/verify-otp`
- Headers:
  - `Authorization: Bearer {{access_token}}`
  - `Content-Type: application/json`
- Body mẫu:

```json
{
  "verification_id": "{{phone_verification_id}}",
  "otp_code": "123456"
}
```

- Thành công: `200 OK`
- Lỗi thường gặp:
  - `400` nếu OTP sai
  - `400` nếu challenge đã hết hạn
  - `429` nếu nhập sai quá số lần cho phép

### POST `/api/v1/users/profile/phone-verification/resend-otp`

- URL: `{{base_url}}/api/v1/users/profile/phone-verification/resend-otp`
- Headers:
  - `Authorization: Bearer {{access_token}}`
  - `Content-Type: application/json`
- Body mẫu:

```json
{
  "verification_id": "{{phone_verification_id}}"
}
```

- Thành công: `200 OK`
- Lỗi thường gặp:
  - `400` nếu verification không tồn tại
  - `429` nếu resend quá sớm

### POST `/api/v1/users/addresses`

- URL: `{{base_url}}/api/v1/users/addresses`
- Headers:
  - `Authorization: Bearer {{access_token}}`
  - `Content-Type: application/json`
- Body mẫu:

```json
{
  "recipient_name": "Alice Tran",
  "phone": "0909123123",
  "street": "123 Nguyen Hue",
  "ward": "Ben Nghe",
  "district": "District 1",
  "city": "Ho Chi Minh",
  "is_default": true
}
```

- Thành công: `201 Created`, `data.id` là `address_id`
- Lỗi thường gặp:
  - `400` nếu field thiếu
  - `400` nếu vượt quá 10 địa chỉ

### GET `/api/v1/users/addresses`

- URL: `{{base_url}}/api/v1/users/addresses`
- Headers: `Authorization: Bearer {{access_token}}`
- Thành công: `200 OK`, `data` là mảng địa chỉ

### PUT `/api/v1/users/addresses/:id`

- URL: `{{base_url}}/api/v1/users/addresses/{{address_id}}`
- Headers:
  - `Authorization: Bearer {{access_token}}`
  - `Content-Type: application/json`
- Body mẫu:

```json
{
  "street": "456 Le Loi",
  "district": "District 1",
  "city": "Ho Chi Minh",
  "is_default": true
}
```

- Thành công: `200 OK`
- Lỗi thường gặp:
  - `404` nếu address không tồn tại

### DELETE `/api/v1/users/addresses/:id`

- URL: `{{base_url}}/api/v1/users/addresses/{{address_id}}`
- Headers: `Authorization: Bearer {{access_token}}`
- Thành công: `200 OK`
- Lỗi thường gặp:
  - `404` nếu address không tồn tại

### PUT `/api/v1/users/addresses/:id/default`

- URL: `{{base_url}}/api/v1/users/addresses/{{address_id}}/default`
- Headers: `Authorization: Bearer {{access_token}}`
- Thành công: `200 OK`
- Lỗi thường gặp:
  - `404` nếu address không tồn tại

### GET `/api/v1/admin/users`

- URL: `{{base_url}}/api/v1/admin/users`
- Headers: `Authorization: Bearer {{admin_access_token}}`
- Thành công: `200 OK`, `data` là danh sách user
- Lỗi thường gặp:
  - `401` nếu token sai
  - `403` nếu token không phải admin

### PUT `/api/v1/admin/users/:id/role`

- URL: `{{base_url}}/api/v1/admin/users/{{user_id}}/role`
- Headers:
  - `Authorization: Bearer {{admin_access_token}}`
  - `Content-Type: application/json`
- Body mẫu:

```json
{
  "role": "staff"
}
```

- Thành công: `200 OK`
- Lỗi thường gặp:
  - `400` nếu role không phải `user`, `staff`, `admin`
  - `404` nếu user không tồn tại

## 8.4. Nhóm Storefront public

### Tổng quan

| Method | URL | Auth | Mục đích |
| --- | --- | --- | --- |
| `GET` | `/api/v1/storefront/home` | Public | Dữ liệu HomePage |
| `GET` | `/api/v1/storefront/categories` | Public | Danh sách category storefront |
| `GET` | `/api/v1/storefront/categories/:identifier` | Public | Dữ liệu editorial category page |

### GET `/api/v1/storefront/home`

- URL: `{{base_url}}/api/v1/storefront/home?limit=2`
- Headers: không bắt buộc
- Thành công: `200 OK`

```json
{
  "success": true,
  "message": "storefront home retrieved",
  "data": {
    "categories": [
      {
        "slug": "shop-men",
        "display_name": "Shop Men",
        "nav_label": "Men",
        "status": "active",
        "aliases": ["men"]
      }
    ],
    "category_pages": [
      {
        "category": {
          "slug": "shop-men",
          "display_name": "Shop Men"
        },
        "sections": [],
        "featured_products": []
      }
    ]
  }
}
```

- Lỗi thường gặp:
  - `400` nếu `limit < 1`

### GET `/api/v1/storefront/categories`

- URL: `{{base_url}}/api/v1/storefront/categories`
- Thành công: `200 OK`, `data` là mảng category metadata

### GET `/api/v1/storefront/categories/:identifier`

- URL: `{{base_url}}/api/v1/storefront/categories/shop-men`
- Thành công: `200 OK`, `data` là `category`, `sections`, `featured_products`
- Lỗi thường gặp:
  - `404` nếu category storefront không tồn tại

## 8.5. Nhóm Products và Product Reviews

### Tổng quan products

| Method | URL | Auth | Mục đích |
| --- | --- | --- | --- |
| `GET` | `/api/v1/products` | Public | List sản phẩm |
| `GET` | `/api/v1/products/batch` | Public | Lấy nhiều sản phẩm theo ID |
| `GET` | `/api/v1/products/:id` | Public | Chi tiết sản phẩm |
| `POST` | `/api/v1/products` | Staff/Admin | Tạo sản phẩm |
| `PUT` | `/api/v1/products/:id` | Staff/Admin | Cập nhật sản phẩm |
| `DELETE` | `/api/v1/products/:id` | Staff/Admin | Xóa sản phẩm |
| `POST` | `/api/v1/products/uploads` | Staff/Admin | Upload ảnh sản phẩm |

### GET `/api/v1/products`

- URL mẫu:

```text
{{base_url}}/api/v1/products?limit=20&category=shoes&brand=nike&search=air&min_price=100000&max_price=3000000&sort=price_desc
```

- Query hỗ trợ:
  - `limit`
  - `cursor`
  - `category`
  - `brand`
  - `tag`
  - `status`
  - `search`
  - `min_price`
  - `max_price`
  - `size`
  - `color`
  - `sort`
- Thành công: `200 OK`, `data` là mảng product, `meta` có `next_cursor`, `has_next`
- Lỗi thường gặp:
  - `400` nếu cursor không hợp lệ

### GET `/api/v1/products/batch`

- URL mẫu:

```text
{{base_url}}/api/v1/products/batch?ids={{product_id}},another-id
```

- Thành công: `200 OK`, `data` là mảng product
- Lỗi thường gặp:
  - `400` nếu không truyền `ids`
  - `400` nếu truyền quá nhiều product ID

### GET `/api/v1/products/:id`

- URL: `{{base_url}}/api/v1/products/{{product_id}}`
- Thành công: `200 OK`, `data` là product
- Lỗi thường gặp:
  - `404` nếu product không tồn tại

### POST `/api/v1/products`

- URL: `{{base_url}}/api/v1/products`
- Headers:
  - `Authorization: Bearer {{admin_access_token}}`
  - `Content-Type: application/json`
- Body mẫu:

```json
{
  "name": "Classic White Sneaker",
  "description": "Leather upper, rubber sole",
  "price": 1299000,
  "stock": 20,
  "category": "footwear",
  "brand": "ND Shop",
  "tags": ["sneaker", "white", "unisex"],
  "status": "active",
  "sku": "SNK-WHT-001",
  "variants": [
    {
      "sku": "SNK-WHT-001-40",
      "label": "Size 40",
      "size": "40",
      "color": "white",
      "price": 1299000,
      "stock": 5
    }
  ],
  "image_url": "https://cdn.example.com/products/snk-001/main.jpg",
  "image_urls": [
    "https://cdn.example.com/products/snk-001/main.jpg",
    "https://cdn.example.com/products/snk-001/side.jpg"
  ]
}
```

- Thành công: `201 Created`
- Lỗi thường gặp:
  - `400` nếu `price <= 0`
  - `400` nếu `status` không thuộc `draft|active|inactive`
  - `401/403` nếu role không đủ quyền

### PUT `/api/v1/products/:id`

- URL: `{{base_url}}/api/v1/products/{{product_id}}`
- Headers:
  - `Authorization: Bearer {{admin_access_token}}`
  - `Content-Type: application/json`
- Body mẫu:

```json
{
  "price": 1199000,
  "stock": 25,
  "status": "active",
  "tags": ["sneaker", "white", "sale"]
}
```

- Thành công: `200 OK`
- Lỗi thường gặp:
  - `404` nếu product không tồn tại
  - `400` nếu `status` không hợp lệ

### DELETE `/api/v1/products/:id`

- URL: `{{base_url}}/api/v1/products/{{product_id}}`
- Headers: `Authorization: Bearer {{admin_access_token}}`
- Thành công: `200 OK`
- Lỗi thường gặp:
  - `404` nếu product không tồn tại

### POST `/api/v1/products/uploads`

- URL: `{{base_url}}/api/v1/products/uploads`
- Headers: `Authorization: Bearer {{admin_access_token}}`
- Body: `form-data`
  - key `images` kiểu `File`, có thể gửi nhiều file
- Thành công: `201 Created`

```json
{
  "success": true,
  "message": "images uploaded",
  "data": {
    "urls": [
      "https://minio.local/products/1.jpg",
      "https://minio.local/products/2.jpg"
    ]
  }
}
```

- Lỗi thường gặp:
  - `400` nếu không gửi file
  - `400` nếu gửi quá 8 file
  - `400` nếu file không phải image
  - `503` nếu object storage chưa cấu hình

### Tổng quan reviews

| Method | URL | Auth | Mục đích |
| --- | --- | --- | --- |
| `GET` | `/api/v1/products/:id/reviews` | Public | Danh sách review |
| `GET` | `/api/v1/products/:id/reviews/me` | JWT | Review của user hiện tại |
| `POST` | `/api/v1/products/:id/reviews` | JWT | Tạo review |
| `PUT` | `/api/v1/products/:id/reviews/me` | JWT | Cập nhật review của tôi |
| `DELETE` | `/api/v1/products/:id/reviews/me` | JWT | Xóa review của tôi |

### GET `/api/v1/products/:id/reviews`

- URL: `{{base_url}}/api/v1/products/{{product_id}}/reviews?page=1&limit=10`
- Thành công: `200 OK`

```json
{
  "success": true,
  "message": "product reviews retrieved",
  "data": {
    "summary": {
      "average_rating": 4.7,
      "review_count": 12,
      "rating_breakdown": {
        "one": 0,
        "two": 0,
        "three": 1,
        "four": 2,
        "five": 9
      }
    },
    "items": [
      {
        "id": "review-1",
        "product_id": "product-1",
        "user_id": "user-1",
        "author_label": "alice@example.com",
        "rating": 5,
        "comment": "Sản phẩm tốt",
        "created_at": "2026-04-06T03:00:00Z",
        "updated_at": "2026-04-06T03:00:00Z"
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 12
  }
}
```

- Lỗi thường gặp:
  - `404` nếu product không tồn tại

### GET `/api/v1/products/:id/reviews/me`

- Headers: `Authorization: Bearer {{access_token}}`
- Thành công: `200 OK`
- Lỗi thường gặp:
  - `404` nếu chưa có review

### POST `/api/v1/products/:id/reviews`

- Headers:
  - `Authorization: Bearer {{access_token}}`
  - `Content-Type: application/json`
- Body mẫu:

```json
{
  "rating": 5,
  "comment": "Chất lượng rất ổn, giao hàng nhanh."
}
```

- Thành công: `201 Created`
- Lỗi thường gặp:
  - `404` nếu product không tồn tại
  - `409` nếu user đã review sản phẩm rồi

### PUT `/api/v1/products/:id/reviews/me`

- Body mẫu:

```json
{
  "rating": 4,
  "comment": "Sau một tuần dùng vẫn ổn."
}
```

- Thành công: `200 OK`
- Lỗi thường gặp:
  - `404` nếu chưa có review trước đó

### DELETE `/api/v1/products/:id/reviews/me`

- Thành công: `200 OK`
- Lỗi thường gặp:
  - `404` nếu review không tồn tại

## 8.6. Nhóm Cart

### Tổng quan

| Method | URL | Auth | Mục đích |
| --- | --- | --- | --- |
| `GET` | `/api/v1/cart` | JWT | Lấy giỏ hàng |
| `POST` | `/api/v1/cart/items` | JWT | Thêm item |
| `PUT` | `/api/v1/cart/items/:productId` | JWT | Cập nhật số lượng |
| `DELETE` | `/api/v1/cart/items/:productId` | JWT | Xóa item |
| `DELETE` | `/api/v1/cart` | JWT | Xóa toàn bộ giỏ |

### GET `/api/v1/cart`

- URL: `{{base_url}}/api/v1/cart`
- Headers: `Authorization: Bearer {{access_token}}`
- Thành công: `200 OK`

```json
{
  "success": true,
  "message": "cart retrieved",
  "data": {
    "user_id": "user-1",
    "items": [
      {
        "product_id": "product-1",
        "name": "Classic White Sneaker",
        "price": 1299000,
        "quantity": 2
      }
    ],
    "total": 2598000
  }
}
```

### POST `/api/v1/cart/items`

- URL: `{{base_url}}/api/v1/cart/items`
- Headers:
  - `Authorization: Bearer {{access_token}}`
  - `Content-Type: application/json`
- Body mẫu:

```json
{
  "product_id": "{{product_id}}",
  "quantity": 2
}
```

- Thành công: `200 OK`
- Lỗi thường gặp:
  - `404` nếu product không tồn tại
  - `400` nếu product unavailable
  - `409` nếu không đủ tồn kho

### PUT `/api/v1/cart/items/:productId`

- URL: `{{base_url}}/api/v1/cart/items/{{product_id}}`
- Body mẫu:

```json
{
  "quantity": 3
}
```

- Thành công: `200 OK`
- Lỗi thường gặp:
  - `404` nếu item chưa có trong cart

### DELETE `/api/v1/cart/items/:productId`

- Thành công: `200 OK`
- Lỗi thường gặp:
  - `404` nếu item không tồn tại trong cart

### DELETE `/api/v1/cart`

- Thành công: `200 OK`
- Lỗi thường gặp:
  - `401` nếu thiếu token

## 8.7. Nhóm Orders, Popularity, Coupons, Admin Orders

### Tổng quan user/order endpoint

| Method | URL | Auth | Mục đích |
| --- | --- | --- | --- |
| `GET` | `/api/v1/catalog/popularity` | Public | Sản phẩm bán chạy |
| `POST` | `/api/v1/orders/preview` | JWT | Tính giá trước checkout |
| `POST` | `/api/v1/orders` | JWT | Tạo đơn |
| `GET` | `/api/v1/orders/summary` | JWT | Tổng hợp đơn và payment summary |
| `GET` | `/api/v1/orders` | JWT | Danh sách đơn của user |
| `GET` | `/api/v1/orders/:id` | JWT | Chi tiết đơn |
| `GET` | `/api/v1/orders/:id/events` | JWT | Timeline đơn |
| `PUT` | `/api/v1/orders/:id/cancel` | JWT | Hủy đơn user |

### GET `/api/v1/catalog/popularity`

- URL: `{{base_url}}/api/v1/catalog/popularity?limit=5`
- Thành công: `200 OK`, `data` là mảng:

```json
[
  {
    "product_id": "product-1",
    "quantity": 18
  }
]
```

### POST `/api/v1/orders/preview`

- URL: `{{base_url}}/api/v1/orders/preview`
- Headers:
  - `Authorization: Bearer {{access_token}}`
  - `Content-Type: application/json`
- Body mẫu:

```json
{
  "items": [
    {
      "product_id": "{{product_id}}",
      "quantity": 2
    }
  ],
  "coupon_code": "{{coupon_code}}",
  "shipping_method": "standard",
  "shipping_address": {
    "recipient_name": "Alice Tran",
    "phone": "0909123123",
    "street": "123 Nguyen Hue",
    "ward": "Ben Nghe",
    "district": "District 1",
    "city": "Ho Chi Minh"
  }
}
```

- Thành công: `200 OK`

```json
{
  "success": true,
  "message": "order preview retrieved",
  "data": {
    "subtotal_price": 2598000,
    "discount_amount": 200000,
    "coupon_code": "SUMMER10",
    "coupon_description": "Giảm giá mùa hè",
    "shipping_method": "standard",
    "shipping_fee": 30000,
    "total_price": 2428000
  }
}
```

- Lỗi thường gặp:
  - `400` nếu thiếu item
  - `400` nếu shipping method không hợp lệ
  - `404` nếu coupon không tồn tại
  - `409` nếu hết stock

### POST `/api/v1/orders`

- URL: `{{base_url}}/api/v1/orders`
- Headers:
  - `Authorization: Bearer {{access_token}}`
  - `Content-Type: application/json`
- Body: giống `preview`
- Thành công: `201 Created`, `data` là order
- Lỗi thường gặp:
  - giống `preview`
- Lưu ý:
  - request này nên lưu `order_id`

### GET `/api/v1/orders/summary`

- URL: `{{base_url}}/api/v1/orders/summary`
- Headers: `Authorization: Bearer {{access_token}}`
- Thành công: `200 OK`

```json
{
  "success": true,
  "message": "order summary retrieved",
  "data": {
    "orders": [],
    "payments_by_order": {}
  }
}
```

### GET `/api/v1/orders`

- URL: `{{base_url}}/api/v1/orders`
- Headers: `Authorization: Bearer {{access_token}}`
- Thành công: `200 OK`, `data` là mảng order

### GET `/api/v1/orders/:id`

- URL: `{{base_url}}/api/v1/orders/{{order_id}}`
- Headers: `Authorization: Bearer {{access_token}}`
- Thành công: `200 OK`
- Lỗi thường gặp:
  - `404` nếu order không tồn tại hoặc không thuộc user

### GET `/api/v1/orders/:id/events`

- URL: `{{base_url}}/api/v1/orders/{{order_id}}/events`
- Headers: `Authorization: Bearer {{access_token}}`
- Thành công: `200 OK`, `data` là timeline event

### PUT `/api/v1/orders/:id/cancel`

- URL: `{{base_url}}/api/v1/orders/{{order_id}}/cancel`
- Headers: `Authorization: Bearer {{access_token}}`
- Body request: không bắt buộc
- Thành công: `200 OK`
- Lỗi thường gặp:
  - `404` nếu order không tồn tại
  - `400` nếu order không còn ở trạng thái hủy được

### Tổng quan admin order/coupon endpoint

| Method | URL | Auth | Mục đích |
| --- | --- | --- | --- |
| `GET` | `/api/v1/admin/orders/report` | Staff/Admin | Báo cáo đơn hàng |
| `GET` | `/api/v1/admin/orders` | Staff/Admin | Danh sách đơn có filter |
| `GET` | `/api/v1/admin/orders/:id` | Staff/Admin | Chi tiết đơn |
| `GET` | `/api/v1/admin/orders/:id/events` | Staff/Admin | Timeline đơn |
| `PUT` | `/api/v1/admin/orders/:id/cancel` | Staff/Admin | Hủy đơn bằng admin |
| `PUT` | `/api/v1/admin/orders/:id/status` | Staff/Admin | Cập nhật trạng thái đơn |
| `POST` | `/api/v1/admin/coupons` | Staff/Admin | Tạo coupon |
| `GET` | `/api/v1/admin/coupons` | Staff/Admin | Danh sách coupon |

### GET `/api/v1/admin/orders/report`

- URL: `{{base_url}}/api/v1/admin/orders/report?days=30`
- Headers: `Authorization: Bearer {{admin_access_token}}`
- Thành công: `200 OK`

```json
{
  "window_days": 30,
  "total_revenue": 158000000,
  "order_count": 120,
  "cancelled_count": 6,
  "average_order_value": 1316666.67,
  "top_products": [
    {
      "product_id": "product-1",
      "name": "Classic White Sneaker",
      "quantity": 40,
      "revenue": 51960000
    }
  ],
  "status_breakdown": [
    {
      "status": "paid",
      "orders": 80,
      "revenue": 110000000
    }
  ]
}
```

- Lưu ý:
  - có route legacy tương thích: `/api/v1/orders/admin/report`
  - nên dùng route canonical dưới `/api/v1/admin/orders/report`

### GET `/api/v1/admin/orders`

- URL mẫu:

```text
{{base_url}}/api/v1/admin/orders?page=1&limit=20&status=pending&user_id={{user_id}}&from=2026-04-01&to=2026-04-06
```

- Thành công: `200 OK`, có `meta.page`, `meta.limit`, `meta.total`
- Lỗi thường gặp:
  - `400` nếu `from` hoặc `to` sai format

### GET `/api/v1/admin/orders/:id`

- Headers: `Authorization: Bearer {{admin_access_token}}`
- Thành công: `200 OK`
- Lỗi thường gặp:
  - `404` nếu order không tồn tại

### GET `/api/v1/admin/orders/:id/events`

- Thành công: `200 OK`

### PUT `/api/v1/admin/orders/:id/cancel`

- URL: `{{base_url}}/api/v1/admin/orders/{{order_id}}/cancel`
- Headers:
  - `Authorization: Bearer {{admin_access_token}}`
  - `Content-Type: application/json`
- Body mẫu:

```json
{
  "message": "Khách yêu cầu hủy từ CSKH."
}
```

- Thành công: `200 OK`
- Lỗi thường gặp:
  - `400` nếu chỉ còn trạng thái không cho admin cancel

### PUT `/api/v1/admin/orders/:id/status`

- URL: `{{base_url}}/api/v1/admin/orders/{{order_id}}/status`
- Headers:
  - `Authorization: Bearer {{admin_access_token}}`
  - `Content-Type: application/json`
- Body mẫu:

```json
{
  "status": "shipped",
  "message": "Bàn giao cho đơn vị vận chuyển."
}
```

- Thành công: `200 OK`
- Lỗi thường gặp:
  - `400` nếu status ngoài tập `pending|paid|shipped|delivered|cancelled|refunded`
  - `404` nếu order không tồn tại

### POST `/api/v1/admin/coupons`

- URL: `{{base_url}}/api/v1/admin/coupons`
- Headers:
  - `Authorization: Bearer {{admin_access_token}}`
  - `Content-Type: application/json`
- Body mẫu:

```json
{
  "code": "SUMMER10",
  "description": "Giảm 10% cho đơn mùa hè",
  "discount_type": "percentage",
  "discount_value": 10,
  "min_order_amount": 500000,
  "usage_limit": 100,
  "expires_at": "2026-05-31T23:59:59Z",
  "active": true
}
```

- Thành công: `201 Created`
- Lỗi thường gặp:
  - `400` nếu `discount_type` không phải `fixed|percentage`
  - `409` nếu code coupon bị trùng

### GET `/api/v1/admin/coupons`

- URL: `{{base_url}}/api/v1/admin/coupons`
- Headers: `Authorization: Bearer {{admin_access_token}}`
- Thành công: `200 OK`, `data` là mảng coupon

## 8.8. Nhóm Payments và Refunds

### Tổng quan

| Method | URL | Auth | Mục đích |
| --- | --- | --- | --- |
| `POST` | `/api/v1/payments` | JWT | Tạo payment |
| `GET` | `/api/v1/payments/history` | JWT | Lịch sử payment của user |
| `GET` | `/api/v1/payments/:id` | JWT | Chi tiết payment |
| `GET` | `/api/v1/payments/order/:orderId` | JWT | Payment gần nhất theo order |
| `GET` | `/api/v1/payments/order/:orderId/history` | JWT | Danh sách payment theo order |
| `GET` | `/api/v1/admin/payments/order/:orderId/history` | Staff/Admin | Lịch sử payment theo order cho admin |
| `POST` | `/api/v1/admin/payments/:id/refunds` | Staff/Admin | Refund payment |
| `POST` | `/api/v1/payments/webhooks/momo` | Public | Webhook MoMo |

### POST `/api/v1/payments`

- URL: `{{base_url}}/api/v1/payments`
- Headers:
  - `Authorization: Bearer {{access_token}}`
  - `Content-Type: application/json`
- Body mẫu:

```json
{
  "order_id": "{{order_id}}",
  "payment_method": "manual",
  "amount": 2428000
}
```

- Thành công: `201 Created`

```json
{
  "success": true,
  "message": "payment processed",
  "data": {
    "id": "payment-1",
    "order_id": "order-1",
    "user_id": "user-1",
    "order_total": 2428000,
    "amount": 2428000,
    "status": "completed",
    "transaction_type": "charge",
    "payment_method": "manual",
    "gateway_provider": "manual",
    "signature_verified": false,
    "net_paid_amount": 2428000,
    "outstanding_amount": 0,
    "created_at": "2026-04-06T03:00:00Z",
    "updated_at": "2026-04-06T03:00:00Z"
  }
}
```

- Lỗi thường gặp:
  - `404` nếu order không tồn tại
  - `400` nếu order không ở trạng thái payable
  - `400` nếu amount <= 0 hoặc vượt outstanding balance
  - `409` nếu order đã được thanh toán đủ
- Lưu ý:
  - với `payment_method=momo`, response có thể có `checkout_url`

### GET `/api/v1/payments/history`

- URL: `{{base_url}}/api/v1/payments/history`
- Headers: `Authorization: Bearer {{access_token}}`
- Thành công: `200 OK`, `data` là mảng payment

### GET `/api/v1/payments/:id`

- URL: `{{base_url}}/api/v1/payments/{{payment_id}}`
- Headers: `Authorization: Bearer {{access_token}}`
- Thành công: `200 OK`
- Lỗi thường gặp:
  - `404` nếu payment không tồn tại

### GET `/api/v1/payments/order/:orderId`

- URL: `{{base_url}}/api/v1/payments/order/{{order_id}}`
- Headers: `Authorization: Bearer {{access_token}}`
- Thành công: `200 OK`
- Lỗi thường gặp:
  - `404` nếu payment chưa có

### GET `/api/v1/payments/order/:orderId/history`

- URL: `{{base_url}}/api/v1/payments/order/{{order_id}}/history`
- Headers: `Authorization: Bearer {{access_token}}`
- Thành công: `200 OK`

### GET `/api/v1/admin/payments/order/:orderId/history`

- URL: `{{base_url}}/api/v1/admin/payments/order/{{order_id}}/history`
- Headers: `Authorization: Bearer {{admin_access_token}}`
- Thành công: `200 OK`

### POST `/api/v1/admin/payments/:id/refunds`

- URL: `{{base_url}}/api/v1/admin/payments/{{payment_id}}/refunds`
- Headers:
  - `Authorization: Bearer {{admin_access_token}}`
  - `Content-Type: application/json`
- Body mẫu:

```json
{
  "amount": 500000,
  "message": "Refund một phần theo yêu cầu khách hàng."
}
```

- Thành công: `201 Created`, `data.transaction_type` thường là `refund`
- Lỗi thường gặp:
  - `404` nếu payment không tồn tại
  - `400` nếu payment không cho refund
  - `400` nếu amount vượt số dư refund được

### POST `/api/v1/payments/webhooks/momo`

- URL: `{{base_url}}/api/v1/payments/webhooks/momo`
- Headers: `Content-Type: application/json`
- Body mẫu:

```json
{
  "payment_id": "{{payment_id}}",
  "order_id": "{{order_id}}",
  "gateway_order_id": "MOMO-ORDER-123",
  "gateway_transaction_id": "MOMO-TXN-123",
  "amount": 2428000,
  "result_code": 0,
  "message": "Success",
  "signature": "{{momo_signature}}"
}
```

- Thành công: `200 OK`
- Lỗi thường gặp:
  - `404` nếu payment không tồn tại
  - `401` nếu signature sai
  - `400` nếu amount không khớp
- Lưu ý:
  - đây là endpoint phù hợp cho test integration giả lập gateway payment
  - muốn pass thật phải có signature khớp secret môi trường

## 9. Biến môi trường Postman và chaining dữ liệu

### 9.1. Script lưu token sau login/register

Thêm vào tab `Tests` của request login hoặc register:

```javascript
pm.test("Login/Register thành công", function () {
  pm.response.to.have.status(pm.info.requestName.includes("Register") ? 201 : 200);
  const json = pm.response.json();
  pm.expect(json.success).to.eql(true);
  pm.expect(json.data.token).to.be.a("string");
  pm.expect(json.data.refresh_token).to.be.a("string");
  pm.environment.set("access_token", json.data.token);
  pm.environment.set("refresh_token", json.data.refresh_token);
  pm.environment.set("user_id", json.data.user.id);
});
```

### 9.2. Script lưu `address_id`

```javascript
const json = pm.response.json();
if (json.success && json.data && json.data.id) {
  pm.environment.set("address_id", json.data.id);
}
```

### 9.3. Script lưu `product_id`

Áp dụng cho create product hoặc get/list product:

```javascript
const json = pm.response.json();
if (json.success && json.data) {
  if (Array.isArray(json.data) && json.data.length > 0) {
    pm.environment.set("product_id", json.data[0].id);
  } else if (json.data.id) {
    pm.environment.set("product_id", json.data.id);
  }
}
```

### 9.4. Script lưu `order_id`

```javascript
const json = pm.response.json();
if (json.success && json.data && json.data.id) {
  pm.environment.set("order_id", json.data.id);
}
```

### 9.5. Script lưu `payment_id`

```javascript
const json = pm.response.json();
if (json.success && json.data && json.data.id) {
  pm.environment.set("payment_id", json.data.id);
}
```

### 9.6. Script lưu `phone_verification_id`

```javascript
const json = pm.response.json();
if (json.success && json.data && json.data.verification_id) {
  pm.environment.set("phone_verification_id", json.data.verification_id);
}
```

## 10. Ví dụ Postman test script để validate response

### 10.1. Kiểm tra envelope chuẩn

```javascript
pm.test("Response đúng envelope chuẩn", function () {
  const json = pm.response.json();
  pm.expect(json).to.have.property("success");
  pm.expect(json).to.have.property("message");
});
```

### 10.2. Kiểm tra profile trả đúng user hiện tại

```javascript
pm.test("Profile trả về đúng user", function () {
  const json = pm.response.json();
  pm.expect(json.success).to.eql(true);
  pm.expect(json.data.id).to.eql(pm.environment.get("user_id"));
  pm.expect(json.data.email).to.be.a("string");
});
```

### 10.3. Kiểm tra list products có meta cursor

```javascript
pm.test("List products có meta hợp lệ", function () {
  const json = pm.response.json();
  pm.expect(json.success).to.eql(true);
  pm.expect(json.data).to.be.an("array");
  pm.expect(json.meta).to.have.property("limit");
  pm.expect(json.meta).to.have.property("has_next");
});
```

### 10.4. Kiểm tra create order thành công

```javascript
pm.test("Create order thành công", function () {
  const json = pm.response.json();
  pm.response.to.have.status(201);
  pm.expect(json.success).to.eql(true);
  pm.expect(json.data.id).to.be.a("string");
  pm.expect(json.data.items.length).to.be.greaterThan(0);
  pm.environment.set("order_id", json.data.id);
});
```

### 10.5. Kiểm tra payment không vượt outstanding balance

```javascript
pm.test("Payment có amount hợp lệ", function () {
  const json = pm.response.json();
  pm.expect(json.success).to.eql(true);
  pm.expect(json.data.amount).to.be.above(0);
  pm.expect(json.data.outstanding_amount).to.be.at.least(0);
});
```

### 10.6. Kiểm tra negative test

```javascript
pm.test("Request bị từ chối đúng như mong đợi", function () {
  const json = pm.response.json();
  pm.expect(pm.response.code).to.be.oneOf([400, 401, 403, 404, 409, 429]);
  pm.expect(json.success).to.eql(false);
  pm.expect(json.error).to.be.a("string");
});
```

## 11. Thứ tự chạy test khuyến nghị

### 11.1. User flow cơ bản

1. `GET /health`
2. `POST /api/v1/auth/register` hoặc `POST /api/v1/auth/login`
3. `GET /api/v1/users/profile`
4. `POST /api/v1/users/addresses`
5. `GET /api/v1/products`
6. `POST /api/v1/cart/items`
7. `GET /api/v1/cart`
8. `POST /api/v1/orders/preview`
9. `POST /api/v1/orders`
10. `POST /api/v1/payments`
11. `GET /api/v1/orders/summary`
12. `GET /api/v1/payments/history`

### 11.2. Admin flow

1. `POST /api/v1/auth/login` với admin bootstrap account
2. `GET /api/v1/admin/users`
3. `POST /api/v1/products`
4. `POST /api/v1/admin/coupons`
5. `GET /api/v1/admin/orders`
6. `PUT /api/v1/admin/orders/:id/status`
7. `POST /api/v1/admin/payments/:id/refunds`
8. `GET /api/v1/admin/orders/report`

### 11.3. Review flow

1. login user
2. lấy `product_id`
3. `POST /api/v1/products/:id/reviews`
4. `GET /api/v1/products/:id/reviews`
5. `GET /api/v1/products/:id/reviews/me`
6. `PUT /api/v1/products/:id/reviews/me`
7. `DELETE /api/v1/products/:id/reviews/me`

## 12. Checklist negative test nên có

- đăng ký email trùng
- login sai mật khẩu nhiều lần để kiểm tra `429`
- refresh với token hết hạn
- vào route protected không có JWT
- user thường gọi route admin
- add cart với `quantity <= 0`
- add cart với product không tồn tại
- preview order với coupon sai
- create order khi thiếu shipping address cho phương thức cần giao hàng
- payment amount vượt outstanding balance
- refund vượt số tiền có thể refund
- webhook MoMo với signature sai
- upload file không phải ảnh
- update product với status sai

## 13. Lưu ý quan trọng khi test bằng Postman

- Luôn ưu tiên test qua `api-gateway` thay vì gọi service con trực tiếp nếu mục tiêu là verify contract thật của hệ thống.
- Với route cần JWT, nên dùng Postman environment thay vì copy token tay.
- Với upload file, dùng `form-data`, không ép `raw JSON`.
- Với OAuth, Postman chỉ phù hợp để kiểm tra redirect/cookie ở mức kỹ thuật; flow đăng nhập hoàn chỉnh nên verify thêm bằng browser.
- Với webhook payment, cần chữ ký hợp lệ theo cấu hình môi trường nếu muốn pass case thành công.
- `notification-service` không có business HTTP endpoint để test trực tiếp bằng Postman; hãy xác minh gián tiếp qua status order/payment, log và event side effects.
- Nếu HomePage/storefront trống dữ liệu, hãy import workbook mẫu trước khi test các endpoint storefront:

```bash
make storefront-import-sample
```

## 14. Kết luận

Khi được tổ chức tốt, Postman không chỉ là công cụ gửi request thủ công mà còn là một regression suite mức API rất hiệu quả. Hãy giữ collection theo module, dùng biến môi trường thay cho hardcode, và luôn có cả happy path lẫn negative path cho những luồng quan trọng như auth, order, payment, refund, và phân quyền admin.
