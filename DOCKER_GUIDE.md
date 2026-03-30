# Docker Guide

Tài liệu này mô tả cách dùng Docker và Docker Compose đúng với trạng thái source hiện tại của repo. Mục tiêu là giúp bạn:

- biết service nào đang thực sự có trong compose
- biết đâu là frontend chính, đâu là backend, đâu là hạ tầng phụ trợ
- biết cách build, start, stop, restart, xem log, inspect container, debug network và kiểm tra database
- tránh các giả định sai phổ biến như "frontend chính ở cổng 80" hoặc "Postgres đã publish ra localhost"

## 1. Docker đang chạy những gì trong repo này

Compose file chính: `deployments/docker/docker-compose.yml`

| Service | Vai trò | Cách nhận ra trong source | Truy cập từ host |
| --- | --- | --- | --- |
| `frontend` | Frontend React + Vite đã build static và serve bằng Nginx | `frontend/Dockerfile`, `frontend/nginx.conf` | `http://localhost:4173` |
| `nginx` | Edge reverse proxy riêng cho `/api/*` và `/health` | `deployments/docker/nginx.conf` | `http://localhost` |
| `api-gateway` | Cửa vào HTTP cho backend | `api-gateway/Dockerfile`, `api-gateway/cmd/main.go` | `http://localhost:8080` |
| `user-service` | Auth, profile, address, OAuth, Telegram OTP | `services/user-service/cmd/main.go` | không publish ra host |
| `product-service` | Catalog, review, upload, search, gRPC product lookup | `services/product-service/cmd/main.go` | không publish ra host |
| `cart-service` | Giỏ hàng Redis | `services/cart-service/cmd/main.go` | không publish ra host |
| `order-service` | Preview/create/list/cancel order, coupon, report | `services/order-service/cmd/main.go` | không publish ra host |
| `payment-service` | Payment, webhook MoMo, refund | `services/payment-service/cmd/main.go` | không publish ra host |
| `notification-service` | Worker gửi email qua RabbitMQ event | `services/notification-service/cmd/main.go` | không publish ra host |
| `postgres` | PostgreSQL dùng chung nhiều database | `deployments/docker/postgres-init/01-create-databases.sql` | không publish ra host |
| `redis` | Redis cho cart/rate limit | compose + config service | không publish ra host |
| `rabbitmq` | Message broker cho order/payment/notification | compose + config service | không publish ra host |
| `minio` | Object storage cho media sản phẩm | compose + `product-service` config | `http://localhost:9000`, console `http://localhost:9001` |
| `elasticsearch` | Search index cho product catalog | compose + `product-service` config | `http://localhost:9200` |
| `jaeger` | Tracing local | compose + tracing config | `http://localhost:16686` |
| `prometheus` | Metrics scraping | `deployments/docker/prometheus.yml` | chưa publish ra host |
| `grafana` | Dashboard provisioning | `deployments/docker/grafana/*` | chưa publish ra host |

Điểm rất dễ nhầm:

- frontend chính trong compose là `frontend` ở cổng `4173`, không phải `http://localhost`
- `nginx` ở cổng `80` hiện chỉ proxy API và `/health`, không serve UI
- `client/` có Dockerfile riêng nhưng không có service `client` trong compose mặc định

## 2. Luồng cấu hình môi trường

Thứ tự config hiện tại:

1. `Makefile` ưu tiên `.env.local`, fallback sang `.env.example`
2. Docker Compose inject env và mount các file YAML ở `deployments/docker/config/*.yaml`
3. Mỗi Go service nhận `CONFIG_PATH=/config/config.yaml`
4. `pkg/config` load default + config file + env override

Lệnh chuẩn để tạo env local:

```bash
cp .env.local.example .env.local
```

Các biến cần chú ý nhất:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `RABBITMQ_PASSWORD`
- `FRONTEND_BASE_URL`
- `SMTP_*`
- `OAUTH_GOOGLE_*`
- `TELEGRAM_*`

Lưu ý thực tế:

