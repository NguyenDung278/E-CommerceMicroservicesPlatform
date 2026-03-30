# Local Setup Guide

Tài liệu này là đường ngắn nhất để chạy repo trên máy local mà không bị lệch với Docker Compose và Makefile hiện tại.

## 1. Yêu cầu

- Go 1.21+
- Docker Desktop hoặc Docker Engine + Docker Compose
- Node.js 20+
- `make`
- nếu muốn chạy migration từ host: cài thêm `migrate` CLI

## 2. Chuẩn bị biến môi trường

Repo hiện ưu tiên `.env.local`. Nếu file này không tồn tại, workflow mới fallback sang `.env.example`.

Khuyến nghị:

```bash
cp .env.local.example .env.local
```

Nếu bạn chưa muốn tạo file local riêng, có thể đọc `.env.example` để biết danh sách biến cần có.

### Những biến tối thiểu nên kiểm tra

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `RABBITMQ_PASSWORD`
- `FRONTEND_BASE_URL`
- `GRAFANA_ADMIN_PASSWORD`

### Điều dễ nhầm

- `.env.local.example` đang dùng `FRONTEND_BASE_URL=http://localhost:4173` vì đây là cổng preview/container của `frontend`
- `.env.example` dùng `http://localhost:5174` để thuận tiện hơn cho Vite dev server chạy ngoài Docker

## 3. Render compose trước khi chạy

Lệnh này giúp bạn xác nhận Compose đang đọc đúng env file:

```bash
make docker-config
```

Kết quả render được lưu ở:

```bash
/tmp/ecommerce-compose.rendered.yaml
```

## 4. Dựng toàn bộ stack bằng Docker Compose

```bash
make compose-up
```

Lưu ý:

- target này chạy `docker compose up --build`, tức là attach log luôn
- nếu muốn chạy nền, hãy dùng lệnh compose trực tiếp với `-d`

Ví dụ:

```bash
cd deployments/docker
docker compose --env-file ../../.env.local up --build -d
```

## 5. Những endpoint host nên nhớ

Compose hiện publish ra host các cổng sau:

- `http://localhost:80` -> `nginx`
- `http://localhost:4173` -> `frontend` preview container
- `http://localhost:8080` -> `api-gateway`
- `http://localhost:9000` -> MinIO API
- `http://localhost:9001` -> MinIO Console
- `http://localhost:9200` -> Elasticsearch
- `http://localhost:16686` -> Jaeger UI

### Điều rất dễ nhầm

Các service sau **không publish ra host mặc định**:

- `postgres`
- `redis`
- `rabbitmq`
- `prometheus`
- `grafana`
- `user-service`
- `product-service`
- `cart-service`
- `order-service`
- `payment-service`
- `notification-service`

Vì vậy:

- smoke test từ máy host nên đi qua `api-gateway`
- chẩn đoán service nội bộ nên dùng `docker compose ps`, `docker compose logs`, `docker inspect`

## 6. Frontend nào là UI chính

Repo hiện có hai frontend:

- `frontend/`: React + Vite, là UI local chính và có service Compose mặc định
- `client/`: Next.js experimental, không nằm trong Compose mặc định

### Chạy frontend ở chế độ dev ngoài Docker

```bash
make frontend-install
make frontend-dev
```

Vite dev server mặc định chạy ở:

```bash
http://localhost:5174
```

Khi chạy cách này, frontend dev sẽ proxy API về gateway ở `http://localhost:8080`.

## 7. Health checks nhanh

### Từ host

```bash
curl http://localhost:8080/health
curl http://localhost/health
```

### Xem trạng thái container

```bash
cd deployments/docker
docker compose --env-file ../../.env.local ps
```

Đây là cách đáng tin hơn việc giả định từng service nội bộ đều có port host riêng.

## 8. Tài khoản development mặc định

Khi chạy local bằng Compose, `user-service` bootstrap hai tài khoản để test nhanh:

- Admin: `admin.dev@ndshop.local` / `AdminTest!2026-ChangeMe`
- Staff: `staff.dev@ndshop.local` / `StaffTest!2026-ChangeMe`

### Ý nghĩa quyền

- `admin`: vào được `/admin` và có thể đổi role user khác
- `staff`: vào được `/admin` cho các thao tác vận hành, nhưng không đổi role người khác

### Override password local

```bash
export BOOTSTRAP_DEV_ACCOUNTS_ADMIN_PASSWORD='AdminLocal!2026'
export BOOTSTRAP_DEV_ACCOUNTS_STAFF_PASSWORD='StaffLocal!2026'
```

### Tắt seed account

```bash
export BOOTSTRAP_DEV_ACCOUNTS_ENABLED=false
```

## 9. Kiểm tra nhanh flow đăng nhập

```bash
ADMIN_TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "admin.dev@ndshop.local",
    "password": "AdminTest!2026-ChangeMe"
  }' | jq -r '.data.token')
```

```bash
curl http://localhost:8080/api/v1/users/profile \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## 10. Migration và database: điểm dễ nhầm nhất khi setup

`Makefile` có target:

```bash
make migrate-up
```

Nhưng cần nhớ:

- target này mặc định trỏ tới `localhost:5432`
- Compose hiện **không publish Postgres ra host**

Điều đó có nghĩa:

- khi chạy full stack Compose, migration thường đã được service tự chạy lúc startup
- muốn dùng `make migrate-up` từ host, bạn phải tự publish Postgres ra `5432` hoặc tạo cách truy cập tương đương

### Cách kiểm tra DB đang sống

```bash
cd deployments/docker
docker compose --env-file ../../.env.local exec postgres pg_isready -U admin
```

## 11. Nếu có lỗi startup

### Container chưa healthy

- chạy `docker compose ps`
- xem log của container lỗi
- ưu tiên kiểm tra `postgres`, `redis`, `rabbitmq`, `api-gateway`

### Frontend không gọi được API

- kiểm tra `http://localhost:8080/health`
- nếu chạy Vite dev, kiểm tra port `5174`
- nếu chạy frontend preview/container, kiểm tra `http://localhost:4173`

### Không đăng nhập được bằng dev account

- kiểm tra `user-service` có log bootstrap dev accounts không
- kiểm tra bạn có override password qua env hay không
- kiểm tra `BOOTSTRAP_DEV_ACCOUNTS_ENABLED` có bị tắt không

### Search hoặc object storage lỗi

`product-service` được viết để degrade gracefully khi MinIO hoặc Elasticsearch gặp lỗi. Catalog core vẫn có thể hoạt động ở mức cơ bản.
