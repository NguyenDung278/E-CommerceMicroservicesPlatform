# Hướng dẫn gỡ lỗi

Khi chạy hệ thống nhiều service qua Docker Compose, debug tốt không phải là “nhảy thẳng vào một container rồi đoán”, mà là biết chọn đúng công cụ cho từng lớp: log, health, trace, database, message broker và config.

## 1. Bắt đầu từ log

Log là công cụ đầu tiên nên mở. Repo dùng structured logging với `zap`, nên log thường đủ thông tin để khoanh vùng service và lỗi.

### Xem log toàn stack

```bash
cd deployments/docker
docker compose --env-file ../../.env.local logs -f
```

### Xem log một service cụ thể

```bash
cd deployments/docker
docker compose --env-file ../../.env.local logs -f order-service
```

### Nên tìm gì trong log

- `level=error` hoặc `"level":"error"`
- HTTP status `500`, `401`, `403`, `409`
- route/path đang xử lý
- downstream service hoặc dependency đang lỗi

## 2. Bắt đầu debug từ entrypoint trước

Compose hiện publish ra host:

- `http://localhost:8080` -> `api-gateway`
- `http://localhost:80` -> `nginx`
- `http://localhost:4173` -> `frontend`

### Health nhanh

```bash
curl http://localhost:8080/health
curl http://localhost/health
```

Nếu hai lệnh này fail, đừng nhảy vào bug business logic ngay. Hãy quay lại kiểm tra:

- container có đang chạy không
- env file có đúng không
- gateway có đang lỗi boot không

## 3. Dùng `docker compose ps` thay cho giả định port

Nhiều service và hạ tầng nội bộ **không publish port ra host** mặc định, nên cách đúng để xem chúng sống hay không là:

```bash
cd deployments/docker
docker compose --env-file ../../.env.local ps
```

### Điều rất dễ nhầm

Bạn không thể mặc định `curl http://localhost:8081/health` hay `http://localhost:9090` sẽ luôn chạy, vì compose hiện tại không publish các cổng đó.

## 4. Debug database và hạ tầng bằng CLI thật

### PostgreSQL

```bash
cd deployments/docker
docker compose --env-file ../../.env.local exec postgres pg_isready -U admin
```

```bash
cd deployments/docker
docker compose --env-file ../../.env.local exec postgres \
  psql -U admin -d ecommerce_user -c '\dt'
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

### Vì sao cách này đáng tin

Bạn đang nói chuyện trực tiếp với dependency thật thay vì suy đoán từ symptom bên trên.

## 5. Jaeger: công cụ rất mạnh khi request đi qua nhiều service

Jaeger UI:

```text
http://localhost:16686
```

### Khi nào nên mở Jaeger ngay

- gateway trả `500` nhưng chưa rõ service nào lỗi
- checkout/payment chạm nhiều boundary
- request chậm bất thường

### Cách đọc trace

1. chọn service `api-gateway`
2. tìm trace theo timeframe gần nhất
3. xem span nào đỏ hoặc lâu bất thường
4. mở tags/logs của span đó để xem downstream dependency nào lỗi

## 6. Lỗi migration / schema

Một lỗi rất phổ biến:

- log báo table không tồn tại
- query fail ngay sau startup

### Điều cần nhớ

Mỗi service có migration riêng trong:

- `services/user-service/migrations/`
- `services/product-service/migrations/`
- `services/order-service/migrations/`
- `services/payment-service/migrations/`

Các service thường tự chạy migration ở startup. Nhưng nếu bạn chạy migration từ host bằng `make migrate-up`, hãy nhớ:

- target này mặc định trỏ tới `localhost:5432`
- compose hiện không publish Postgres ra host

Nếu cần dùng `make migrate-up`, bạn phải tự mở đường host đến Postgres.

## 7. Debug một Go service đang chạy trong Compose

### Điều rất quan trọng

Nhiều container Go service trong repo dùng distroless runtime. Nghĩa là:

- thường không có `sh`
- không phù hợp với kiểu `docker compose exec user-service sh`

### Thay vào đó, ưu tiên

- `docker compose logs <service>`
- `docker inspect <container>`
- test qua gateway
- chạy unit/integration test ở host

## 8. Nếu muốn debug bằng breakpoint local

Bạn có thể chạy một service trên host bằng IDE, nhưng cần hiểu rõ dependency của nó.

### Vấn đề hiện tại

Compose mặc định **không publish**:

- Postgres
- Redis
- RabbitMQ

Nên nếu muốn chạy một service trên host và vẫn dùng hạ tầng trong Docker, bạn có hai lựa chọn thực tế:

1. tạm mở port cho dependency cần thiết trong compose local/override
2. hoặc tạm chạy chính service đó trong Compose rồi debug qua logs/tests thay vì breakpoint

### Đừng làm sai kiểu này

- sửa config service thành `localhost` nhưng dependency chưa publish ra host
- rồi kết luận service “không chạy được bằng IDE”

Thực ra vấn đề nằm ở network exposure, không phải ở code.

## 9. Dùng `curl` hoặc frontend để thu hẹp phạm vi

### Khi nào dùng `curl`

- muốn kiểm tra contract backend thẳng qua gateway
- muốn tách bug UI khỏi bug backend

### Khi nào dùng frontend

- bug liên quan provider state, routing, form validation, redirect
- guest cart / authenticated cart merge
- account/admin UI behavior

Nguyên tắc:

- nếu chưa rõ bug nằm ở UI hay backend, hãy thử `curl` gateway trước
- nếu `curl` đúng mà UI sai, trace tiếp `page -> hook/provider -> API layer`

## 10. Checklist debug nhanh theo triệu chứng

### `401` hoặc bị đá về login

- kiểm tra token trong storage
- kiểm tra `AuthProvider` bootstrap
- kiểm tra refresh token flow

### Cart sai giá hoặc stock

- trace `CartProvider`
- kiểm tra `productApi.getProductById`
- xem log `cart-service` và `product-service`

### Checkout lỗi

- xem trace trong Jaeger
- xem log `order-service` và `payment-service`
- kiểm tra product lookup và payment creation

### Admin page lỗi một phần

- xác minh role hiện tại là `admin` hay `staff`
- kiểm tra endpoint admin nào đang gọi
- đối chiếu route thật ở gateway/backend

## 11. Mẹo nghề nghiệp

Debug tốt là biết hỏi đúng theo thứ tự:

1. runtime có đang sống không
2. request có đi đúng đường không
3. dependency nào là source of truth
4. contract có lệch giữa frontend và backend không
5. lỗi nằm ở code mới hay do env/runtime

Nếu đi theo thứ tự này, bạn sẽ nhanh hơn rất nhiều so với kiểu “mở file bất kỳ rồi đoán”.
