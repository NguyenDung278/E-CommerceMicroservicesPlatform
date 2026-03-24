# Phân Tích Source Code Dự Án E-Commerce Platform

## Mục lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Cấu trúc source code](#2-cấu-trúc-source-code)
3. [Công nghệ, framework và thư viện](#3-công-nghệ-framework-và-thư-viện)
4. [Lý do chọn công nghệ và ưu điểm](#4-lý-do-chọn-công-nghệ-và-ưu-điểm)
5. [Cách các thành phần tương tác và luồng hoạt động](#5-cách-các-thành-phần-tương-tác-và-luồng-hoạt-động)

---

## 1. Tổng quan dự án

Dự án E-Commerce Platform là một nền tảng thương mại điện tử được xây dựng theo kiến trúc **Microservices** với mục tiêu chính là giúp developer mới hiểu cách một hệ thống thương mại điện tử được tách thành nhiều service, cách các service giao tiếp với nhau, và cách đọc source code có phương pháp.

Dự án bao gồm:

- **Backend**: Go microservices với Echo framework và gRPC
- **Frontend**: React + Vite + TypeScript
- **Database**: PostgreSQL (primary data), Redis (caching/sessions)
- **Message Queue**: RabbitMQ
- **Object Storage**: MinIO (cho hình ảnh sản phẩm)
- **Search**: Elasticsearch (cho tìm kiếm nâng cao)
- **Observability**: Prometheus, Grafana, Jaeger

---

## 2. Cấu trúc source code

### 2.1. Cấu trúc thư mục chính

```
ecommerce-platform/
├── api-gateway/          # API Gateway - điểm vào chung cho mọi request
├── services/             # Các microservices
│   ├── user-service/     # Quản lý người dùng, đăng ký, đăng nhập, JWT
│   ├── product-service/  # Quản lý sản phẩm, catalog, tìm kiếm
│   ├── cart-service/     # Quản lý giỏ hàng trên Redis
│   ├── order-service/    # Quản lý đơn hàng, coupon, shipping
│   ├── payment-service/  # Quản lý thanh toán, webhook, refund
│   └── notification-service/ # Gửi email qua RabbitMQ
├── pkg/                  # Thư viện dùng chung (shared packages)
├── client/                # Ứng dụng Next.js mới (MCP/Stitch-driven UI)
├── frontend/              # Ứng dụng React + Vite (legacy)
├── deployments/          # Cấu hình Docker và Kubernetes
├── proto/                # Định nghĩa gRPC proto files
└── docs/                 # Tài liệu dự án
```

### 2.2. Chi tiết từng thành phần

#### 2.2.1. API Gateway (`api-gateway/`)

API Gateway đóng vai trò là điểm vào duy nhất cho tất cả các request từ frontend. Nó sử dụng **Echo framework** để xử lý HTTP requests và chuyển tiếp (proxy) các requests đến các microservices tương ứng.

**Cấu trúc file:**

- `cmd/main.go`: Điểm khởi động của service, thiết lập logging, tracing, rate limiting
- `internal/handler/`: Các handlers cho từng service (user, product, cart, order, payment)
- `internal/proxy/`: Logic proxy để chuyển tiếp requests đến backend services

**Tính năng chính:**

- Rate limiting với Redis backend
- CORS middleware cho frontend
- Structured logging với Zap
- Distributed tracing với OpenTelemetry/Jaeger
- Prometheus metrics

#### 2.2.2. User Service (`services/user-service/`)

Service này quản lý tất cả các chức năng liên quan đến người dùng:

- Đăng ký tài khoản (registration)
- Đăng nhập (login) với bảo vệ brute-force
- Quản lý profile người dùng
- Quản lý địa chỉ giao hàng
- Xác thực email
- JWT token generation và validation

**Cấu trúc file:**

- `cmd/main.go`: Khởi động service, kết nối PostgreSQL, chạy migrations
- `internal/handler/`: HTTP handlers cho user operations
- `internal/service/`: Business logic (user service, auth recovery, dev account bootstrapper)
- `internal/repository/`: Database operations với PostgreSQL
- `internal/model/`: Data models (User, Address)
- `internal/dto/`: Data Transfer Objects
- `internal/grpc/`: gRPC server cho inter-service communication
- `migrations/`: Database migrations

#### 2.2.3. Product Service (`services/product-service/`)

Service quản lý sản phẩm và catalog:

- CRUD sản phẩm
- Tìm kiếm sản phẩm với Elasticsearch
- Upload hình ảnh sản phẩm lên MinIO
- gRPC server để các service khác truy vấn thông tin sản phẩm
- Jobs theo dõi tồn kho thấp

**Cấu trúc file:**

- `internal/handler/`: HTTP handlers và upload handlers
- `internal/service/`: Business logic
- `internal/repository/`: Database operations
- `internal/search/`: Tích hợp Elasticsearch
- `internal/storage/`: Tích hợp MinIO object storage
- `internal/grpc/`: gRPC server implementation

#### 2.2.4. Cart Service (`services/cart-service/`)

Service quản lý giỏ hàng:

- Lưu trữ giỏ hàng trên Redis để tăng tốc độ
- Đồng bộ giá và tồn kho qua gRPC với product-service
- Hỗ trợ cả người dùng đã đăng nhập và khách vãng lai

**Cấu trúc file:**

- `internal/handler/`: HTTP handlers
- `internal/service/`: Business logic
- `internal/repository/`: Redis operations
- `internal/grpc_client/`: gRPC client để gọi product-service

#### 2.2.5. Order Service (`services/order-service/`)

Service quản lý đơn hàng:

- Tạo đơn hàng (quote → order)
- Quản lý coupon và giảm giá
- Tính toán phí vận chuyển
- Audit log cho tất cả thay đổi
- Phát event sang RabbitMQ khi có thay đổi trạng thái

**Cấu trúc file:**

- `internal/handler/`: HTTP handlers
- `internal/service/`: Business logic và event publishing
- `internal/repository/`: Database operations
- `internal/grpc_client/`: gRPC client để gọi product-service
- `migrations/`: Database migrations

#### 2.2.6. Payment Service (`services/payment-service/`)

Service quản lý thanh toán:

- Quản lý lifecycle thanh toán (pending → processing → completed/failed)
- Xử lý webhook từ payment provider
- Hoàn tiền (refund)
- Audit log
- Phát event sang RabbitMQ

**Cấu trúc file:**

- `internal/handler/`: HTTP handlers
- `internal/service/`: Business logic
- `internal/repository/`: Database operations
- `internal/client/`: HTTP client để gọi order-service

#### 2.2.7. Notification Service (`services/notification-service/`)

Service xử lý gửi email:

- Consume messages từ RabbitMQ queue
- Gửi email xác nhận đơn hàng
- Gửi email thông báo thanh toán
- Gửi email khôi phục mật khẩu

**Cấu trúc file:**

- `cmd/main.go`: Khởi động RabbitMQ consumer
- `internal/handler/`: Event handlers
- `internal/email/`: Email sender implementation

#### 2.2.8. Shared Packages (`pkg/`)

Thư viện dùng chung cho tất cả các services:

- `config/`: Load cấu hình từ file YAML
- `database/`: Kết nối PostgreSQL và chạy migrations
- `logger/`: Structured logging với Uber Zap
- `middleware/`: Auth, CORS, logging, rate limiting
- `observability/`: OpenTelemetry tracing setup
- `response/`: Standard API response format
- `validation/`: Request validation

#### 2.2.9. Frontend Applications

Dự án có hai ứng dụng frontend:

**a) Client (`client/`) - Ứng dụng Next.js mới**

Ứng dụng Next.js 16.2.1 với React 19 cho giao diện MCP/Stitch-driven UI mới:

- `src/app/`: App Router pages
- `src/app/page.tsx`: Landing page cơ bản
- Hỗ trợ TypeScript, ESLint
- Mục tiêu: Thay thế hoàn toàn ứng dụng legacy

**b) Frontend (`frontend/`) - Ứng dụng React + Vite legacy**

Ứng dụng React + Vite + TypeScript cho phía client (đang được sử dụng):

- `src/App.tsx`: Main application component
- `src/main.tsx`: Entry point
- `src/components/`: Reusable UI components
- `src/pages/`: Page components (Login, Register, Cart, Checkout, etc.)
- `src/contexts/`: React contexts (AuthContext, CartContext)
- `src/hooks/`: Custom hooks (useAuth, useCart, useSessionToken)
- `src/lib/`: API clients và utilities
  - `lib/api/`: API modules (auth, user, product, cart, order, payment)
  - `lib/http/`: HTTP client với error handling
  - `lib/errors/`: Error handling utilities
  - `lib/normalizers/`: Data normalization functions
- `src/types/`: TypeScript type definitions
- `src/utils/`: Utility functions (security, validation, auth storage)

---

## 3. Công nghệ, framework và thư viện

### 3.1. Backend Technologies

| Công nghệ         | Phiên bản | Mô tả                                              |
| ----------------- | --------- | -------------------------------------------------- |
| **Go**            | 1.25.0    | Ngôn ngữ lập trình chính cho backend microservices |
| **Echo**          | v4.15.0   | Web framework cho HTTP server                      |
| **gRPC**          | v1.79.3   | Inter-service communication                        |
| **PostgreSQL**    | 15        | Primary database cho persistent data               |
| **Redis**         | 7         | Caching, sessions, cart storage                    |
| **RabbitMQ**      | 3.12      | Message queue cho async communication              |
| **MinIO**         | Latest    | Object storage cho product images                  |
| **Elasticsearch** | 8.14.3    | Search engine cho product catalog                  |

### 3.2. Frontend Technologies

| Công nghệ          | Phiên bản | Mô tả                                      |
| ------------------ | --------- | ------------------------------------------ |
| **React (Legacy)** | 18.3.1    | UI library cho ứng dụng Vite               |
| **Vite**           | 6.0.1     | Build tool và dev server (legacy frontend) |
| **TypeScript**     | 5.7.2     | Type-safe JavaScript                       |
| **React Router**   | 7.13.1    | Client-side routing (legacy)               |
| **Next.js**        | 16.2.1    | React framework mới cho MCP/Stitch UI      |
| **React (Next)**   | 19.2.4    | React library cho Next.js                  |

### 3.3. Observability & DevOps

| Công nghệ          | Mô tả                            |
| ------------------ | -------------------------------- |
| **Prometheus**     | Metrics collection               |
| **Grafana**        | Metrics visualization            |
| **Jaeger**         | Distributed tracing              |
| **Docker Compose** | Local development environment    |
| **Kubernetes**     | Production deployment (optional) |

### 3.4. Key Libraries (Backend)

| Thư viện                      | Mục đích                           |
| ----------------------------- | ---------------------------------- |
| `labstack/echo/v4`            | HTTP web framework                 |
| `labstack/echo-contrib`       | Echo middleware (CORS, prometheus) |
| `golang-jwt/jwt/v5`           | JWT authentication                 |
| `lib/pq`                      | PostgreSQL driver                  |
| `go-redis/v9`                 | Redis client                       |
| `sony/gobreaker/v2`           | Circuit breaker pattern            |
| `uber/zap`                    | Structured logging                 |
| `spf13/viper`                 | Configuration management           |
| `google/uuid`                 | UUID generation                    |
| `go-playground/validator/v10` | Request validation                 |
| `golang-migrate/v4`           | Database migrations                |
| `opentelemetry`               | Distributed tracing                |

### 3.5. Key Libraries (Frontend)

| Thư viện               | Mục đích            |
| ---------------------- | ------------------- |
| `react`                | UI framework        |
| `react-dom`            | React DOM rendering |
| `react-router-dom`     | Client-side routing |
| `@vitejs/plugin-react` | Vite React plugin   |
| `typescript`           | Type safety         |

---

## 4. Lý do chọn công nghệ và ưu điểm

### 4.1. Tại sao chọn Go cho Backend?

**Lý do:**

- **Hiệu năng cao**: Go được thiết kế cho concurrency với goroutines, phù hợp với microservices cần xử lý nhiều requests đồng thời
- **Biên dịch tĩnh**: Không cần runtime, dễ dàng deploy và scale
- **Ecosystem phong phú**: Nhiều thư viện chất lượng cao cho web development
- **Dễ học**: Cú pháp đơn giản, clean code
- **Phù hợp với team**: Theo AGENTS.md, nên dùng công cụ "boring, well-supported"

**Ưu điểm:**

- Khởi động nhanh, memory footprint thấp
- Built-in concurrency với goroutines và channels
- Static typing giúp phát hiện lỗi sớm
- Rich standard library
- Tốc độ biên dịch nhanh

### 4.2. Tại sao chọn Echo framework?

**Lý do:**

- Nhẹ, hiệu năng cao
- API rõ ràng, dễ sử dụng
- Tích hợp tốt với các middleware
- Hỗ trợ HTTP/2, WebSocket
- Phổ biến trong cộng đồng Go

**Ưu điểm:**

- Router nhanh và linh hoạt
- Middleware architecture tốt
- Group routes tiện lợi
- Hỗ trợ binding và validation tốt

### 4.3. Tại sao chọn PostgreSQL?

**Lý do:**

- Theo AGENTS.md: "prefer PostgreSQL as the primary source of truth"
- ACID compliant, đảm bảo data integrity
- Hỗ trợ complex queries, joins, transactions
- Scalable với replication
- Open source, không tốn phí license

**Ưu điểm:**

- Data integrity tuyệt đối
- Rich feature set (JSON support, full-text search, etc.)
- Performance tốt với proper indexing
- Large community và tài liệu phong phú

### 4.4. Tại sao chọn Redis?

**Lý do:**

- Theo AGENTS.md: "Redis only when there is a concrete caching, session, rate-limit, or queue need"
- Cart service cần low-latency access
- Rate limiting cần fast counter
- Session storage cần in-memory speed

**Ưu điểm:**

- In-memory data store cực nhanh
- Rich data structures (strings, lists, sets, sorted sets)
- Pub/Sub cho real-time features
- Persistence options (RDB, AOF)

### 4.5. Tại sao chọn RabbitMQ?

**Lý do:**

- Theo AGENTS.md: "RabbitMQ or async messaging only when there is a real reliability or decoupling requirement"
- Order và Payment services cần gửi notifications asynchronously
- Decouple services để tăng reliability

**Ưu điểm:**

- Message reliability với acknowledgments
- Flexible routing với exchanges
- Queue management tốt
- Clustering và high availability

### 4.6. Tại sao chọn React + Vite cho Frontend?

**Lý do:**

- React là tiêu chuẩn công nghiệp cho UI
- Vite cung cấp dev experience tuyệt vời (hot reload nhanh)
- TypeScript đảm bảo type safety
- React Router cho routing

**Ưu điểm:**

- Component-based architecture
- Virtual DOM cho performance
- Large ecosystem
- Vite: Instant hot reload, optimized builds
- TypeScript: Better IDE support, fewer runtime errors

### 4.7. Tại sao chọn Microservices Architecture?

**Lý do:**

- Mỗi service có thể scale độc lập
- Dễ bảo trì và phát triển
- Fault isolation - lỗi một service không ảnh hưởng toàn hệ thống
- Technology flexibility - có thể dùng different tech stacks cho different services
- Phù hợp với mục đích học tập của dự án

**Ưu điểm:**

- Independent deployment
- Team autonomy
- Scalability
- Technology heterogeneity

---

## 5. Cách các thành phần tương tác và luồng hoạt động

### 5.1. Kiến trúc tổng thể

```
┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│ API Gateway │
└─────────────┘     └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
    │  User   │      │ Product │      │  Cart   │
    │ Service │      │ Service │      │ Service │
    └────┬────┘      └────┬────┘      └────┬────┘
         │                │                │
    PostgreSQL       PostgreSQL        Redis
                   ┌────┴────┐
                   │  MinIO  │
                   │   (S3)  │
                   └─────────┘

    ┌────▼────┐      ┌────▼────┐
    │  Order  │      │ Payment │
    │ Service │      │ Service │
    └────┬────┘      └────┬────┘
         │                │
    ┌────┴────┐      ┌────┴────┐
    │Postgres │      │Postgres │
    └────┬────┘      └────┬────┘
         │                │
         └───────┬────────┘
                 │
          ┌──────▼──────┐
          │  RabbitMQ   │
          └──────┬──────┘
                 │
          ┌──────▼──────┐
          │Notification │
          │  Service    │
          └─────────────┘
```

### 5.2. Luồng xử lý request từ Frontend

1. **User gửi request** từ React frontend
2. **API Gateway nhận request**, áp dụng:
   - Rate limiting (Redis)
   - CORS validation
   - Logging
3. **Gateway proxy request** đến service tương ứng
4. **Service xử lý business logic**:
   - Validate request
   - Gọi repository để access database
   - Gọi các service khác qua gRPC nếu cần
5. **Service trả response** về Gateway
6. **Gateway trả response** về Frontend

### 5.3. Luồng đăng ký và đăng nhập

#### Đăng ký (Registration):

1. User submit form đăng ký từ RegisterPage
2. Frontend gọi `authApi.register()` → API Gateway
3. API Gateway forward đến User Service
4. User Service:
   - Validate input
   - Check email đã tồn tại chưa
   - Hash password
   - Create user trong PostgreSQL
   - Generate verification token
   - Send verification email (async)
5. Return success response
6. Frontend redirect đến trang xác thực email

#### Đăng nhập (Login):

1. User submit form đăng nhập từ LoginPage
2. Frontend gọi `authApi.login()` → API Gateway
3. API Gateway forward đến User Service
4. User Service:
   - Validate input
   - Check login protection (brute-force prevention)
   - Verify password
   - Generate JWT token
   - Return token và user profile
5. Frontend lưu token vào session storage
6. AuthContext cập nhật state, fetch user profile

### 5.4. Luồng thêm sản phẩm vào giỏ hàng

1. User click "Add to Cart" từ ProductCard
2. Frontend gọi `cartApi.addToCart()` → API Gateway
3. API Gateway forward đến Cart Service
4. Cart Service:
   - Nếu user đã đăng nhập: lưu vào Redis với user_id key
   - Nếu user chưa đăng nhập: lưu vào localStorage (guest cart)
   - Gọi Product Service qua gRPC để lấy price và stock
5. Return updated cart
6. Frontend cập nhật CartContext

### 5.5. Luồng checkout và tạo đơn hàng

1. User click "Checkout" từ CartPage
2. Frontend gọi `orderApi.createOrder()` → API Gateway
3. API Gateway forward đến Order Service
4. Order Service:
   - Validate cart items
   - Gọi Product Service qua gRPC để verify stock và prices
   - Apply coupons nếu có
   - Calculate shipping costs
   - Create order trong PostgreSQL
   - Create audit entry
   - Publish order.created event to RabbitMQ
5. Return order response
6. Frontend redirect đến trang thanh toán

### 5.6. Luồng thanh toán

1. User submit payment từ CheckoutPage
2. Frontend gọi `paymentApi.createPayment()` → API Gateway
3. API Gateway forward đến Payment Service
4. Payment Service:
   - Create payment record (status: pending)
   - Publish payment.created event to RabbitMQ
   - Return payment URL (redirect to payment provider)
5. User được redirect đến payment provider
6. Payment provider callback (webhook) đến Payment Service
7. Payment Service:
   - Verify webhook signature
   - Update payment status (completed/failed)
   - Publish payment.completed/failed event to RabbitMQ
8. Order Service nhận event, cập nhật order status

### 5.7. Luồng gửi notification

1. Order Service hoặc Payment Service publish event to RabbitMQ
2. Notification Service consume event từ queue
3. Notification Service:
   - Parse event data
   - Determine email template
   - Send email via SMTP
4. Email được gửi đến user

### 5.8. Inter-service Communication

#### gRPC (Synchronous):

- **Cart Service → Product Service**: Lấy price và stock info
- **Order Service → Product Service**: Verify stock, update inventory
- **User Service**: Cung cấp gRPC interface cho các service khác truy vấp user info

#### RabbitMQ (Asynchronous):

- **Order Service → Notification Service**: Order created/updated events
- **Payment Service → Notification Service**: Payment status events
- **Payment Service → Order Service**: Payment completed/failed events

### 5.9. Frontend Architecture

#### Contexts:

- **AuthContext**: Quản lý authentication state, token, user profile
- **CartContext**: Quản lý cart state, hỗ trợ cả authenticated và guest users

#### Hooks:

- **useAuth**: Access auth context
- **useCart**: Access cart context
- **useSessionToken**: Quản lý token trong session storage
- **useOrderPayments**: Fetch order và payment data

#### API Layer:

- **lib/api/auth.ts**: Authentication APIs
- **lib/api/user.ts**: User profile APIs
- **lib/api/product.ts**: Product catalog APIs
- **lib/api/cart.ts**: Cart APIs
- **lib/api/order.ts**: Order APIs
- **lib/api/payment.ts**: Payment APIs
- **lib/http/client.ts**: HTTP client với error handling
- **lib/normalizers/**: Data transformation functions

#### Security:

- **utils/security/sanitization.ts**: XSS prevention
- **utils/security/validation.ts**: Input validation
- **utils/auth/token.ts**: JWT token handling
- **utils/authStorage.ts**: Secure token storage

### 5.10. Data Flow Example: Mua sản phẩm

```
1. User xem sản phẩm
   └─▶ ProductPage ──▶ productApi.getProduct() ──▶ Product Service
       ◀──────────────────────────────────────────

2. Thêm vào giỏ hàng
   └─▶ CartContext.addItem() ──▶ cartApi.addToCart() ──▶ Cart Service
       │                           │                    │
       │                           └── gRPC ──▶ Product Service (verify stock)
       │                                              ◀──────────────
       ◀──────────────────────────────────────────────────────────

3. Checkout
   └─▶ CheckoutPage ──▶ orderApi.createOrder() ──▶ Order Service
       │                                              │
       │                           ┌──────────────────┘
       │                           └── gRPC ──▶ Product Service
       │                                              │
       │                           ┌──────────────────┘
       │                           └── gRPC ──▶ Cart Service (get items)
       │                                              │
       │                           ┌──────────────────┘
       │                           └── PostgreSQL (save order)
       │                                              │
       │                           ┌──────────────────┘
       │                           └── RabbitMQ (publish event)
       │                                              │
       ◀──────────────────────────────────────────────────────────

4. Thanh toán
   └─▶ PaymentPage ──▶ paymentApi.createPayment() ──▶ Payment Service
       │                                              │
       │                           ┌──────────────────┘
       │                           └── PostgreSQL (save payment)
       │                                              │
       │                           ┌──────────────────┘
       │                           └── RabbitMQ (publish event)
       │                                              │
       ◀──────────────────────────────────────────────────────────

5. Xác nhận thanh toán (Webhook)
   └─▶ Payment Provider ──▶ paymentApi.webhook() ──▶ Payment Service
       │                                              │
       │                           ┌──────────────────┘
       │                           └── PostgreSQL (update status)
       │                                              │
       │                           ┌──────────────────┘
       │                           └── RabbitMQ (publish event)
       │                                              │
       │                           ┌──────────────────┘
       │                           └── Order Service (update order status)
       │                                              │
       │                           ┌──────────────────┘
       │                           └── RabbitMQ (publish event)
       │                                              │
       │                           ┌──────────────────┘
       │                           └── Notification Service (send email)
       │                                              │
       ◀──────────────────────────────────────────────────────────
```

---

## Kết luận

Dự án E-Commerce Platform được xây dựng với kiến trúc microservices hiện đại, sử dụng Go cho backend và React + Vite cho frontend. Các công nghệ được chọn dựa trên nguyên tắc đơn giản, dễ vận hành và production-ready:

- **Go + Echo**: Hiệu năng cao, dễ phát triển và maintain
- **PostgreSQL**: Data integrity và reliability
- **Redis**: Caching và session management
- **RabbitMQ**: Async communication giữa các services
- **React + Vite**: Developer experience tuyệt vời
- **Prometheus + Grafana + Jaeger**: Observability đầy đủ

Cấu trúc code rõ ràng, chia theo layer (handler → service → repository) giúp dễ dàng understand và contribute. Các services giao tiếp qua HTTP (qua API Gateway) và gRPC (inter-service), với async events qua RabbitMQ cho decoupling.

---

_Document created: 2026-03-24_
_Project: E-Commerce Microservices Platform_
