# Technology Stack

Tài liệu này giải thích công nghệ repo đang dùng và vai trò của từng thành phần trong bức tranh tổng thể.

## 1. Bảng tóm tắt

| Thành phần | Công nghệ | Vai trò trong repo | Vì sao dùng |
| --- | --- | --- | --- |
| Backend HTTP | Go + Echo | API cho gateway và service | đơn giản, nhanh, ít magic |
| RPC nội bộ | gRPC | lookup product từ cart/order | contract rõ, hiệu năng tốt |
| Database chính | PostgreSQL | user, product, order, payment | source of truth ổn định |
| Cache/state ngắn hạn | Redis | cart, rate limit | thao tác nhanh, key-value phù hợp |
| Event broker | RabbitMQ | notification flow | tách side effect khỏi request path |
| Object storage | MinIO | ảnh sản phẩm | phù hợp local Docker, S3-like |
| Search | Elasticsearch | catalog search/filter nâng cao | hỗ trợ query catalog tốt hơn DB thuần |
| Metrics | Prometheus | scrape metrics từ service | tiêu chuẩn phổ biến cho monitoring |
| Dashboard | Grafana | trực quan hóa metrics | xem hệ thống local nhanh |
| Tracing | Jaeger | trace request qua nhiều service | giúp debug flow phân tán |
| Frontend | React + Vite + TypeScript | UI demo và test flow | nhanh, đơn giản, DX tốt |

## 2. Các quyết định stack đáng chú ý

### Echo thay vì framework nặng hơn

Repo dùng Echo vì:

- routing và middleware rõ ràng
- dễ gắn Prometheus, auth, validation
- ít abstraction hơn nhiều framework lớn

### PostgreSQL là trung tâm

Mặc dù repo có nhiều thành phần infra, business state cốt lõi vẫn nằm ở PostgreSQL. Đây là quyết định đúng vì:

- transaction rõ ràng
- schema có migration
- phù hợp cho order/payment/user/product

### Redis chỉ dùng cho bài toán cụ thể

Redis không bị lạm dụng làm database chung. Hiện tại nó chủ yếu phục vụ:

- cart state
- rate limiter

Đây là cách dùng hợp lý vì dữ liệu cart có tính session-like hơn là long-lived transaction record.

### RabbitMQ cho side effect, không cho mọi thứ

RabbitMQ hiện chủ yếu phục vụ notification flow. Điều này giữ cho:

- request chính ít bị chậm bởi email
- service consumer có thể retry độc lập

Nhưng order và payment core state vẫn commit vào PostgreSQL trước.

### Elasticsearch là dependency phụ

Catalog search nâng cao dùng Elasticsearch, nhưng code đã được viết để fallback về PostgreSQL khi search backend lỗi. Điều đó cho thấy:

- ES không phải nguồn dữ liệu chính
- search là feature tăng cường, không phải dependency sống còn

## 3. Best practices hiện diện trong repo

- shared config và middleware qua `pkg/`
- graceful shutdown ở service entrypoint
- embedded migrations theo từng service
- health check và metrics cho hầu hết service
- rate limit tầng HTTP
- role-based authorization bằng JWT claims
- observability hooks thống nhất

## 4. Trade-off của stack hiện tại

Ưu điểm:

- mô hình học tập tốt cho microservices
- thể hiện nhiều kiểu giao tiếp thực tế: HTTP, gRPC, event
- local environment tương đối đầy đủ

Chi phí:

- onboarding lâu hơn một modular monolith
- local stack nặng hơn vì có nhiều dependency
- cần hiểu rõ source of truth để tránh sửa sai chỗ

## 5. Cần đọc tiếp ở đâu

- Muốn hiểu runtime flow: [system-overview.md](./system-overview.md)
- Muốn hiểu source: [../annotated/README.md](../annotated/README.md)
- Muốn setup và verify local: [../learning/00-local-setup.md](../learning/00-local-setup.md)
