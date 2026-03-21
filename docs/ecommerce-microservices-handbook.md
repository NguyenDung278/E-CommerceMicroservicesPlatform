# E-Commerce Platform Handbook

Tài liệu này là roadmap thực chiến để xây dựng một nền tảng e-commerce bằng Go, microservices và Docker theo hướng production-ready, nhưng vẫn dễ học và copy-paste từng phần.

Go version mục tiêu: `1.19+`

## 0. Tổng quan kiến trúc

### Mục tiêu kiến trúc

- Tách từng nghiệp vụ thành service riêng để dễ scale và deploy độc lập.
- Giữ service nhỏ, rõ boundary, dễ test và maintain.
- Phân chia giao tiếp:
  - `REST` cho client-facing API
  - `gRPC` cho service-to-service
  - `RabbitMQ` cho event bất đồng bộ
- Dùng `Docker Compose` cho local, `Kubernetes` cho production.

### Sơ đồ tổng quan

```text
Frontend
  -> API Gateway
      -> User Service
      -> Product Service
      -> Cart Service
      -> Order Service -> Product Service (gRPC)
      -> Payment Service

Order Service -> RabbitMQ -> Notification Service

User/Product/Order/Payment -> PostgreSQL
Cart -> Redis
Metrics -> Prometheus -> Grafana
Tracing -> OpenTelemetry -> Jaeger
```

### Tại sao chọn mô hình này

- `User/Product/Order/Payment` cần transaction và query rõ ràng, nên hợp với PostgreSQL.
- `Cart` là dữ liệu tạm, TTL-based, nên hợp với Redis.
- `Order -> Notification` là side effect không nên block request, nên đẩy qua message queue.
- `gRPC` giữa Order và Product giúp contract rõ, payload nhẹ, latency thấp.

---

## 1. Environment Setup và Project Structure

### 1.1 Cài đặt môi trường

Cần có:

- Go `1.19+`
- Docker
- Docker Compose
- `make`
- `psql`, `redis-cli`, `grpcurl` là tùy chọn nhưng rất hữu ích

Kiem tra:

```bash
go version
docker --version
docker compose version
```

### 1.2 Cấu trúc thư mục đề nghị

```text
ecommerce-platform/
  api-gateway/
  services/
    user-service/
    product-service/
    cart-service/
    order-service/
    payment-service/
    notification-service/
  pkg/
    config/
    database/
    logger/
    middleware/
    response/
  proto/
  deployments/
    docker/
    k8s/
  docs/
```

### 1.3 Go modules

Mỗi service nên có module riêng nếu bạn muốn build độc lập.

```bash
cd services/user-service
go mod init github.com/your-org/ecommerce/services/user-service
go get github.com/labstack/echo/v4
go get go.uber.org/zap
go get github.com/golang-jwt/jwt/v5
```

### 1.4 Dependency management

Production-ready libs đề nghị:

- HTTP: `github.com/labstack/echo/v4` hoac `github.com/gin-gonic/gin`
- Logging: `go.uber.org/zap`
- Validation: `github.com/go-playground/validator/v10`
- PostgreSQL: `github.com/lib/pq` hoac `github.com/jackc/pgx/v5`
- Redis: `github.com/redis/go-redis/v9`
- RabbitMQ: `github.com/rabbitmq/amqp091-go`
- gRPC: `google.golang.org/grpc`
- Metrics: `github.com/prometheus/client_golang/prometheus`
- Tracing: `go.opentelemetry.io/otel`

### 1.5 Pitfalls

- Không nhét module lung tung giữa các service nếu chưa rõ boundary.
- Không để business logic trong `main.go`.
- Không nhầm `pkg/` thành nơi chứa mọi thứ. Chỉ đưa phần shared thực sự.

---

## 2. Core Microservices Development

Moi service nen theo layering:

```text
cmd/main.go
internal/handler
internal/service
internal/repository
internal/model
internal/dto
```

### 2.1 Service skeleton bang Go

```go
package main

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

func main() {
	e := echo.New()
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{
			"service": "example-service",
			"status":  "healthy",
		})
	})
	e.Logger.Fatal(e.Start(":8081"))
}
```

### 2.2 User Service

Nghiep vu:

- register
- login (with refresh token)
- password change
- profile
- role
- shipping addresses (CRUD, max 10, auto-fallback default)

DTO:

```go
type RegisterRequest struct {
	Email     string `json:"email" validate:"required,email"`
	Password  string `json:"password" validate:"required,min=8"`
	FirstName string `json:"first_name" validate:"required"`
	LastName  string `json:"last_name" validate:"required"`
}
```

