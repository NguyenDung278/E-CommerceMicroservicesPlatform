# E-Commerce Microservices Platform

Đây là một dự án demo e-commerce theo kiến trúc microservices viết bằng Go. Mục tiêu chính là giúp bạn học cách tách nghiệp vụ thành nhiều service độc lập, giao tiếp qua HTTP, gRPC, message broker, rồi vận hành bằng Docker hoặc Kubernetes.

## Thành phần chính

- `api-gateway`: điểm vào chung cho client
- `user-service`: đăng ký, đăng nhập, hồ sơ người dùng
- `product-service`: CRUD và tìm kiếm sản phẩm
- `cart-service`: giỏ hàng trên Redis
- `order-service`: tạo đơn hàng, gọi `product-service` qua gRPC
- `payment-service`: xử lý thanh toán và phát event
- `notification-service`: consume event từ RabbitMQ
- `pkg`: config, middleware, logger, database helpers
- `deployments/docker`: local stack bằng Docker Compose
- `deployments/k8s`: manifest Kubernetes có hardening cơ bản
- `frontend`: giao diện React + Vite để bạn hình dung luồng sản phẩm và kiến trúc

## Yêu cầu

- Go 1.21+
- Docker + Docker Compose
- Node.js 20+ nếu muốn chạy frontend
- `kubectl` nếu muốn thử K8s

## Cấu hình môi trường

Tạo file `.env` từ mẫu:

```bash
cp .env.example .env
```

Sửa các giá trị như:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `RABBITMQ_PASSWORD`
- `GRAFANA_ADMIN_PASSWORD`

## Cách chạy local

Render Docker Compose:

```bash
make docker-config
```

Dựng stack local:

```bash
make compose-up
```

Khi chạy qua Docker Compose:

- API và gateway: `http://localhost`
- Frontend demo: `http://localhost:4173`
- Grafana: `http://localhost:3000`
- Prometheus: `http://localhost:9090`

Tắt stack:

```bash
make compose-down
```

## Frontend demo

Frontend được dựng bằng `React + Vite + TypeScript` để giữ tốc độ nhanh, cấu trúc dễ đọc, và phù hợp với repo backend hiện tại.

Chạy frontend:

```bash
cd frontend
npm install
npm run dev
```

Hoặc dùng Makefile:

```bash
make frontend-install
make frontend-dev
```

Mặc định frontend mở ở `http://localhost:5173`.

Bạn có thể chỉnh API base bằng biến:

```bash
VITE_API_BASE_URL=http://localhost:8080
```

## Validation

Request validation hiện dùng `go-playground/validator/v10` và được gắn vào Echo qua shared package `pkg/validation`.

Điều này có nghĩa là:

- DTO có tag `validate:"..."`
- handler gọi `c.Validate(&req)` sau `c.Bind(&req)`
- mọi service HTTP dùng chung một validator implementation
- lỗi validation trả về sớm ở handler thay vì để business logic xử lý input bẩn

Ví dụ:

```go
type RegisterRequest struct {
    Email    string `json:"email" validate:"required,email"`
    Password string `json:"password" validate:"required,min=8"`
}
```

Khi client gửi JSON sai, response sẽ là `400 Bad Request` với message dễ đọc như:

```json
{
  "success": false,
  "message": "validation failed",
  "error": "email must be a valid email, password must have at least 8 characters/items"
}
```

## Chạy local step by step

Phần này là lộ trình dễ nhất để bạn tự chạy và tự test toàn bộ stack trên máy local.

### Bước 1: Chuẩn bị biến môi trường

```bash
cp .env.example .env
```

Bạn có thể dùng luôn giá trị mặc định để học nhanh. Chỉ cần đảm bảo:

- `JWT_SECRET` dài tối thiểu 32 ký tự
- `POSTGRES_PASSWORD`, `RABBITMQ_PASSWORD`, `GRAFANA_ADMIN_PASSWORD` không để trống

### Bước 2: Dựng backend + hạ tầng bằng Docker Compose

```bash
make docker-config
make compose-up
```

Chờ các container healthy rồi kiểm tra nhanh:

- Nginx: `http://localhost/health`
- API Gateway: `http://localhost:8080/health`
- User Service: `http://localhost:8081/health`
- Product Service: `http://localhost:8082/health`
- Cart Service: `http://localhost:8083/health`
- Order Service: `http://localhost:8084/health`
- Payment Service: `http://localhost:8085/health`
- Notification Service: `http://localhost:8086/health`
- Grafana: `http://localhost:3000`
- Prometheus: `http://localhost:9090`
- RabbitMQ UI: `http://localhost:15672`
- Jaeger: `http://localhost:16686`

### Bước 3: Chạy frontend riêng để quan sát hệ thống

Mở terminal khác:

```bash
make frontend-install
make frontend-dev
```

Frontend dev sẽ chạy ở:

- `http://localhost:5173`

Nếu bạn muốn dùng frontend đã build sẵn trong Docker Compose:

- `http://localhost:4173`

Frontend hiện là dashboard/demo để:

- xem service health
- đăng ký, đăng nhập và giữ JWT trong `sessionStorage`
- xem profile và cập nhật profile
- tải catalog thật từ `product-service`
- add-to-cart, tạo order, process payment ngay trên UI
- mở Grafana, Prometheus, Jaeger, RabbitMQ

Frontend này vẫn là playground kỹ thuật, không phải storefront hoàn chỉnh, nhưng đã đủ để test end-to-end phần lớn flow local mà không cần Postman ở các bước cơ bản.

Các route chính của frontend:

- `/` trang chu
- `/products` catalog
- `/products/:productId` chi tiet san pham
- `/cart` gio hang
- `/checkout` tao order va thanh toan
- `/profile` profile + lich su order
- `/admin` khu vuc quan tri catalog cho admin

## Kịch bản test đầy đủ với JWT

Phần dưới đây là một flow hoàn chỉnh bạn có thể copy-paste gần như nguyên xi.

### Bước 1: Đăng ký user thường

```bash
curl -i -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "Password123",
    "first_name": "Alice",
    "last_name": "Nguyen"
  }'
```

Kết quả mong đợi:

- status `201 Created`
- trong `data.token` có JWT
- trong `data.user.role` mặc định là `user`

### Bước 2: Đăng nhập và lấy JWT

```bash
curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "Password123"
  }'
```

Nếu máy có `jq`, bạn có thể trích token nhanh:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "Password123"
  }' | jq -r '.data.token')

echo "$TOKEN"
```

Nếu chưa có `jq`, chỉ cần copy thủ công giá trị `data.token` từ JSON response.

### Bước 3: Gọi API cần đăng nhập

Ví dụ xem profile:

```bash
curl -s http://localhost:8080/api/v1/users/profile \
  -H "Authorization: Bearer $TOKEN"
```

Ví dụ cập nhật profile:

```bash
curl -s -X PUT http://localhost:8080/api/v1/users/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Alice Updated",
    "last_name": "Nguyen Updated"
  }'
```

### Bước 4: Nâng user lên admin để tạo sản phẩm

Route tạo sản phẩm yêu cầu role `admin`, nên bạn cần đổi role trong Postgres local.

Vào Postgres container:

```bash
docker exec -it ecommerce-postgres psql -U admin -d ecommerce
```

Trong `psql`, chạy:

```sql
UPDATE users
SET role = 'admin'
WHERE email = 'alice@example.com';
```

Thoát:

```sql
\q
```

Đăng nhập lại để lấy JWT mới có role `admin`:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "Password123"
  }' | jq -r '.data.token')
```

### Bước 5: Tạo sản phẩm

```bash
curl -s -X POST http://localhost:8080/api/v1/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mechanical Keyboard",
    "description": "75% layout, hot-swappable",
    "price": 189.99,
    "stock": 15,
    "category": "accessories",
    "image_url": "https://example.com/keyboard.jpg"
  }'
```

Lấy danh sách sản phẩm:

```bash
curl -s http://localhost:8080/api/v1/products
```

Lấy `product_id` từ response để dùng cho cart/order.

### Bước 6: Thêm vào giỏ hàng

```bash
curl -s -X POST http://localhost:8080/api/v1/cart/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "PUT_PRODUCT_ID_HERE",
    "name": "Mechanical Keyboard",
    "price": 189.99,
    "quantity": 2
  }'
```

Xem giỏ hàng:

```bash
curl -s http://localhost:8080/api/v1/cart \
  -H "Authorization: Bearer $TOKEN"
```

### Bước 7: Tạo order

Lưu ý:

- server sẽ xác thực lại product qua gRPC từ `product-service`
- `name` và `price` trong request hiện không phải nguồn chân lý cuối cùng
- `product-service` mới là nơi cung cấp giá và stock thật

```bash
curl -s -X POST http://localhost:8080/api/v1/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "product_id": "PUT_PRODUCT_ID_HERE",
        "quantity": 2
      }
    ]
  }'
```

Sau khi tạo order:

- `order-service` ghi order vào Postgres
- phát event `order.created` lên RabbitMQ
- `notification-service` consume event này

Xem danh sách order:

```bash
curl -s http://localhost:8080/api/v1/orders \
  -H "Authorization: Bearer $TOKEN"
```

### Bước 8: Thanh toán

Lấy `order_id` vừa tạo rồi gọi:

```bash
curl -s -X POST http://localhost:8080/api/v1/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "PUT_ORDER_ID_HERE",
    "amount": 379.98,
    "payment_method": "credit_card"
  }'
```

Sau bước này:

- `payment-service` ghi payment
- phát event `payment.completed`
- `notification-service` nhận event và log thông báo giả lập

Xem payment theo order:

```bash
curl -s http://localhost:8080/api/v1/payments/order/PUT_ORDER_ID_HERE \
  -H "Authorization: Bearer $TOKEN"
```

## Cách quan sát hệ thống khi test

### Frontend

Mở:

- `http://localhost:5173` nếu chạy Vite dev
- `http://localhost:4173` nếu dùng frontend container

Bạn sẽ thấy:

