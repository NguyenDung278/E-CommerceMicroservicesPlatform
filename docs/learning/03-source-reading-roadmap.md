# 03. Roadmap đọc source code

Tài liệu này là lộ trình đọc repo theo thứ tự giúp bạn hiểu nhanh nhất mà không bị lạc giữa nhiều service và hai frontend.

## 1. Đọc gì trước trong 10 phút đầu

Nếu bạn vừa clone repo và muốn có mental model đúng càng nhanh càng tốt, hãy đọc theo thứ tự này:

1. `README.md`
2. `docs/deep-dive/system-overview.md`
3. `docs/deep-dive/frontend-architecture.md`
4. `frontend/src/app/App.tsx`
5. `api-gateway/cmd/main.go`
6. `pkg/config/config.go`

### Vì sao thứ tự này hiệu quả

- `README.md` cho bạn bức tranh runtime và lệnh chạy
- `system-overview` giúp bạn biết request đi đâu, data nằm đâu
- `frontend-architecture` giúp bạn không nhầm `frontend/` và `client/`
- `App.tsx` cho bạn route map thật của UI
- `api-gateway/cmd/main.go` cho bạn entrypoint HTTP của backend

## 2. Ba mental model bắt buộc phải có trước khi đọc sâu

### Backend

Hầu hết service Go trong repo đi theo:

- `handler`
- `service`
- `repository`

### Frontend

Frontend React + Vite hiện đi theo:

- `app`
- `routes`
- `features`
- `shared`

Ngoài ra vẫn còn `hooks`, `lib`, `ui`, `providers`, `utils`, `types` ở root làm compatibility layer.

### Runtime

- frontend local chính là `frontend/`
- gateway là HTTP entrypoint
- PostgreSQL là source of truth cho domain business chính
- Redis/RabbitMQ/MinIO/Elasticsearch là dependency bổ trợ

## 3. Giai đoạn 1: Hiểu runtime và entrypoint

Đọc các file này trước:

- `deployments/docker/docker-compose.yml`
- `deployments/docker/config/*.yaml`
- `frontend/src/app/main.tsx`
- `frontend/src/app/App.tsx`
- `frontend/src/app/providers/AppProviders.tsx`
- `api-gateway/cmd/main.go`

### Bạn sẽ học được gì

- service nào thực sự chạy trong local stack
- route tree thật của frontend
- provider tree thật của frontend
- gateway đang proxy những domain nào

## 4. Giai đoạn 2: Hiểu backend foundation dùng chung

Đừng lao ngay vào business flow. Hãy đọc phần hạ tầng chung trước:

- `pkg/config/config.go`
- `pkg/database/postgres.go`
- `pkg/middleware/*`
- `pkg/response/*`
- `pkg/validation/*`
- `pkg/observability/*`
- `api-gateway/internal/proxy/service_proxy.go`

### Vì sao

Những package này được dùng lặp lại khắp repo. Nếu hiểu chúng trước, bạn sẽ đọc service nào cũng dễ hơn.

## 5. Giai đoạn 3: Đọc frontend theo chiều từ ngoài vào trong

### Bước 1: App shell

- `frontend/src/app/App.tsx`
- `frontend/src/app/layout/AppLayout.tsx`
- `frontend/src/app/router/ProtectedRoute.tsx`

### Bước 2: Provider và global state

- `frontend/src/features/auth/providers/AuthProvider.tsx`
- `frontend/src/features/cart/providers/CartProvider.tsx`
- `frontend/src/features/account/hooks/useOrderPayments.ts`
- `frontend/src/features/account/hooks/useSavedAddresses.ts`

### Bước 3: API boundary

- `frontend/src/shared/api/http-client.ts`
- `frontend/src/shared/api/error-handler.ts`
- `frontend/src/shared/api/normalizers.ts`
- `frontend/src/shared/api/modules/*.ts`
- `frontend/src/shared/types/api.ts`

### Bước 4: Route pages

