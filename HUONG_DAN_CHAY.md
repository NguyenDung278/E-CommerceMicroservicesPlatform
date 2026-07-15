# HUONG_DAN_CHAY — Chạy source code từ đầu

Hướng dẫn end-to-end để dựng toàn bộ hệ thống trên máy local: backend (Docker Compose) + frontend (Vite dev server). Chi tiết sâu hơn xem [DOCKER_GUIDE.md](./DOCKER_GUIDE.md) (runtime/debug container) và [API_TESTING_GUIDE.md](./API_TESTING_GUIDE.md) (test API).

## 1. Yêu cầu môi trường

| Công cụ | Phiên bản | Bắt buộc khi |
| --- | --- | --- |
| Docker Desktop (hoặc Docker Engine + Compose plugin) | mới nhất | Chạy backend stack |
| Go | ≥ 1.25 | Chạy test/build backend ngoài container (`make ci`) |
| Node.js + npm | Node ≥ 20 | Chạy frontend `client/` |
| make | có sẵn trên macOS/Linux | Mọi lệnh bên dưới chạy từ root repo |

## 2. Chuẩn bị biến môi trường

```bash
cp .env.local.example .env.local
```

Mở `.env.local` và đổi tối thiểu các giá trị sau (stack vẫn chạy được với SMTP/OAuth/Telegram để trống, các tính năng tương ứng sẽ tắt):

- `POSTGRES_PASSWORD`, `RABBITMQ_PASSWORD` — mật khẩu hạ tầng local.
- `JWT_SECRET` — chuỗi ngẫu nhiên ≥ 32 ký tự (user-service fail fast nếu thiếu).
- `SMTP_*` — chỉ cần khi muốn gửi email thật (verification, notification).
- `OAUTH_GOOGLE_*` — chỉ cần khi test đăng nhập Google.
- `TELEGRAM_*` — chỉ cần khi test OTP đổi số điện thoại.

## 3. Dựng backend bằng Docker Compose

```bash
make docker-config   # render deployments/docker/docker-compose.yml từ .env.local
make compose-up      # build + up toàn stack (Postgres, Redis, RabbitMQ, các service, gateway, Nginx)
```

Migration SQL tự chạy khi từng service startup — không cần bước migrate thủ công cho lần chạy đầu. (`make migrate-up` / `migrate-down` / `migrate-force` chỉ dùng khi cần can thiệp tay.)

Smoke check sau khi stack lên:

```bash
curl http://localhost:8080/health   # API Gateway
curl http://localhost/health        # Nginx edge
```

URL thường dùng:

- `http://localhost:8080` — API Gateway (mọi test API public đi qua đây)
- `http://localhost` — Nginx edge (`/api/*`, `/health`)
- `http://localhost:9001` — MinIO Console, `http://localhost:9200` — Elasticsearch, `http://localhost:16686` — Jaeger

Lưu ý: PostgreSQL / Redis / RabbitMQ / Prometheus / Grafana **không** publish port ra host mặc định — truy cập qua `docker compose exec` (xem DOCKER_GUIDE.md).

Tắt stack:

```bash
make compose-down
```

## 4. Chạy frontend

```bash
make client-install   # hoặc: cd client && npm install
make client-dev       # Vite dev server tại http://localhost:3000
```

Dev server đã proxy sẵn `/api` và `/health` sang `http://localhost:8080` (xem `client/vite.config.ts`), nên **không cần** set `VITE_API_BASE_URL` khi dev. Chỉ khi build production trỏ tới API khác origin mới cần:

```bash
cd client && cp .env.example .env.local   # điền VITE_API_BASE_URL nếu cần
```

Tài khoản test local: khi `user-service` bật `bootstrap.dev_accounts.enabled`, xem mục "Tài Khoản Test Local" trong [README.md](./README.md).

## 5. Chạy test / lint

Backend (mỗi service là một Go module riêng — phải `cd` vào module khi test lẻ):

```bash
make ci                                   # fmt + tidy + vet + test toàn bộ module — chạy trước khi coi PR là "ổn"
cd services/order-service && go test ./...                                        # 1 service
cd services/order-service && go test ./internal/handler/ -run TestCreateOrder -v # 1 test
```

Frontend:

```bash
cd client && npm run lint    # eslint
cd client && npm run build   # tsc -b && vite build
```

## 6. Môi trường dev / production

Hệ thống phân biệt môi trường qua biến `APP_ENV` (`development` mặc định | `staging` | `production`), đi từ env file → Docker Compose → `pkg/config`.

**Development** (mặc định): mọi secret có default an toàn cho local, chạy như mục 2–4.

**Production**: dùng env file riêng và bị kiểm tra nghiêm khi startup:

```bash
cp .env.production.example .env.production   # điền TOÀN BỘ secret (không commit)
make docker-config-prod                       # render compose với .env.production
make compose-up-prod                          # dựng stack production
```

Với `APP_ENV=production`, mỗi service **từ chối khởi động** nếu còn secret mặc định/yếu (xem `validateProductionSecrets` trong [pkg/config/config.go](./pkg/config/config.go)): `JWT_SECRET` < 32 ký tự, password DB/RabbitMQ mặc định, webhook secret dev, pepper `change-me`, MinIO `minioadmin`, hay `BOOTSTRAP_DEV_ACCOUNTS_ENABLED=true`. CORS tự cho phép origin trong `FRONTEND_BASE_URL`.

Frontend theo Vite mode: `client/.env.development` (dev — để trống, dùng proxy) và `client/.env.production` (build — chỉ điền `VITE_API_BASE_URL` khi API khác origin; giá trị này nhúng vào bundle công khai, không đặt secret).

## 7. Lỗi thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
| --- | --- |
| Service exit ngay khi start, log báo thiếu secret | Thiếu `JWT_SECRET` hoặc mật khẩu trong `.env.local` — service cố ý fail fast. Điền giá trị rồi `make compose-up` lại. |
| `curl :8080/health` không phản hồi | Stack chưa lên xong hoặc port bận. Xem log: `docker compose --env-file .env.local -f deployments/docker/docker-compose.yml logs -f api-gateway` |
| Sửa `.env.local` nhưng không có tác dụng | Phải chạy lại `make docker-config` trước khi `make compose-up`. |
| `go test` từ root không thấy code | Repo không dùng go.work — phải `cd` vào từng module (xem mục 5). |
| Frontend gọi API bị CORS/404 | Đảm bảo chạy qua `make client-dev` (proxy sẵn) và backend đang chạy ở `:8080`. |
| Migration hỏng giữa chừng | `make migrate-force` để ép version, xem thêm DOCKER_GUIDE.md. |

## 8. Đọc gì tiếp theo

- [README.md](./README.md) — kiến trúc tổng quan, bảng "Hot Path Khi Audit Issue".
- [LOGIC_FLOW.md](./LOGIC_FLOW.md) — flow end-to-end từ API xuống worker.
- [AGENTS.md](./AGENTS.md) — bộ rule kiến trúc/code bắt buộc trước khi sửa backend.
- [docs/README.md](./docs/README.md) — bản đồ tài liệu (annotated source map, deep-dive, learning roadmap).