- `.env.local.example` đang để `FRONTEND_BASE_URL=http://localhost:4173`
- `frontend/vite.config.ts` lại chạy host dev ở `http://localhost:5174`
- nếu bạn chuyển giữa frontend Docker và Vite dev, hãy đổi `FRONTEND_BASE_URL` cho khớp để verify-email, reset-password và OAuth redirect không bị sai cổng

## 3. Build image và khởi động stack

### Cách dùng qua Makefile

```bash
make docker-config
make compose-build
make compose-up
```

Giải thích:

- `make docker-config`: render compose cuối cùng ra `/tmp/ecommerce-compose.rendered.yaml`
- `make compose-build`: build image theo compose
- `make compose-up`: `docker compose up --build` ở chế độ attached

Chạy một phần stack:

```bash
make compose-build SERVICES="frontend api-gateway user-service"
make compose-up SERVICES="frontend api-gateway user-service"
```

### Cách dùng raw Docker Compose

Nếu bạn muốn chạy nền hoặc không muốn phụ thuộc Make target:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml up --build -d
```

Dừng stack:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml down
```

Khởi động lại một service:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml restart product-service
```

Stop/start riêng lẻ:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml stop payment-service
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml start payment-service
```

Khi nào cần rebuild:

- sửa source Go hoặc source frontend: cần `up --build` hoặc `build` lại image liên quan
- sửa file mount config trong `deployments/docker/config/*.yaml`: thường chỉ cần `restart` service tương ứng
- sửa `frontend/nginx.conf`: cần rebuild `frontend` image vì file này được copy lúc build

## 4. Kiểm tra trạng thái, port mapping và health

Xem service nào đang chạy:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml ps
```

Xem port mapping công khai:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml port frontend 80
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml port api-gateway 8080
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml port minio 9000
```

Kiểm tra nhanh từ host:

```bash
curl http://localhost:4173/health
curl http://localhost:8080/health
curl http://localhost/health
```

Health check dạng compose hiện chỉ có ở:

- `postgres`
- `redis`
- `rabbitmq`
- `minio`
- `prometheus`
- `grafana`

Kiểm tra health status của container có healthcheck:

```bash
docker inspect --format '{{json .State.Health}}' ecommerce-postgres
docker inspect --format '{{json .State.Health}}' ecommerce-redis
docker inspect --format '{{json .State.Health}}' ecommerce-rabbitmq
```

Các service Go và `frontend` hiện không khai báo compose healthcheck. Với chúng, cách kiểm tra thực tế hơn là:

- đọc log
- gọi `http://localhost:8080/health` cho gateway
- gọi `http://localhost:4173/health` cho frontend Docker
- hoặc probe trực tiếp service nội bộ bằng sidecar container trên network compose

Ví dụ probe nội bộ:

```bash
docker run --rm --network ecommerce-network curlimages/curl:8.10.1 http://user-service:8081/health
docker run --rm --network ecommerce-network curlimages/curl:8.10.1 http://product-service:8082/health
docker run --rm --network ecommerce-network curlimages/curl:8.10.1 http://cart-service:8083/health
docker run --rm --network ecommerce-network curlimages/curl:8.10.1 http://order-service:8084/health
docker run --rm --network ecommerce-network curlimages/curl:8.10.1 http://payment-service:8085/health
docker run --rm --network ecommerce-network curlimages/curl:8.10.1 http://notification-service:8086/health
```

## 5. Logs, shell và debug container

### Xem log

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml logs -f api-gateway
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml logs -f user-service product-service
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml logs --tail=200 postgres
```

### Vào shell trong container

Bạn vào shell được với các container có shell sẵn, ví dụ:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec frontend sh
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres sh
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec redis sh
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec rabbitmq sh
```

Không vào shell được với `api-gateway` và các Go services, vì image runtime dùng distroless như `gcr.io/distroless/static-debian12:nonroot`.

Thay vào đó, dùng:

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

### Debug Redis và RabbitMQ

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec redis redis-cli ping
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec rabbitmq rabbitmqctl list_queues
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec rabbitmq rabbitmqctl list_bindings
```

## 6. Kiểm tra biến môi trường, network, volume và image

### Biến môi trường

Container có shell:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres env | sort
```

