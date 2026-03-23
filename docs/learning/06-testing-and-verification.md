# Testing And Verification

Tài liệu này tập trung vào cách test thực dụng cho repo hiện tại.

## 1. Kiểm tra code Go

Format:

```bash
make fmt
```

Tidying modules:

```bash
make tidy
```

Unit và integration tests trong từng module Go:

```bash
make test
```

Static analysis:

```bash
make vet
```

## 2. Kiểm tra frontend

Build production bundle:

```bash
make frontend-build
```

Chạy dev server:

```bash
make frontend-dev
```

## 3. Verify hạ tầng local

Render compose:

```bash
make docker-config
```

Dựng stack:

```bash
make compose-up
```

Hạ stack:

```bash
make compose-down
```

## 4. End-to-end smoke tests nên chạy

### Health checks

```bash
curl http://localhost:8080/health
curl http://localhost:8081/health
curl http://localhost:8082/health
curl http://localhost:8083/health
curl http://localhost:8084/health
curl http://localhost:8085/health
curl http://localhost:8086/health
```

### Đăng ký và đăng nhập

```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "Password123",
    "first_name": "Alice",
    "last_name": "Nguyen",
    "phone": "0900000001"
  }'
```

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "alice@example.com",
    "password": "Password123"
  }' | jq -r '.data.token')
```

### Đăng nhập nhanh bằng tài khoản staff/admin đã seed

Admin:

```bash
ADMIN_TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "admin.dev@ndshop.local",
    "password": "AdminTest!2026-ChangeMe"
  }' | jq -r '.data.token')
```

Staff:

```bash
STAFF_TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "staff.dev@ndshop.local",
    "password": "StaffTest!2026-ChangeMe"
  }' | jq -r '.data.token')
```

### Xem profile

```bash
curl http://localhost:8080/api/v1/users/profile \
  -H "Authorization: Bearer $TOKEN"
```

### Kiểm tra quyền admin

```bash
curl http://localhost:8080/api/v1/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Add to cart

```bash
curl -X POST http://localhost:8080/api/v1/cart/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "<product-id>",
    "quantity": 1
  }'
```

## 5. Verify theo loại thay đổi

### Nếu sửa auth

- đăng ký
- đăng nhập
- mở `/profile`
- kiểm tra role-protected routes

### Nếu sửa catalog

- list products
- product detail
- admin create/update product
- nếu đụng media/search, kiểm tra MinIO hoặc Elasticsearch logs

### Nếu sửa cart/order/payment

- add item
- checkout
- process payment
- xem order history
- kiểm tra RabbitMQ và email notification nếu thay đổi event flow

## 6. Observability checks

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000`
- Jaeger: `http://localhost:16686`

Khi debug request chậm hoặc call chéo service, hãy kiểm tra trace trước khi đoán.
