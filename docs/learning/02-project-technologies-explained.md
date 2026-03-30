# 02. Công nghệ trong project và lý thuyết cần biết

Tài liệu này giải thích "tại sao project dùng công nghệ này" và "bạn cần hiểu đến mức nào để đọc source".

## 1. Echo

### Echo là gì?

Echo là HTTP framework cho Go.

### Trong project này dùng để làm gì?

- khai báo route,
- gắn middleware,
- bind request JSON,
- trả response JSON.

### Bạn cần hiểu tới đâu?

- `e.Group(...)`
- middleware chain
- `c.Bind(...)`
- `c.Validate(...)`
- `c.JSON(...)`

## 2. PostgreSQL

### PostgreSQL là gì?

Relational database mạnh, hỗ trợ transaction tốt, phù hợp dữ liệu nghiệp vụ.

### Vì sao project dùng PostgreSQL?

Vì các domain như:

- user,
- product,
- order,
- payment

đều cần dữ liệu nhất quán và query rõ ràng.

### Bạn cần hiểu tới đâu?

- table, row, column
- primary key
- unique constraint
- foreign-key mindset
- transaction
- index

### Trong source hãy để ý

- migration SQL
- repository query
- transaction ở order repository
- unique `order_id` trong payment

## 3. Redis

### Redis là gì?

In-memory key-value store, cực nhanh.

### Vì sao project dùng Redis cho cart?

Vì cart là dữ liệu:

- truy cập nhiều,
- thay đổi nhanh,
- không phải source of truth cuối cùng.

### Bạn cần hiểu tới đâu?

- key-value
- serialize object
- TTL là gì
- tại sao dữ liệu tạm hợp với Redis hơn PostgreSQL

## 4. gRPC và Protocol Buffers

### gRPC là gì?

Framework gọi RPC hiệu năng cao, thường dùng cho service-to-service communication.

### Proto là gì?

File `.proto` định nghĩa contract:

- message
- service
- rpc method

### Vì sao project dùng gRPC?

Vì `order-service` và `cart-service` cần lấy product thật một cách rõ contract và type-safe.

### Bạn cần hiểu tới đâu?

- `.proto` định nghĩa request/response ra sao
- file generated `.pb.go` là gì
- client gọi gRPC như thế nào
- khác gì với HTTP JSON

## 5. RabbitMQ

### RabbitMQ là gì?

Message broker dùng để truyền event bất đồng bộ.

### Trong project dùng thế nào?

- order/payment publish event
- notification-service consume event

### Bạn cần hiểu tới đâu?

- exchange
- queue
- routing key
- consumer
- ack / nack
- prefetch / QoS

### Tại sao không gọi notification trực tiếp?

Vì notification là side effect. Nếu nhét nó vào request chính:

- request chậm hơn,
- coupling cao hơn,
- khó mở rộng hơn.

## 6. JWT

### JWT là gì?

Token được ký, chứa claim về user.

### Trong project dùng thế nào?

- user-service tạo JWT
- các service khác verify JWT
- claims được dùng để lấy `user_id`, `role`

### Bạn cần hiểu tới đâu?

- signature
- expiry
- claims
- auth vs authorization

## 7. Bcrypt

### Bcrypt là gì?

Thuật toán hash password có salt, chậm có chủ đích.

### Tại sao không dùng SHA256 cho password?

Vì SHA256 quá nhanh, dễ brute-force hơn trong ngữ cảnh password.

## 8. Viper

### Viper là gì?

Thư viện load config cho Go.

### Trong project dùng thế nào?

- load YAML
- load env
- set default

### Bạn cần hiểu tới đâu?

- config không nên hard-code
- mỗi service nên có config riêng
- env/file/default có thứ tự ưu tiên

## 9. Docker Compose

### Docker Compose là gì?

Công cụ dựng nhiều container cùng lúc.

### Trong project dùng thế nào?

- chạy database
- chạy Redis
- chạy RabbitMQ
- chạy toàn bộ microservices
- chạy frontend

### Bạn cần hiểu tới đâu?

- service
- image
- build
- environment
- ports
- volumes
- networks
- healthcheck

## 10. Prometheus, Grafana, Jaeger

### Vì sao có observability?

Khi hệ thống có nhiều service, bạn cần biết:

- request nào lỗi,
- service nào chậm,
- event nào không đi qua,
- dependency nào đang nghẽn.

### Ý nghĩa từng công cụ

- Prometheus: thu metrics
- Grafana: visualize metrics
- Jaeger: tracing request qua nhiều service

## 11. React + Vite

### Trong project dùng để làm gì?

`frontend/` là UI local chính hiện tại của repo.

Nó dùng:

- React
- TypeScript
- Vite
- React Router

### Bạn cần hiểu tới đâu?

- component function
- `useState`, `useEffect`, `useMemo`
- provider/context
- React Router route tree
- Vite dev server và preview mode

### Điểm đáng học trong repo này

- tách `app/`, `routes/`, `features/`, `shared/`
- dùng API layer + normalizer thay vì `fetch` rải khắp component
- giữ compatibility layer để refactor dần

## 12. TypeScript

### Vì sao quan trọng ở repo này?

TypeScript giúp frontend:

- mô tả contract dữ liệu từ backend
- phát hiện sớm mismatch ở UI
- giữ code refactorable hơn khi app lớn

### Bạn nên chú ý gì?

- `shared/types/api.ts` là hợp đồng type chính ở frontend React + Vite
- `client/src/types/api.ts` là hợp đồng type phía Next experimental

## 13. React Router

### Trong project này dùng thế nào?

Route tree của frontend chính nằm ở:

- `frontend/src/app/App.tsx`

### Bạn cần hiểu tới đâu?

- route nesting
- redirect
- route guard
- `Outlet`
- `location.state`

### Vì sao đáng học?

Nó cho bạn thấy cách app tách:

- public/auth route
- storefront route
- account protected route
- admin route

## 14. Browser Storage

### Trong project dùng ở đâu?

- auth token/session storage
- remembered identifier
- pending OAuth remember state
- guest cart storage

### Vì sao nên hiểu?

Vì frontend của repo này có hai capability rất đáng học:

- session với remember me
- guest cart merge sau khi login

Nếu không hiểu `localStorage` và `sessionStorage`, bạn sẽ khó theo kịp hai flow này.

## 15. Normalizer và API Boundary

### Vì sao repo dùng normalizer?

Thay vì để page nhận raw JSON từ backend, repo dùng:

- `http-client`
- `api modules`
- `normalizers`
- `shared types`

### Bạn cần hiểu tới đâu?

- dữ liệu vào UI không nhất thiết phải giữ nguyên shape backend
- normalizer là lớp phòng thủ quan trọng
- compatibility layer giúp refactor an toàn

## 16. Next.js App Router

### Trong project dùng ở đâu?

Trong nhánh `client/` experimental.

### Vì sao vẫn đáng học dù chưa là runtime chính?

- cho bạn thấy một chiến lược frontend khác với React Router
- có import alias `@/*` sạch hơn
- có `WishlistProvider` để học thêm pattern state domain

### Bạn cần hiểu tới đâu?

- `app/` routing
- layout gốc
- provider tree
- sự khác nhau giữa nhánh experimental và runtime chính `frontend/`

### Với người học, cần hiểu gì?

Không cần master ngay từ đầu, nhưng nên biết:

- log chưa đủ cho hệ thống phân tán,
- metrics giúp nhìn xu hướng,
- tracing giúp thấy request đi qua đâu.

## 11. Khi nào nên dùng công nghệ nào?

### PostgreSQL

Dùng khi dữ liệu cần:

- transaction,
- consistency,
- query phức tạp.

### Redis

Dùng khi dữ liệu cần:

- tốc độ cao,
- đơn giản,
- state tạm thời.

### gRPC

Dùng khi:

- service nội bộ cần contract rõ,
- cần type-safe,
- gọi thường xuyên.

### RabbitMQ

Dùng khi:

- side effect không cần block request,
- cần bất đồng bộ,
- cần fan-out event.

## 12. Kết luận học tập

Đừng học công nghệ theo kiểu "thuộc định nghĩa". Hãy học theo 3 câu hỏi:

1. Công nghệ này giải quyết vấn đề gì?
2. Tại sao project này chọn nó?
3. Nếu bỏ nó đi thì kiến trúc sẽ yếu ở chỗ nào?

Nếu bạn trả lời được 3 câu đó cho từng công nghệ, bạn đã hiểu project ở mức rất tốt.