Container distroless:

```bash
docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' ecommerce-user-service | sort
docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' ecommerce-payment-service | sort
```

Nếu bạn muốn xem compose cuối cùng đã render ra sao:

```bash
make docker-config
sed -n '1,240p' /tmp/ecommerce-compose.rendered.yaml
```

### Network

Compose đang tạo network tên cố định là `ecommerce-network`.

```bash
docker network inspect ecommerce-network
```

### Volume

Volume có trong compose:

- `postgres-data`
- `redis-data`
- `rabbitmq-data`
- `minio-data`
- `elasticsearch-data`
- `prometheus-data`
- `grafana-data`

Tên volume thực tế trên máy có thể được Compose prefix theo project name. Cách kiểm tra an toàn:

```bash
docker volume ls | grep -E 'postgres-data|redis-data|rabbitmq-data|minio-data|elasticsearch-data|prometheus-data|grafana-data'
```

Sau đó inspect volume cụ thể:

```bash
docker volume inspect <ten-volume>
```

### Image

```bash
docker image ls
docker image ls | grep -E 'api-gateway|user-service|product-service|cart-service|order-service|payment-service|notification-service|frontend'
```

## 7. Database: đọc từ source và kiểm tra từ container

### Repo đang dùng database gì và có ORM không

- Database chính: PostgreSQL
- Không dùng MySQL
- Không dùng MongoDB
- Không dùng ORM như GORM/Bun/Ent
- Persistence đi qua `database/sql` + driver `lib/pq`
- Migration dùng `golang-migrate`

Những chỗ nên đọc trong source nếu muốn hiểu DB:

- `pkg/database/postgres.go`: tạo connection pool và chạy migration embedded
- `deployments/docker/postgres-init/01-create-databases.sql`: tạo các database `ecommerce_user`, `ecommerce_product`, `ecommerce_order`, `ecommerce_payment`
- `deployments/docker/config/*-service.yaml`: host `postgres`, port `5432`, tên database từng service
- `services/*/migrations/`: schema SQL thật của từng domain

### Kết nối Postgres từ container

Compose không publish `5432` ra host, nên cách đơn giản nhất là vào thẳng container Postgres:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres psql -U admin -l
```

Kiểm tra bảng của từng service:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres psql -U admin -d ecommerce_user -c '\dt'
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres psql -U admin -d ecommerce_product -c '\dt'
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres psql -U admin -d ecommerce_order -c '\dt'
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres psql -U admin -d ecommerce_payment -c '\dt'
```

