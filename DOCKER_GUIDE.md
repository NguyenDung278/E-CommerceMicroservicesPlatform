# Docker Guide

Tài liệu này mô tả cách dùng Docker Compose đúng với trạng thái source hiện tại của repo. Mục tiêu là:

- biết service nào đang thật sự chạy trong compose
- biết URL nào mới là entrypoint local đúng
- biết cách build, up, down, restart, inspect và debug stack
- tránh các hiểu nhầm phổ biến như "localhost:80 là frontend chính" hoặc "Postgres đã publish ra host"

---

## 1. Compose Hiện Đang Chạy Gì

Compose file chính:

```text
deployments/docker/docker-compose.yml
```

Stack mặc định hiện có:

| Service | Vai trò | Truy cập từ host |
| --- | --- | --- |
| `frontend` | frontend React + Vite build static, serve bằng Nginx | `http://localhost:4173` |
| `nginx` | edge proxy riêng cho `/api` và `/health` | `http://localhost` |
| `api-gateway` | public HTTP entrypoint cho backend | `http://localhost:8080` |
| `user-service` | auth, profile, address, wishlist, OTP | không publish |
| `product-service` | catalog, review, upload, search, storefront data | không publish |
| `cart-service` | Redis cart | không publish |
| `order-service` | order, coupon, return, report | không publish |
| `payment-service` | payment, refund, webhook | không publish |
| `notification-service` | queue consumer và email worker | không publish |
| `postgres` | source of truth cho các DB chính | không publish |
| `redis` | cart, cache, rate limit phụ trợ | không publish |
| `rabbitmq` | event broker | không publish |
| `minio` | object storage cho media | `http://localhost:9000`, console `http://localhost:9001` |
| `elasticsearch` | search index | `http://localhost:9200` |
| `jaeger` | tracing local | `http://localhost:16686` |
| `prometheus` | metrics scraping | không publish |
| `grafana` | dashboards | không publish |

Lưu ý rất quan trọng:

- UI local mặc định trong compose là `http://localhost:4173`
- `http://localhost` không phải storefront chính
- Postgres, Redis, RabbitMQ không publish port ra host theo mặc định

---

## 2. Client Next.js Đang Ở Trạng Thái Nào

`client/` hiện không còn là một ý tưởng rời rạc nữa. Compose đã có service `client`, nhưng được đặt sau profile:

```yaml
profiles: ["client"]
```

Điều đó có nghĩa:

- runtime mặc định vẫn là `frontend`
- `client` chỉ bật khi bạn chủ động muốn smoke test hướng Next.js

Chạy profile `client`:

```bash
COMPOSE_PROFILES=client make compose-up
```

Khi bật profile này, `client` sẽ chạy ở:

```text
http://localhost:3000
```

---

## 3. Luồng Cấu Hình Môi Trường

Thứ tự cấu hình hiện tại:

1. `Makefile` ưu tiên `.env.local`
2. Compose inject env và mount file config YAML từ `deployments/docker/config/`
3. các Go service nhận `CONFIG_PATH=/config/config.yaml`
4. `pkg/config` load file + env override

Chuẩn bị env local:

```bash
cp .env.local.example .env.local
```

Các biến cần chú ý:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `RABBITMQ_PASSWORD`
- `FRONTEND_BASE_URL`
- `SMTP_*`
- `OAUTH_GOOGLE_*`
- `TELEGRAM_*`

Lưu ý thực tế:

- nếu dùng frontend Docker, `FRONTEND_BASE_URL` nên khớp `http://localhost:4173`
- nếu dùng Vite dev server, `FRONTEND_BASE_URL` nên khớp `http://localhost:5174`
- nếu base URL lệch, các flow như verify email, reset password và OAuth redirect sẽ dễ lỗi

---

## 4. Lệnh Chuẩn Hàng Ngày

### Render compose cuối cùng

```bash
make docker-config
```

File render:

```text
/tmp/ecommerce-compose.rendered.yaml
```

### Build stack

```bash
make compose-build
```

### Up stack

```bash
make compose-up
```

`make compose-up` chạy ở chế độ attached.

### Down stack

```bash
make compose-down
```

