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
| `client` | storefront/account runtime Next.js mặc định | `http://localhost:3000` |
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

- shopper UI mặc định trong compose là `http://localhost:3000`
- admin/workbook UI mặc định trong compose là `http://localhost:4173`
- `http://localhost` không phải storefront chính
- Postgres, Redis, RabbitMQ không publish port ra host theo mặc định

---

## 2. Client Next.js Đang Chạy Mặc Định Ra Sao

`client/` hiện là storefront/account runtime mặc định trong Compose, không còn là profile tùy chọn như trước.

Trạng thái runtime đúng theo `deployments/docker/docker-compose.yml`:

- `client` chạy mặc định ở `http://localhost:3000`
- `frontend` vẫn chạy song song ở `http://localhost:4173` cho admin/workbook/local verification
- `nginx` ở `http://localhost` vẫn chỉ proxy `/api` và `/health`, không serve shopper UI

Điều đó có nghĩa:

- shopper/account flow nên được verify trước trên `3000`
- admin/workbook flow nên được verify trên `4173`
- khi debug API riêng, vẫn gọi trực tiếp `http://localhost:8080`

Luồng network quan trọng:

- browser-side fetch của `client` dùng `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080`
- server-side fetch của `client` dùng `API_GATEWAY_URL=http://api-gateway:8080`
- `frontend` Docker static build vẫn tự proxy `/api` về gateway qua nginx trong image của nó

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
| `http://localhost:3000` | client Next.js mặc định trong Compose |
| `http://localhost:4173` | frontend Docker cho admin/workbook |
| `http://localhost:5174` | frontend Vite dev trên host |
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

Sai. `localhost:80` hiện chỉ là edge proxy cho `/api` và `/health`. Shopper UI mặc định trong compose là:

```text
http://localhost:3000
```

### "client đã là runtime mặc định"

Đúng. `client` hiện là shopper/account runtime mặc định trong compose, còn `frontend` giữ vai trò admin/workbook song song.

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

---

## 14. Runtime Truth Matrix

Khi local stack đang chạy, hãy coi đây là bảng sự thật để tránh debug nhầm process:

| Bề mặt | URL | Process thật đang trả response |
| --- | --- | --- |
| Shopper storefront/account | `http://localhost:3000` | `client` |
| Admin/workbook local UI | `http://localhost:4173` | `frontend` |
| Public API | `http://localhost:8080` | `api-gateway` |
| Edge `/api` và `/health` | `http://localhost` | `nginx` -> `api-gateway` |
| Tracing UI | `http://localhost:16686` | `jaeger` |
| Object storage console | `http://localhost:9001` | `minio` |

Nếu UI và API cùng lỗi, nhìn `api-gateway` trước.

Nếu shopper lỗi nhưng admin vẫn ổn:

- nhìn `client`
- rồi kiểm tra `NEXT_PUBLIC_API_BASE_URL`, `API_GATEWAY_URL`

Nếu admin lỗi nhưng shopper vẫn ổn:

- nhìn `frontend`
- rồi kiểm tra build static, nginx trong image và proxy `/api`

## 15. Playbook Debug Theo Triệu Chứng

### Shopper `3000` lên trang trắng hoặc lỗi fetch

Kiểm tra theo thứ tự:

1. `docker compose ... logs -f client`
2. `curl http://localhost:3000`
3. `curl http://localhost:8080/health`
4. inspect env của container `client`
5. kiểm tra `NEXT_PUBLIC_API_BASE_URL` và `API_GATEWAY_URL`

### Admin `4173` lên nhưng API fail hoặc bị 401/403

Kiểm tra theo thứ tự:

1. `curl http://localhost:4173/health`
2. `docker compose ... logs -f frontend api-gateway`
3. xem token, cookie, `Authorization` header ở browser devtools
4. kiểm tra `FRONTEND_BASE_URL` nếu flow lỗi ở OAuth/email link

### Gateway sống nhưng một domain API trả 502/timeout

Kiểm tra theo thứ tự:

1. log `api-gateway`
2. log service upstream tương ứng
3. probe nội bộ service đó trên `ecommerce-network`
4. kiểm tra config YAML mount của service
5. nếu nghi DB, vào `postgres` để xem migration/data

### Tạo order được nhưng payment/webhook không cập nhật

Kiểm tra theo thứ tự:

1. log `payment-service`
2. log `order-service`
3. kiểm tra route `/api/v1/payments/webhooks/momo`
4. kiểm tra record `payments`, `outbox_events`, `inbox_messages`
5. dùng Jaeger để xem trace qua gateway -> payment -> order

### Return đã queue refund nhưng mãi không hoàn tất

Kiểm tra theo thứ tự:

1. log `order-service` refund worker
2. log `payment-service`
3. bảng `returns`:
   - `refund_attempt_count`
   - `refund_last_error`
   - `refund_next_retry_at`
   - `refund_processing_started_at`
4. bảng `outbox_events`
5. nếu nghi auth nội bộ, kiểm tra service JWT giữa order và payment

### Notification không gửi hoặc gửi lặp

Kiểm tra theo thứ tự:

1. log `notification-service`
2. `rabbitmqctl list_queues`
3. Redis claim state nếu nghi dedupe
4. route/user preference source ở `user-service`
5. retry queue headers và DLQ nếu flow đã đi xa tới broker