Service:

```go
func (s *UserService) Register(ctx context.Context, req dto.RegisterRequest) (*dto.AuthResponse, error) {
	existing, err := s.repo.GetByEmail(ctx, req.Email)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrEmailAlreadyExists
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	user := &model.User{
		ID:           uuid.NewString(),
		Email:        req.Email,
		PasswordHash: string(hashed),
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		Role:         "user",
	}

	if err := s.repo.Create(ctx, user); err != nil {
		return nil, err
	}

	token, err := s.generateJWT(user)
	if err != nil {
		return nil, err
	}

	return &dto.AuthResponse{Token: token, User: user}, nil
}
```

Why:

- hash password o service vi day la security/business rule
- repo chi lo persistence
- handler chi lo HTTP

### 2.3 Product Service

Nghiep vu:

- list products
- get by id
- create/update/delete cho admin
- **restore stock** (tái sử dụng `UpdateProduct` RPC để hoàn kho khi hủy đơn)

Repository query co phan trang:

```go
func (r *ProductRepository) List(ctx context.Context, page, limit int, category, search string) ([]model.Product, int64, error) {
	offset := (page - 1) * limit
	query := `
		SELECT id, name, description, price, stock, category, image_url, created_at, updated_at
		FROM products
		WHERE ($1 = '' OR category = $1)
		  AND ($2 = '' OR name ILIKE '%' || $2 || '%')
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4
	`

	rows, err := r.db.QueryContext(ctx, query, category, search, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var products []model.Product
	for rows.Next() {
		var p model.Product
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.Stock, &p.Category, &p.ImageURL, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, 0, err
		}
		products = append(products, p)
	}

	return products, 0, nil
}
```

### 2.4 Cart Service

Nghiep vu:

- add item
- update quantity
- remove item
- clear cart

Redis repository:

```go
func (r *CartRepository) Save(ctx context.Context, userID string, cart *model.Cart) error {
	key := "cart:" + userID
	payload, err := json.Marshal(cart)
	if err != nil {
		return err
	}
	return r.client.Set(ctx, key, payload, 7*24*time.Hour).Err()
}
```

Why:

- cart la du lieu tam
- doc/ghi nhanh
- de TTL tu dong

### 2.5 Order Service

Nghiep vu:

- checkout
- xac minh san pham qua Product Service
- tao order + order_items
- publish event `order.created`
- **cancel order** (chỉ cho phép khi ở trạng thái pending)
- restore stock (gọi gRPC sang Product Service)
- publish event `order.cancelled`
- tracking event timeline (order_events)

Pseudo flow:

```go
func (s *OrderService) CreateOrder(ctx context.Context, userID string, req dto.CreateOrderRequest) (*model.Order, error) {
	if len(req.Items) == 0 {
		return nil, ErrEmptyOrder
	}

	order := &model.Order{
		ID:     uuid.NewString(),
		UserID: userID,
		Status: model.OrderStatusPending,
	}

	for _, item := range req.Items {
		product, err := s.productClient.GetProduct(ctx, item.ProductID)
		if err != nil {
			return nil, err
		}
		if product.StockQuantity < int32(item.Quantity) {
			return nil, ErrInsufficientStock
		}

		order.Items = append(order.Items, model.OrderItem{
			ID:        uuid.NewString(),
			OrderID:   order.ID,
			ProductID: item.ProductID,
			Name:      product.Name,
			Price:     float64(product.Price),
			Quantity:  item.Quantity,
		})
	}

	if err := s.repo.Create(ctx, order); err != nil {
		return nil, err
	}

	go s.publishOrderCreated(order)
	return order, nil
}
```

### 2.6 Payment Service

Nghiep vu:

- process payment
- chong duplicate payment cho cung `order_id`
- publish `payment.completed`

Best practice:

- can co idempotency key neu thanh toan that
- can ownership check: user chi duoc payment order cua minh

### 2.7 Notification Service

Nghiep vu:

- subscribe RabbitMQ
- gui email/SMS

Consumer:

```go
func (h *EventHandler) Handle(delivery amqp.Delivery) {
	defer delivery.Ack(false)

	switch delivery.RoutingKey {
	case "order.created":
		// send email xac nhan don hang
	case "payment.completed":
		// send email thanh toan thanh cong
	}
}
```

---

## 3. Infrastructure Components

### 3.1 PostgreSQL

Config:

```go
type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}
```

Connect:

```go
dsn := fmt.Sprintf(
	"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
	cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode,
)

db, err := sql.Open("postgres", dsn)
if err != nil {
	return err
}

db.SetMaxOpenConns(25)
db.SetMaxIdleConns(25)
db.SetConnMaxLifetime(30 * time.Minute)
```

### 3.2 Redis

```go
rdb := redis.NewClient(&redis.Options{
	Addr: "redis:6379",
	DB:   0,
})
```

Dung Redis cho:

- cart
- cache product detail
- rate limiting distributed

### 3.3 RabbitMQ

Publish:

```go
err := ch.PublishWithContext(ctx,
	"events",
	"order.created",
	false,
	false,
	amqp.Publishing{
		ContentType: "application/json",
		Body:        body,
	},
)
```

Pitfalls:

- khong declare exchange/queue se publish fail
- khong co retry/DLQ se de mat event
- production nen dung outbox pattern

---

## 4. Service Communication va Integration

### 4.1 REST API voi Echo

Handler:

```go
func (h *UserHandler) Register(c echo.Context) error {
	var req dto.RegisterRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid body"})
	}
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "validation failed"})
	}

	result, err := h.service.Register(c.Request().Context(), req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, result)
}
```

### 4.2 gRPC cho inter-service

Proto:

```proto
syntax = "proto3";

package product;

service ProductService {
  rpc GetProductByID(GetProductByIDRequest) returns (GetProductByIDResponse);
}

message GetProductByIDRequest {
  string product_id = 1;
}

message GetProductByIDResponse {
  Product product = 1;
}

message Product {
  string id = 1;
  string name = 2;
  float price = 3;
  int32 stock_quantity = 4;
}
```

Client:

```go
conn, err := grpc.Dial("product-service:50052", grpc.WithTransportCredentials(insecure.NewCredentials()))
if err != nil {
	return err
}

client := pb.NewProductServiceClient(conn)
res, err := client.GetProductByID(ctx, &pb.GetProductByIDRequest{
	ProductId: productID,
})
```

### 4.3 API Gateway

Trach nhiem:

- auth middleware
- rate limit
- route -> target service
- timeout / retry / circuit breaker

### 4.4 Service discovery

Local:

- Docker Compose DNS name, vi du `http://user-service:8081`

Production:

- Kubernetes Service DNS, vi du `user-service.default.svc.cluster.local`

---

## 5. Containerization va Orchestration

### 5.1 Dockerfile cho Go service

```dockerfile
FROM golang:1.25-alpine AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/service ./cmd/main.go

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /out/service /app/service
EXPOSE 8080
ENTRYPOINT ["/app/service"]
```

Why multi-stage:

- image nho
- giam attack surface
- khong mang compiler vao production image

### 5.2 Docker Compose local

```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password123
    ports:
      - "5434:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"

  user-service:
    build:
      context: .
      dockerfile: services/user-service/Dockerfile
    environment:
      CONFIG_PATH: /config/config.yaml
    ports:
      - "8081:8081"
```

### 5.3 Troubleshooting

- `ECONNREFUSED`: service chua up hoac port mapping sai
- `relation does not exist`: migration chua chay hoac DB dung sai
- `go.mod requires go >= ...`: Dockerfile dang dung Go version cu

---

## 6. Monitoring va Observability

### 6.1 Structured logging voi Zap

```go
logger, _ := zap.NewProduction()
logger.Info("order created",
	zap.String("order_id", order.ID),
	zap.String("user_id", order.UserID),
)
```

Best practice:

- log theo key-value
- them `request_id`, `user_id`, `order_id`
- khong log password/token raw

### 6.2 Prometheus metrics

```go
var requestCounter = prometheus.NewCounterVec(
	prometheus.CounterOpts{
		Name: "http_requests_total",
		Help: "Total HTTP requests",
	},
	[]string{"service", "method", "path", "status"},
)

func init() {
	prometheus.MustRegister(requestCounter)
}
```

### 6.3 Distributed tracing

Voi OpenTelemetry:

```go
ctx, span := tracer.Start(ctx, "CreateOrder")
defer span.End()
```

Trace can di qua:

- gateway
- order-service
- product-service gRPC
- rabbitmq publish/consume

### 6.4 Health check

```go
e.GET("/health", func(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{
		"status":  "healthy",
		"service": "order-service",
	})
})
```

Pitfall:

- image `distroless` khong co `wget`, nen healthcheck Docker dung `CMD-SHELL wget ...` se fail
- co the dung binary sidecar hoac healthcheck tu k8s thay vi shell tool trong image

---

## 7. Production Deployment

