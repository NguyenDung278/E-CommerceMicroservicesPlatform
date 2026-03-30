# Testing And Verification

Tài liệu này tập trung vào cách verify thực dụng cho repo hiện tại: đúng với Makefile, đúng với Docker Compose, và đúng với chuyện nhiều service nội bộ không publish port ra host.

## 1. Kiểm tra code Go

Format:

```bash
make fmt
```

Tidy modules:

```bash
make tidy
```

Go tests:

```bash
make test
```

Static analysis:

```bash
make vet
```

## 2. Kiểm tra frontend

Build production bundle của frontend chính:

```bash
make frontend-build
```

Chạy Vite dev server:

```bash
make frontend-dev
```

Nếu bạn cũng muốn kiểm tra nhánh Next experimental:

```bash
make client-build
```

## 3. Verify Docker Compose

Render compose:

```bash
make docker-config
```

Build toàn bộ stack:

```bash
make compose-build
```

Chạy stack:

```bash
make compose-up
```

Hạ stack:

```bash
make compose-down
```

### Kiểm tra trạng thái container

```bash
cd deployments/docker
docker compose --env-file ../../.env.local ps
```

Đây là bước nên làm trước khi chạy bất kỳ smoke test nào.

## 4. Smoke tests nên chạy từ host

### Health của entrypoint

```bash
curl http://localhost:8080/health
curl http://localhost/health
```

### Đăng ký user mới

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

### Đăng nhập

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "alice@example.com",
    "password": "Password123"
  }' | jq -r '.data.token')
```

### Đăng nhập nhanh bằng dev account

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

## 5. Verify nội bộ cho database và hạ tầng

Vì nhiều service không publish port ra host, hãy dùng `docker compose exec` cho hạ tầng thật sự có shell/CLI.

### PostgreSQL

```bash
cd deployments/docker
docker compose --env-file ../../.env.local exec postgres pg_isready -U admin
```

### Redis

```bash
cd deployments/docker
docker compose --env-file ../../.env.local exec redis redis-cli ping
```

### RabbitMQ

```bash
cd deployments/docker
docker compose --env-file ../../.env.local exec rabbitmq rabbitmq-diagnostics ping
```

### Lưu ý về Go services

Các container Go service dùng distroless runtime, nên thường không có `sh` để bạn `exec` vào debug kiểu shell. Với chúng, ưu tiên:

- `docker compose logs <service>`
- `docker inspect`
- trace qua gateway

## 6. Verify theo loại thay đổi

### Nếu sửa auth

- đăng ký
- đăng nhập
- refresh token
- verify email hoặc reset password nếu đụng vào flow này
- mở route protected như `/profile`

### Nếu sửa catalog

- list products
- product detail
- create/update/delete product bằng admin/staff
- nếu đụng media/search, kiểm tra log `product-service`, MinIO, Elasticsearch

### Nếu sửa cart

- guest add/update/remove
- login rồi kiểm tra merge guest cart
- add item authenticated
- clear cart

### Nếu sửa order/payment

- order preview
- create order
- process payment
- xem order history / payment history
- nếu đụng event flow, xem thêm log `order-service`, `payment-service`, `notification-service`

### Nếu sửa admin surface

- login bằng admin và staff
- xác minh quyền role-sensitive như đổi role user
- xác minh staff chỉ làm được phần vận hành được phép

## 7. Observability checks

### Jaeger

Jaeger đang publish host port:

```bash
http://localhost:16686
```

Khi debug request chậm hoặc call chéo service, hãy kiểm tra trace trước khi đoán.

### Prometheus / Grafana

Compose hiện dựng `prometheus` và `grafana`, nhưng không publish host port mặc định. Nếu cần quan sát chúng trực tiếp:

- xem `docker compose ps`
- hoặc tự mở port mapping tạm thời trong compose override/local change

Đừng giả định `http://localhost:9090` hay `http://localhost:3000` luôn mở sẵn.
