# Docker Guide

Tài liệu này mô tả cách chạy và debug Docker Compose cho backend/runtime của repo. Mục tiêu:

- biết service nào đang chạy trong compose
- biết URL backend nào cần dùng
- biết cách build, up, down, restart, inspect và debug stack
- tránh nhầm lẫn giữa gateway, nginx edge proxy và service nội bộ

---

## 1. Compose File

Compose file chính:

```text
deployments/docker/docker-compose.yml
```

Stack mặc định:

| Service | Vai trò | Truy cập từ host |
| --- | --- | --- |
| `nginx` | edge proxy cho `/api` và `/health` | `http://localhost` |
| `api-gateway` | public HTTP entrypoint cho backend | `http://localhost:8080` |
| `user-service` | auth, profile, address, wishlist, OTP | không publish |
| `product-service` | catalog, review, upload, search, catalog aggregation | không publish |
| `cart-service` | Redis cart | không publish |
| `order-service` | order, coupon, return, report, refund queue | không publish |
| `payment-service` | payment, refund, webhook | không publish |
| `notification-service` | queue consumer và email worker | không publish |
| `postgres` | source of truth cho các DB chính | không publish |
| `redis` | cart, cache, rate limit, inbox phụ trợ | không publish |
| `rabbitmq` | event broker | không publish |
| `minio` | object storage cho media | `http://localhost:9000`, console `http://localhost:9001` |
| `elasticsearch` | search index | `http://localhost:9200` |
| `jaeger` | distributed tracing | `http://localhost:16686` |
| `prometheus` | metrics scraping | không publish |
| `grafana` | dashboards | không publish |

Lưu ý:

- Public API chuẩn là `http://localhost:8080`.
- `http://localhost` chỉ là nginx edge proxy cho `/api/*` và `/health`.
- PostgreSQL, Redis, RabbitMQ, Prometheus và Grafana không publish port ra host theo mặc định.

---

## 2. Luồng Cấu Hình

Thứ tự cấu hình:

1. `Makefile` ưu tiên `.env.local`, fallback `.env.example`.
2. Compose inject env và mount YAML từ `deployments/docker/config/`.
3. Go service nhận `CONFIG_PATH=/config/config.yaml`.
4. `pkg/config` load default, YAML file và environment override.

Chuẩn bị env local:

```bash
cp .env.local.example .env.local
```

Biến backend cần chú ý:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `RABBITMQ_PASSWORD`
- `SMTP_*`
- `OAUTH_GOOGLE_*`
- `TELEGRAM_*`
- `PAYMENT_GATEWAY_MOMO_*`
- `MINIO_*`
- `ELASTICSEARCH_*`

---

## 3. Lệnh Hàng Ngày

Render compose:

```bash
make docker-config
```

File render:

```text
/tmp/ecommerce-compose.rendered.yaml
```

Build stack:

```bash
make compose-build
```

Up stack:

```bash
make compose-up
```

Down stack:

```bash
make compose-down
```

Chạy nền bằng Docker Compose:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml up --build -d
```

Dừng stack:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml down
```

---

## 4. Khi Nào Cần Rebuild

Cần rebuild image khi:

- sửa source Go
- sửa Dockerfile
- sửa dependency build

Thường chỉ cần restart service khi:

- sửa file `deployments/docker/config/*.yaml`
- đổi env mà service đọc lúc start

Ví dụ:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml restart product-service
```

---

## 5. URL Và Điểm Vào

| URL | Mục đích |
| --- | --- |
| `http://localhost:8080` | API Gateway |
| `http://localhost` | nginx edge proxy |
| `http://localhost:9000` | MinIO API |
| `http://localhost:9001` | MinIO Console |
| `http://localhost:9200` | Elasticsearch |
| `http://localhost:16686` | Jaeger trace viewer |

Smoke check:

```bash
curl http://localhost:8080/health
curl http://localhost/health
```

---

## 6. Log Và Trạng Thái

Xem service:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml ps
```

Log gateway:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml logs -f api-gateway
```

Log domain service:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml logs -f user-service product-service
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml logs -f order-service payment-service notification-service
```

Log infra:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml logs --tail=200 postgres
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml logs --tail=200 redis rabbitmq
```

---

## 7. Healthcheck Và Probe Nội Bộ

Compose healthcheck có trên:

- `postgres`
- `redis`
- `rabbitmq`
- `minio`
- `prometheus`
- `grafana`

Go service nên được kiểm tra bằng log, gateway `/health`, hoặc probe nội bộ:

```bash
docker run --rm --network ecommerce-network curlimages/curl:8.10.1 http://user-service:8081/health
docker run --rm --network ecommerce-network curlimages/curl:8.10.1 http://product-service:8082/health
docker run --rm --network ecommerce-network curlimages/curl:8.10.1 http://cart-service:8083/health
docker run --rm --network ecommerce-network curlimages/curl:8.10.1 http://order-service:8084/health
docker run --rm --network ecommerce-network curlimages/curl:8.10.1 http://payment-service:8085/health
docker run --rm --network ecommerce-network curlimages/curl:8.10.1 http://notification-service:8086/health
```