Ví dụ query nhanh:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres psql -U admin -d ecommerce_user -c 'SELECT id, email, role, email_verified FROM users ORDER BY created_at DESC LIMIT 5;'
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres psql -U admin -d ecommerce_product -c 'SELECT id, name, status, price FROM products ORDER BY created_at DESC LIMIT 5;'
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres psql -U admin -d ecommerce_order -c 'SELECT id, user_id, status, total_price FROM orders ORDER BY created_at DESC LIMIT 5;'
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml exec postgres psql -U admin -d ecommerce_payment -c 'SELECT id, order_id, status, payment_method, amount FROM payments ORDER BY created_at DESC LIMIT 5;'
```

### Kết nối database từ trong network compose

Nếu bạn đang debug bằng container tạm trong cùng network, host Postgres là `postgres`, port là `5432`, user/password lấy từ `.env.local`.

Ví dụ connection string theo kiểu service nội bộ:

```text
postgres://admin:<POSTGRES_PASSWORD>@postgres:5432/ecommerce_user?sslmode=disable
```

Lưu ý:

- healthcheck của container Postgres hiện chỉ kiểm tra database `ecommerce`, không kiểm tra riêng schema của từng service
- dữ liệu nghiệp vụ thật nằm ở `ecommerce_user`, `ecommerce_product`, `ecommerce_order`, `ecommerce_payment`

## 8. Migration và seed

Trạng thái hiện tại:

- `user-service`, `product-service`, `order-service`, `payment-service` auto-run migration khi startup
- `cart-service` không có migration SQL vì dùng Redis
- không có thư mục `seed/` hoặc `seeds/` riêng cho business data
- bootstrap dữ liệu dev rõ nhất nằm ở `user-service` với account `admin` và `staff`

Chạy migration thủ công từ host:

```bash
make migrate-up
make migrate-down
make migrate-force
```

Nhưng nhớ rằng:

- các lệnh trên mặc định nhắm tới `localhost:5432`
- compose hiện không expose Postgres ra host
- trong flow compose mặc định, thường không cần chạy tay vì service tự apply migration rồi

Nếu bạn thật sự muốn dùng `make migrate-up` với database compose, bạn cần tự publish cổng Postgres hoặc chạy lệnh migrate từ một môi trường có thể chạm `postgres:5432`.

## 9. Service nào là frontend, backend và service phụ trợ

Phân loại đúng theo source hiện tại:

- Frontend chính: `frontend`
- Frontend experimental: `client` (không nằm trong compose mặc định)
- Backend entrypoint HTTP: `api-gateway`
- Backend domain services: `user-service`, `product-service`, `cart-service`, `order-service`, `payment-service`
- Async worker: `notification-service`
- Database/cache/broker/search/object storage/observability: `postgres`, `redis`, `rabbitmq`, `elasticsearch`, `minio`, `prometheus`, `grafana`, `jaeger`

Nếu cần tự xác định từ source:

- xem `Dockerfile`
- xem `cmd/main.go`
- xem `deployments/docker/config/*.yaml`
- xem route trong `api-gateway/internal/handler`

## 10. Lỗi thường gặp và cách xử lý

### Không vào được frontend khi mở `http://localhost`

Nguyên nhân:

- cổng `80` đang là `nginx` edge và config hiện tại chỉ route `/api/*` với `/health`

Cách đúng:

- mở `http://localhost:4173` cho frontend Docker
- hoặc chạy `make frontend-dev` để dùng Vite ở `http://localhost:5174`

### Frontend gọi API lỗi dù gateway vẫn sống

Kiểm tra:

```bash
curl http://localhost:8080/health
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml logs -f api-gateway
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml logs -f frontend
```

Nhớ rằng:

- frontend Docker dựa vào `frontend/nginx.conf` để proxy `/api`
- Vite dev dựa vào `frontend/vite.config.ts` để proxy `/api`

### OAuth hoặc link email trả người dùng về sai cổng

Nguyên nhân thường gặp:

- `FRONTEND_BASE_URL` không khớp với mode frontend đang dùng

Cách xử lý:

- nếu dùng Vite dev, đặt `FRONTEND_BASE_URL=http://localhost:5174`
- nếu dùng frontend Docker, đặt `FRONTEND_BASE_URL=http://localhost:4173`
- restart `user-service` sau khi đổi env/config

### Không kết nối được Postgres bằng `localhost:5432`

Nguyên nhân:

- compose không publish cổng Postgres ra host

Cách xử lý:

- dùng `docker compose exec postgres psql ...`
- hoặc sửa compose để publish `5432`

### Không `exec sh` được vào service Go

Nguyên nhân:

- image runtime đang là distroless

Cách xử lý:

- dùng `docker logs`, `docker inspect`
- hoặc dùng sidecar container trên network `ecommerce-network` để probe HTTP/gRPC

### Không mở được Grafana hoặc Prometheus từ host

Nguyên nhân:

- compose hiện không map cổng `3000` và `9090`

Cách xử lý:

- truy cập bằng container cùng network nếu chỉ cần probe nội bộ
- hoặc thêm port mapping vào compose rồi recreate stack

### Muốn làm sạch dữ liệu local hoàn toàn

Lệnh mạnh tay:

```bash
docker compose --env-file .env.local -f deployments/docker/docker-compose.yml down -v
```

Lưu ý:

- lệnh này xóa volume dữ liệu đang gắn với stack
- cần chạy lại `up --build`
- migrations sẽ được service tự apply lại khi startup