### 7.1 Kubernetes deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
        - name: user-service
          image: your-registry/user-service:latest
          ports:
            - containerPort: 8081
          readinessProbe:
            httpGet:
              path: /health
              port: 8081
          livenessProbe:
            httpGet:
              path: /health
              port: 8081
---
apiVersion: v1
kind: Service
metadata:
  name: user-service
spec:
  selector:
    app: user-service
  ports:
    - port: 8081
      targetPort: 8081
```

### 7.2 CI/CD pipeline

Vi du GitHub Actions:

```yaml
name: ci

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.25"
      - run: go test ./...

  docker:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - run: docker build -f services/user-service/Dockerfile -t your-registry/user-service:${{ github.sha }} .
```

### 7.3 Security best practices

- JWT secret phai la secret that, khong hard-code
- validate input o transport layer
- ownership check o service layer
- dung HTTPS o production
- rate limit o gateway
- sanitize log, khong log credentials
- CSP/XSS headers cho frontend
- scan image Docker
- rotate secret
- principle of least privilege cho DB user

---

## Testing Strategy

### Unit test service layer

```go
func TestRegister_EmailAlreadyExists(t *testing.T) {
	repo := &mockUserRepo{
		user: &model.User{Email: "alice@example.com"},
	}
	svc := service.NewUserService(repo, "secret", 3600)

	_, err := svc.Register(context.Background(), dto.RegisterRequest{
		Email:     "alice@example.com",
		Password:  "Password123",
		FirstName: "Alice",
		LastName:  "Nguyen",
	})

	if !errors.Is(err, service.ErrEmailAlreadyExists) {
		t.Fatalf("expected ErrEmailAlreadyExists, got %v", err)
	}
}
```

### Integration test handler

```go
req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", strings.NewReader(body))
req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
rec := httptest.NewRecorder()
c := e.NewContext(req, rec)

if err := handler.Register(c); err != nil {
	t.Fatal(err)
}

if rec.Code != http.StatusCreated {
	t.Fatalf("expected 201, got %d", rec.Code)
}
```

### End-to-end local

- register
- login
- create product
- add to cart
- create order
- process payment
- verify notification event

---

## Performance va Fault Tolerance

- connection pooling cho Postgres
- cache product detail bang Redis neu read heavy
- goroutine chi dung cho tac vu async co lifecycle ro
- retry chi ap dung cho request idempotent
- circuit breaker o gateway
- outbox pattern cho event reliability
- idempotency key cho payment
- paginate list API
- giam N+1 query

---

## Debugging Checklist

Neu loi khong ro:

1. `curl http://localhost:8080/health`
2. `docker compose ps`
3. `docker compose logs <service>`
4. kiem tra DB dung service chua
5. kiem tra migration
6. kiem tra JWT secret co trung khop giua gateway va service khong
7. kiem tra exchange/queue RabbitMQ da declare chua

---

## Next Steps de nang cap

- them `inventory reservation`
- them `outbox + inbox pattern`
- them `saga` cho order/payment
- them `refresh token`
- them `search service`
- them `object storage` cho image upload
- them `React Query` cho frontend
- them `Helm chart` cho deploy

## 8. Frontend Architecture với React và Vite

### 8.1 Mục tiêu

Frontend production-ready cho hệ microservices nên:

- tách route rõ ràng theo business flow
- gom API calls về một chỗ
- quản lý auth/token nhất quán
- tránh hardcode backend URL
- dễ scale thêm page và reusable component

### 8.2 Cấu trúc thư mục đề nghị

```text
frontend/src/
  components/
  contexts/
  hooks/
  lib/
  pages/
  types/
  utils/
  App.tsx
  main.tsx
  styles.css
```

Giải thích:

- `pages/`: màn hình theo route như home, catalog, cart, checkout, profile, admin
- `components/`: khối UI tái sử dụng như layout, product card, order history list
- `contexts/`: auth, cart, state chia sẻ theo toàn app
- `hooks/`: logic dùng lại như đọc token session, load order + payment history
- `lib/`: API client, request wrapper, error mapping
- `types/`: contract TypeScript bám theo response backend
- `utils/`: sanitize, format, validation

### 8.3 Router và page composition

```tsx
<BrowserRouter>
  <Routes>
    <Route element={<AppLayout />} path="/">
      <Route index element={<HomePage />} />
      <Route path="products" element={<CatalogPage />} />
      <Route path="products/:productId" element={<ProductDetailPage />} />
      <Route path="cart" element={<CartPage />} />
      <Route path="checkout" element={<CheckoutPage />} />
      <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="payments" element={<ProtectedRoute><PaymentHistoryPage /></ProtectedRoute>} />
      <Route path="admin" element={<ProtectedRoute requireAdmin><AdminPage /></ProtectedRoute>} />
    </Route>
  </Routes>
</BrowserRouter>
```