Đọc theo use case bạn quan tâm:

- auth: `LoginPage`, `RegisterPage`, `AuthCallbackPage`, `VerifyEmailPage`
- storefront: `HomePage`, `CatalogPage`, `CategoryPage`, `ProductDetailPage`
- cart/checkout: `CartPage`, `CheckoutPage`
- account: `ProfilePage`, `OrdersPage`, `OrderDetailPage`, `PaymentHistoryPage`
- partial pages: `AddressesPage`, `SecurityPage`, `NotificationsPage`
- admin: `AdminPage`

## 6. Giai đoạn 4: Đọc service “dễ hiểu nhất” trước

### `user-service`

Nên đọc đầu tiên vì có:

- auth flow rõ
- repository PostgreSQL dễ theo
- nhiều route cơ bản nhưng thực tế

Thứ tự đọc:

1. `services/user-service/cmd/main.go`
2. `services/user-service/internal/handler/user_handler.go`
3. `services/user-service/internal/service/user_service.go`
4. `services/user-service/internal/service/oauth_service.go`
5. `services/user-service/internal/repository/*`

## 7. Giai đoạn 5: Đọc service có inter-service communication

### `product-service`

Bạn học được:

- catalog CRUD
- review
- search/object storage optional integration
- gRPC server

### `cart-service`

Bạn học được:

- Redis
- gRPC client sang product-service
- source of truth mindset

## 8. Giai đoạn 6: Đọc service orchestration nặng hơn

### `order-service`

Bạn sẽ thấy:

- order preview / create / cancel
- transaction với PostgreSQL
- gRPC lookup sang product-service
- event publishing

### `payment-service`

Bạn sẽ thấy:

- payment lifecycle
- refund
- webhook flow
- publish payment events

## 9. Giai đoạn 7: Đọc worker async

### `notification-service`

Đây là nơi tốt để học:

- RabbitMQ consumer
- event-driven flow
- vì sao email không nên nằm trong request path chính

## 10. Giai đoạn 8: Trace use case end-to-end

Sau khi đọc từng phần riêng, hãy trace theo use case:

### Login

`LoginPage -> useAuth -> AuthProvider -> authApi -> api-gateway -> user-service`

### Add to cart

`CatalogPage/ProductDetailPage -> useCart -> CartProvider -> cartApi hoặc guest storage -> cart-service -> product-service gRPC -> Redis`

### Checkout

`CheckoutPage -> orderApi -> order-service -> product-service gRPC -> PostgreSQL -> paymentApi -> payment-service`

### Admin product management

`AdminPage -> api compatibility layer -> product-service`

## 11. Giai đoạn 9: Đọc migration và gRPC contract

### Migration

Đọc từng service có DB riêng:

- `services/user-service/migrations/*`
- `services/product-service/migrations/*`
- `services/order-service/migrations/*`
- `services/payment-service/migrations/*`

### Proto

Đọc:

- `proto/product.proto`
- `proto/user.proto`

Generated files `.pb.go` hiện cũng được commit ngay trong `proto/`.

## 12. Cách đọc một file hiệu quả hơn

Với mỗi file, hãy tự hỏi:

1. file này là boundary hay implementation?
2. input của nó đến từ đâu?
3. output của nó được dùng ở đâu?
4. nó có side effect gì?
5. nếu file này hỏng, feature nào sẽ vỡ?

## 13. Checklist tự đánh giá

Sau khi đi hết roadmap này, bạn nên tự hỏi:

- tôi có mô tả được login flow mà không mở code không?
- tôi có chỉ ra được cart đang tin dữ liệu nào và không tin dữ liệu nào không?
- tôi có biết page account nào đang full backend-backed, page nào còn partial không?
- tôi có biết vì sao `frontend/src` vừa có `shared/*` vừa còn `lib/*`, `hooks/*`, `ui/*` không?
- tôi có giải thích được vì sao PostgreSQL vẫn là trung tâm của business data không?