- service health
- auth playground với JWT session
- catalog thật từ backend
- form tạo order và payment
- liên kết nhanh tới API/Grafana/Prometheus/Jaeger/RabbitMQ

### RabbitMQ

Mở:

- `http://localhost:15672`

Login bằng:

- username: giá trị `RABBITMQ_USER` trong `.env`
- password: giá trị `RABBITMQ_PASSWORD` trong `.env`

Bạn có thể quan sát:

- exchange `events`
- queue `notification-queue`
- routing key như `order.created`, `payment.completed`

### Grafana

Mở:

- `http://localhost:3000`

Login bằng:

- username: giá trị `GRAFANA_ADMIN_USER`
- password: giá trị `GRAFANA_ADMIN_PASSWORD`

### Jaeger

Mở:

- `http://localhost:16686`

Nếu sau này bạn bổ sung tracing thật, đây sẽ là nơi xem flow `gateway -> service -> gRPC -> broker`.

## Tại sao validator quan trọng trong flow này

Ví dụ với request tạo user:

```json
{
  "email": "not-an-email",
  "password": "123"
}
```

Handler sẽ chạy theo thứ tự:

1. `c.Bind(&req)` để parse JSON vào struct Go
2. `c.Validate(&req)` để kiểm tra tag `validate:"..."`
3. nếu sai thì trả `400`
4. nếu đúng mới gọi `userService.Register(...)`

Ý nghĩa:

- input bẩn bị chặn ngay ở biên hệ thống
- service layer đỡ phải lặp lại check cơ bản
- response validation nhất quán giữa các service

## Quality checks

Format:

```bash
make fmt
```

Đồng bộ module:

```bash
make tidy
```

Chạy test:

```bash
make test
```

Chạy vet:

```bash
make vet
```

Chạy toàn bộ pipeline local:

```bash
make ci
```

## Migrations

Migrations đã được chuyển sang `golang-migrate` + `embed`.

- `services/user-service/migrations`
- `services/product-service/migrations`
- `services/order-service/migrations`
- `services/payment-service/migrations`

Mỗi service sẽ tự động chạy migration khi startup. Cách này giúp:

- version schema rõ ràng
- dễ review thay đổi DB
- không còn hard-code SQL trong `main.go`
- container chạy độc lập hơn vì binary tự mang migration theo nó

## Testing

### Unit và integration đã có

- service layer:
  - `services/user-service/internal/service/user_service_test.go`
- handler layer:
  - `services/product-service/internal/handler/product_handler_test.go`
- integration flow:
  - `services/user-service/internal/handler/user_handler_integration_test.go`
  - `api-gateway/internal/proxy/service_proxy_integration_test.go`

### Testcontainers integration

Đã bổ sung test chạy với hạ tầng thật:

- Postgres:
  - `services/user-service/internal/repository/user_repository_integration_test.go`
- Redis:
  - `services/cart-service/internal/repository/cart_repository_integration_test.go`
- RabbitMQ:
  - `services/order-service/internal/service/rabbitmq_integration_test.go`

Các test này sẽ tự `skip` nếu máy không có Docker daemon.

## Monitoring

Đã bổ sung:

- alert rules cho Prometheus
- dashboard provisioning cho Grafana
- dashboard overview cho toàn hệ thống

Các file chính:

- `deployments/docker/prometheus.yml`
- `deployments/docker/alert_rules.yml`
- `deployments/docker/grafana/dashboards/dashboard-provider.yml`
- `deployments/docker/grafana/dashboards/json/ecommerce-platform-overview.json`

## CI/CD

Workflow hiện có:

- `.github/workflows/ci.yml`: chạy `gofmt`, `go test`, `go vet`
- `.github/workflows/docker-publish.yml`: build và publish Docker images lên GHCR

Lưu ý:

- workflow publish dùng `ghcr.io/${OWNER}/ecommerce-*`
- cần quyền package write của GitHub Actions

## Security và scalability đã bổ sung

- JWT auth + role-based authorization cho admin route
- in-memory rate limit
- security headers qua Echo `Secure`
- HTTP timeout trên từng service
- retry/circuit breaker trong API Gateway proxy
- secrets đưa qua env vars
- Docker image chạy non-root
- Kubernetes có ingress TLS, HPA, PDB, NetworkPolicy, resource limits

## Kubernetes

Áp dụng manifest:

```bash
make k8s-apply
```

Xoá manifest:

```bash
make k8s-delete
```

Lưu ý:

- `deployments/k8s/secrets.yaml` chỉ là mẫu, cần thay secret thật
- `deployments/k8s/ingress.yaml` tham chiếu TLS secret `ecommerce-tls`
- image trong `deployments/k8s/apps.yaml` cần đổi thành image thật của bạn
- để dùng HPA trong thực tế, cluster cần metrics server

## Hướng phát triển tiếp

- thêm integration test end-to-end đầy đủ cho toàn flow checkout
- thêm idempotency/outbox pattern cho event publishing
- thêm External Secrets hoặc Vault
- thêm dashboard business metrics như số đơn hàng, GMV, payment success rate