### Chạy raw Docker Compose

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml up --build -d
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml down
```

---

## 5. Khi Nào Cần Rebuild

### Cần rebuild image

- sửa source Go
- sửa source frontend
- sửa Dockerfile
- sửa `frontend/nginx.conf`

### Thường chỉ cần restart

- sửa file config mount ở `deployments/docker/config/*.yaml`
- đổi env mà service đọc lúc start

Ví dụ:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml restart product-service
```

---

## 6. URL Và Điểm Vào Quan Trọng

| URL | Mục đích |
| --- | --- |
| `http://localhost:4173` | frontend Docker mặc định |
| `http://localhost:5174` | frontend Vite dev trên host |
| `http://localhost:3000` | client Next.js khi bật profile `client` hoặc chạy host |
| `http://localhost:8080` | API Gateway |
| `http://localhost` | nginx edge proxy |
| `http://localhost:9000` | MinIO API |
| `http://localhost:9001` | MinIO Console |
| `http://localhost:9200` | Elasticsearch |
| `http://localhost:16686` | Jaeger UI |

Smoke check nhanh:

```bash
curl http://localhost:4173/health
curl http://localhost:8080/health
curl http://localhost/health
```

---

## 7. Xem Trạng Thái Và Log

### Xem service đang chạy

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml ps
```

### Xem log

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml logs -f api-gateway
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml logs -f user-service product-service
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml logs --tail=200 postgres
```

### Log cho flow quan trọng

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml logs -f order-service payment-service notification-service
```

---

## 8. Healthcheck Và Probe Nội Bộ

Compose healthcheck hiện có trên:

- `postgres`
- `redis`
- `rabbitmq`
- `minio`
- `prometheus`
- `grafana`

Một số Go service không khai báo compose healthcheck, nên cách kiểm tra thực tế hơn là:

- xem log
- gọi gateway `/health`
- probe nội bộ trên network compose

Ví dụ probe nội bộ:

```bash
docker run --rm --network ecommerce-network curlimages/curl:8.10.1 http://user-service:8081/health
docker run --rm --network ecommerce-network curlimages/curl:8.10.1 http://product-service:8082/health
docker run --rm --network ecommerce-network curlimages/curl:8.10.1 http://cart-service:8083/health
docker run --rm --network ecommerce-network curlimages/curl:8.10.1 http://order-service:8084/health
docker run --rm --network ecommerce-network curlimages/curl:8.10.1 http://payment-service:8085/health
docker run --rm --network ecommerce-network curlimages/curl:8.10.1 http://notification-service:8086/health
```

Kiểm tra health state:

```bash
docker inspect --format '{{json .State.Health}}' ecommerce-postgres
docker inspect --format '{{json .State.Health}}' ecommerce-redis
docker inspect --format '{{json .State.Health}}' ecommerce-rabbitmq
```

---

## 9. Shell, Inspect, Và Debug Container

### Vào shell các container có shell

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec frontend sh
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres sh
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec redis sh
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec rabbitmq sh
```

### Với container distroless

Các Go service runtime thường không có shell. Dùng:

```bash
docker logs -f ecommerce-api-gateway
docker inspect ecommerce-user-service
docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' ecommerce-product-service
```

### Debug frontend container

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec frontend cat /etc/nginx/conf.d/default.conf
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec frontend ls -la /usr/share/nginx/html
```

### Debug Redis Và RabbitMQ

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec redis redis-cli ping
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec rabbitmq rabbitmqctl list_queues
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec rabbitmq rabbitmqctl list_bindings
```

---

## 10. Debug Network, Env, Volume

### Xem env của container

Container có shell:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres env | sort
```

Container distroless:

```bash
docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' ecommerce-user-service | sort
docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' ecommerce-payment-service | sort
```

### Xem network

```bash
docker network inspect ecommerce-network
```

### Xem volume

```bash
docker volume ls | grep ecommerce
docker volume inspect ecommerce-platform_postgres-data
```

### Xem image đã build

```bash
docker image ls | grep ecommerce
```

---

## 11. Truy Cập Database Khi Cần Debug

Postgres không publish ra host, nên debug bằng cách exec vào container:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres psql -U admin -d ecommerce_user
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres psql -U admin -d ecommerce_product
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres psql -U admin -d ecommerce_order
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres psql -U admin -d ecommerce_payment
```

Các database chính:

- `ecommerce_user`
- `ecommerce_product`
- `ecommerce_order`
- `ecommerce_payment`

---

## 12. Những Hiểu Nhầm Phổ Biến Cần Tránh

### "localhost:80 là frontend chính"

Sai. UI local mặc định trong compose là:

```text
http://localhost:4173
```

### "client đã là runtime mặc định"

Sai. `client` hiện là runtime tùy chọn sau compose profile.

### "Postgres/Redis/RabbitMQ truy cập localhost được ngay"

Sai. Chúng không publish port ra host trong compose mặc định.

### "Sửa config là phải rebuild toàn bộ"

Không hẳn. Nhiều thay đổi config chỉ cần restart service tương ứng.

### "Compose là source of truth duy nhất"

Chưa đủ. Khi debug runtime, hãy đọc thêm:

- `README.md`
- `deployments/docker/config/*.yaml`
- `cmd/main.go` của service liên quan

---

## 13. Quy Trình Debug Nhanh Khi Stack Hỏng

Nếu local stack có vấn đề, đi theo thứ tự:

1. `docker compose ... ps`
2. `curl http://localhost:8080/health`
3. xem log `api-gateway`
4. xem log service upstream liên quan
5. probe nội bộ service đó trên `ecommerce-network`
6. nếu nghi DB, exec vào `postgres` và kiểm tra dữ liệu / migration
7. nếu nghi env/config, inspect env + file config mount

Cách này giúp bạn tìm lỗi nhanh hơn rất nhiều so với down/up toàn bộ stack theo phản xạ.
