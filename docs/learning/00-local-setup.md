# Local Setup Guide

Tài liệu này là đường ngắn nhất để chạy repo trên máy local.

## 1. Yêu cầu

- Go 1.21+
- Docker Desktop hoặc Docker Engine + Docker Compose
- Node.js 20+
- `make`

## 2. Chuẩn bị biến môi trường

Từ root repo:

```bash
cp .env.example .env
```

Giá trị tối thiểu cần kiểm tra:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `RABBITMQ_PASSWORD`
- `GRAFANA_ADMIN_PASSWORD`

## 3. Dựng backend và hạ tầng

Render file compose:

```bash
make docker-config
```

Chạy toàn bộ stack:

```bash
make compose-up
```

Các service chính sau khi lên:

- API Gateway: `http://localhost:8080`
- User Service: `http://localhost:8081`
- Product Service: `http://localhost:8082`
- Cart Service: `http://localhost:8083`
- Order Service: `http://localhost:8084`
- Payment Service: `http://localhost:8085`
- Notification Service: `http://localhost:8086`

Các công cụ hỗ trợ:

- Frontend static container: `http://localhost:4173`
- Grafana: `http://localhost:3000`
- Prometheus: `http://localhost:9090`
- Jaeger: `http://localhost:16686`
- RabbitMQ UI: `http://localhost:15672`
- MinIO Console: `http://localhost:9001`
- Elasticsearch: `http://localhost:9200`

## 4. Tài khoản test admin và staff

Khi dựng local bằng Docker Compose, `user-service` sẽ bootstrap hai tài khoản development để test nhanh:

- Admin: `admin.dev@ndshop.local` / `AdminTest!2026-ChangeMe`
- Staff: `staff.dev@ndshop.local` / `StaffTest!2026-ChangeMe`

Quyền mặc định:

- `admin`: vào được khu vực `/admin` và có quyền đổi role user
- `staff`: vào được khu vực `/admin` cho các thao tác vận hành, nhưng không đổi role người khác

Nếu cần đổi password local mà vẫn giữ seed account, bạn có thể override bằng env:

```bash
export BOOTSTRAP_DEV_ACCOUNTS_ADMIN_PASSWORD='AdminLocal!2026'
export BOOTSTRAP_DEV_ACCOUNTS_STAFF_PASSWORD='StaffLocal!2026'
```

Nếu cần tắt hoàn toàn seed account:

```bash
export BOOTSTRAP_DEV_ACCOUNTS_ENABLED=false
```

## 5. Chạy frontend ở chế độ dev

```bash
make frontend-install
make frontend-dev
```

Frontend dev mặc định chạy ở `http://localhost:5174`.

Nếu cần trỏ sang gateway khác:

```bash
VITE_API_BASE_URL=http://localhost:8080 npm run dev
```

## 6. Kiểm tra health nhanh

```bash
curl http://localhost:8080/health
curl http://localhost:8081/health
curl http://localhost:8082/health
curl http://localhost:8083/health
curl http://localhost:8084/health
curl http://localhost:8085/health
curl http://localhost:8086/health
```

## 7. Chạy test cơ bản

```bash
make test
make vet
make frontend-build
```

## 8. Nếu có lỗi startup

### Lỗi container chưa healthy

- kiểm tra `docker compose ps`
- kiểm tra log của container liên quan
- ưu tiên xác minh PostgreSQL, Redis, RabbitMQ lên trước

### Frontend không gọi được API

- kiểm tra `http://localhost:8080/health`
- nếu chạy frontend dev, kiểm tra `VITE_API_BASE_URL`
- nếu chạy frontend qua container static, frontend thường gọi cùng origin `/api`

### Không đăng nhập được bằng tài khoản test

- kiểm tra `user-service` có đang dùng config local với `bootstrap.dev_accounts.enabled: true`
- nếu đã export `BOOTSTRAP_DEV_ACCOUNTS_ENABLED=false`, seed account sẽ không được tạo
- kiểm tra log `user-service` để xác nhận bootstrapper đã chạy
- nếu đã override password bằng env, hãy dùng password mới thay cho built-in default

### Search hoặc object storage lỗi

`product-service` được viết để degrade gracefully khi MinIO hoặc Elasticsearch gặp lỗi. Catalog core vẫn có thể hoạt động ở mức cơ bản.