Health state:

```bash
docker inspect --format '{{json .State.Health}}' ecommerce-postgres
docker inspect --format '{{json .State.Health}}' ecommerce-redis
docker inspect --format '{{json .State.Health}}' ecommerce-rabbitmq
```

---

## 8. Shell, Inspect, Network, Volume

Container có shell:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres sh
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec redis sh
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec rabbitmq sh
```

Go service runtime thường không có shell. Dùng:

```bash
docker logs -f ecommerce-api-gateway
docker inspect ecommerce-user-service
docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' ecommerce-product-service | sort
```

Network:

```bash
docker network inspect ecommerce-network
```

Volume:

```bash
docker volume ls | grep ecommerce
docker volume inspect ecommerce-platform_postgres-data
```

Image:

```bash
docker image ls | grep ecommerce
```

---

## 9. Redis Và RabbitMQ

Redis:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec redis redis-cli ping
```

RabbitMQ:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec rabbitmq rabbitmqctl list_queues
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec rabbitmq rabbitmqctl list_bindings
```

---

## 10. Database Debug

Postgres không publish ra host. Debug bằng cách exec vào container:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres psql -U admin -d ecommerce_user
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres psql -U admin -d ecommerce_product
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres psql -U admin -d ecommerce_order
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres psql -U admin -d ecommerce_payment
```

Database chính:

- `ecommerce_user`
- `ecommerce_product`
- `ecommerce_order`
- `ecommerce_payment`

---

## 11. Migration

Các service dùng PostgreSQL tự chạy embedded migration khi startup nếu wiring service hiện tại hỗ trợ.

Migration folder:

- `services/user-service/migrations/`
- `services/product-service/migrations/`
- `services/order-service/migrations/`
- `services/payment-service/migrations/`

Make target:

```bash
make migrate-up
make migrate-down
make migrate-force
```

Lưu ý:

- Make target migration mặc định dùng container/network compose.
- Không giả định Postgres publish ở `localhost:5432` trong runtime compose mặc định.

---

## 12. Runtime Truth Matrix

| Bề mặt | URL | Process trả response |
| --- | --- | --- |
| Public API | `http://localhost:8080` | `api-gateway` |
| Edge `/api` và `/health` | `http://localhost` | `nginx` -> `api-gateway` |
| Trace viewer | `http://localhost:16686` | `jaeger` |
| Object storage API | `http://localhost:9000` | `minio` |
| Object storage console | `http://localhost:9001` | `minio` |
| Search index | `http://localhost:9200` | `elasticsearch` |

---

## 13. Debug Theo Triệu Chứng

### Gateway sống nhưng domain API trả 502 hoặc timeout

1. Xem log `api-gateway`.
2. Xem log service upstream tương ứng.
3. Probe nội bộ service đó trên `ecommerce-network`.
4. Kiểm tra config YAML mount của service.
5. Nếu nghi DB, vào `postgres` kiểm tra migration/data.

### Service không kết nối được DB

1. Kiểm tra health `postgres`.
2. Kiểm tra env `DATABASE_*` trong container service.
3. Kiểm tra `deployments/docker/config/<service>.yaml`.
4. Kiểm tra database đã tồn tại trong `postgres-init`.
5. Xem log migration lúc service startup.

### Tạo order được nhưng payment/webhook không cập nhật

1. Xem log `payment-service`.
2. Xem log `order-service`.
3. Kiểm tra route `/api/v1/payments/webhooks/momo`.
4. Kiểm tra `payments`, `outbox_events`, `inbox_messages`.
5. Dùng Jaeger để xem trace qua gateway, payment và order.

### Return đã queue refund nhưng chưa hoàn tất

1. Xem log `order-service` refund worker.
2. Xem log `payment-service`.
3. Kiểm tra bảng `returns`.
4. Kiểm tra `refund_attempt_count`.
5. Kiểm tra `refund_last_error`.
6. Kiểm tra `refund_next_retry_at`.
7. Kiểm tra `refund_processing_started_at`.
8. Kiểm tra service JWT giữa order và payment nếu nghi auth nội bộ.

### Notification không gửi hoặc gửi lặp

1. Xem log `notification-service`.
2. Kiểm tra RabbitMQ queues.
3. Kiểm tra Redis inbox claim state nếu nghi dedupe.
4. Kiểm tra preference source ở `user-service`.
5. Kiểm tra retry queue headers và dead-letter path nếu có.

---

## 14. Hiểu Nhầm Cần Tránh

- `http://localhost` không phải public API chính; public API trực tiếp là `http://localhost:8080`.
- PostgreSQL, Redis và RabbitMQ không truy cập được qua host port trong compose mặc định.
- Sửa config mount không luôn cần rebuild image; restart service thường đủ.
- Compose không thay thế source code; khi debug phải đọc thêm `cmd/main.go`, handler, service, repository và config YAML.
