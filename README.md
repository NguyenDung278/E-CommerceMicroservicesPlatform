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
VITE_API_BASE_URL=http://localhost
```

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