Why:

- route rõ giúp scale page mà không phình một file `App.tsx`
- `AppLayout` giữ header/footer nhất quán
- `ProtectedRoute` cô lập auth check khỏi page business

### 8.4 API layer

Thay vì gọi `fetch` rải khắp component, gom về một chỗ:

```ts
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
export const apiBaseUrl = configuredApiBaseUrl ? configuredApiBaseUrl.replace(/\/+$/, "") : "";

async function request<T>(path: string, options: RequestOptions = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
}
```

Why:

- đổi base URL một lần thay vì sửa toàn bộ app
- map lỗi nhất quán
- dễ thêm retry, tracing header, request ID sau này

### 8.5 Same-origin proxy để tránh lỗi kết nối

Trong local dev:

```ts
server: {
  proxy: {
    "/api": "http://localhost:8080",
    "/health": "http://localhost:8080"
  }
}
```

Trong frontend container Nginx:

```nginx
location /api/ {
    proxy_pass http://api-gateway:8080;
}

location = /health {
    proxy_pass http://api-gateway:8080/health;
}
```

Why:

- browser chỉ gọi cùng origin `http://localhost:4173/api/...`
- không cần hardcode `http://localhost:8080` trong bundle
- giảm rủi ro CORS/base URL mismatch giữa dev và Docker

### 8.6 Auth và token management

Ví dụ context:

```tsx
const { token, setToken, clearToken } = useSessionToken();

async function login(input: LoginInput) {
  const response = await api.login(input);
  startTransition(() => {
    setToken(response.data.token);
    setUser(response.data.user);
  });
}
```

Best practice:

- dùng `sessionStorage` thay vì `localStorage` cho demo/storefront local
- token chỉ nên đọc/ghi qua hook hoặc context
- toàn bộ API cần auth lấy token từ context, không chuyền tay lung tung

### 8.7 State management

Không cần kéo thư viện nặng quá sớm. Với storefront vừa và nhỏ:

- `AuthContext` cho identity/session
- `CartContext` cho giỏ hàng
- custom hook như `useOrderPayments` cho data orchestration theo page

Khi nào nâng cấp:

- dùng `TanStack Query` khi network state phức tạp hơn
- dùng `Zustand` nếu nhiều state client-only cần chia sẻ ngoài scope auth/cart

### 8.8 Component architecture

Ví dụ component tái sử dụng:

```tsx
type ProductCardProps = {
  product: Product;
  onAddToCart?: (product: Product) => void | Promise<void>;
  onBuyNow?: (product: Product) => void;
};
```

Rule nên giữ:

- component presentational nhận props, ít biết về API
- page chịu trách nhiệm orchestration
- hook chịu trách nhiệm data loading

### 8.9 Frontend security checklist

- sanitize input trước khi submit
- không dùng `dangerouslySetInnerHTML`
- CSP qua Nginx
- `X-Frame-Options`, `nosniff`, `Referrer-Policy`
- không hardcode secret trong frontend
- token không log ra console
- validate cả client-side lẫn server-side

### 8.10 Testing strategy cho frontend

- unit test cho validation/format utilities
- component test cho form và protected route
- smoke test các page chính: auth, products, cart, checkout, profile
- e2e local bằng Playwright hoặc Cypress nếu flow đã ổn định

Ví dụ utility test:

```ts
it("rejects short passwords", () => {
  expect(validateRegister({
    email: "alice@example.com",
    password: "123",
    firstName: "Alice",
    lastName: "Nguyen"
  })).toContain("Mật khẩu cần ít nhất 8 ký tự.");
});
```

### 8.11 Pitfalls thường gặp

- hardcode backend URL trong bundle production
- để page gọi API trực tiếp quá nhiều nơi
- trộn UI state với network state trong một component rất lớn
- không có loading/empty/error state
- chỉ validate ở frontend mà quên backend

### 8.12 Hướng nâng cấp tiếp

- thêm `TanStack Query`
- thêm skeleton loading
- thêm order filter theo trạng thái
- thêm payment history search
- thêm address book và shipping step
- thêm optimistic UI cho cart

Tài liệu này nên được đọc cùng với codebase hiện tại của repo để hiểu cả phần "vì sao" lẫn "làm thế nào".
