# Project Documentation Map

Thư mục `docs/` được tổ chức như một handbook nội bộ để đọc và học từ chính source code hiện có của `ecommerce-platform`. Bộ tài liệu này không chỉ trả lời "code làm gì", mà còn cố gắng giải thích:

- vì sao module đó tồn tại
- dữ liệu đi qua các layer như thế nào
- pattern nào đáng học và vì sao nó giúp code dễ đọc, dễ sửa, dễ mở rộng hơn
- những chỗ nào đang ở trạng thái chuyển tiếp hoặc còn nợ refactor

Ba lớp tài liệu chính:

- `learning/`: onboarding, setup, cách đọc repo, cách verify và debug
- `deep-dive/`: kiến trúc, runtime, boundary giữa service và vai trò của từng khối lớn
- `annotated/`: đọc source theo file/module/flow cụ thể, thiên về tư duy đọc code

## Đọc từ đâu nếu bạn mới vào repo

### Lộ trình ngắn nhất để hiểu runtime toàn hệ thống

1. [learning/00-local-setup.md](./learning/00-local-setup.md)
2. [deep-dive/system-overview.md](./deep-dive/system-overview.md)
3. [deep-dive/frontend-architecture.md](./deep-dive/frontend-architecture.md)
4. [learning/03-source-reading-roadmap.md](./learning/03-source-reading-roadmap.md)
5. [annotated/README.md](./annotated/README.md)

### Lộ trình nếu bạn đang sửa frontend React + Vite

1. [deep-dive/frontend-architecture.md](./deep-dive/frontend-architecture.md)
2. [annotated/frontend-source-map.md](./annotated/frontend-source-map.md)
3. [annotated/frontend-app.md](./annotated/frontend-app.md)
4. [annotated/frontend-auth-cart-providers.md](./annotated/frontend-auth-cart-providers.md)
5. [annotated/frontend-api-layer.md](./annotated/frontend-api-layer.md)
6. [annotated/frontend-routes-and-flows.md](./annotated/frontend-routes-and-flows.md)

### Lộ trình nếu bạn đang sửa backend Go

1. [annotated/shared-packages.md](./annotated/shared-packages.md)
2. [annotated/api-gateway-main.md](./annotated/api-gateway-main.md)
3. Chọn một domain service trong `annotated/`
4. Đọc thêm phần tương ứng trong `deep-dive/`
5. Quay lại [learning/09-how-to-add-new-feature.md](./learning/09-how-to-add-new-feature.md) trước khi code

## Mục lục chi tiết

### `learning/`

- [README.md](./learning/README.md): bản đồ học tập của tầng `learning`
- [00-local-setup.md](./learning/00-local-setup.md): setup local theo trạng thái Docker/Compose hiện tại
- [03-source-reading-roadmap.md](./learning/03-source-reading-roadmap.md): cách đọc repo theo thứ tự để không bị ngợp
- [05-first-contribution-walkthrough.md](./learning/05-first-contribution-walkthrough.md): walkthrough cho contributor mới
- [06-testing-and-verification.md](./learning/06-testing-and-verification.md): cách verify thay đổi theo đúng runtime hiện tại
- [09-how-to-add-new-feature.md](./learning/09-how-to-add-new-feature.md): thêm feature mới theo path và layering thật của repo
- [10-guide-to-debugging.md](./learning/10-guide-to-debugging.md): debug Docker, gateway, service, trace và DB
- [11-senior-source-code-review-guide.md](./learning/11-senior-source-code-review-guide.md): review toàn repo theo góc nhìn senior

### `deep-dive/`

- [README.md](./deep-dive/README.md): bản đồ của tầng kiến trúc
- [system-overview.md](./deep-dive/system-overview.md): flow HTTP, gRPC, RabbitMQ, source of truth và runtime Compose
- [frontend-architecture.md](./deep-dive/frontend-architecture.md): kiến trúc frontend hiện tại, import map sau refactor và dependency flow
- [api-gateway.md](./deep-dive/api-gateway.md): gateway và logic proxy
- [user-service.md](./deep-dive/user-service.md): auth, email flow, Google OAuth, phone verification, address
- [product-service.md](./deep-dive/product-service.md): catalog, media, search, gRPC
- [cart-service.md](./deep-dive/cart-service.md): Redis cart và product lookup
- [order-service.md](./deep-dive/order-service.md): order flow, event, coupon, report
- [payment-service.md](./deep-dive/payment-service.md): payment lifecycle và webhook
- [notification-service.md](./deep-dive/notification-service.md): worker consume event và gửi email

### `annotated/`

- [README.md](./annotated/README.md): lộ trình đọc source theo module
- [frontend-source-map.md](./annotated/frontend-source-map.md): bản đồ thư mục frontend và mapping giữa import cũ với cấu trúc mới
- [frontend-app.md](./annotated/frontend-app.md): entrypoint, providers, route shell, AppLayout, ProtectedRoute
- [frontend-auth-cart-providers.md](./annotated/frontend-auth-cart-providers.md): AuthProvider, CartProvider, token/storage, guest cart, merge flow
- [frontend-api-layer.md](./annotated/frontend-api-layer.md): http client, error handler, API modules, normalizer, shared types
- [frontend-routes-and-flows.md](./annotated/frontend-routes-and-flows.md): route/page flow của storefront, account, checkout, admin
- [client-experimental.md](./annotated/client-experimental.md): nhánh Next.js experimental và cách nó liên hệ với frontend chính
- [shared-packages.md](./annotated/shared-packages.md): `pkg/` và nền tảng backend dùng chung
- [api-gateway-main.md](./annotated/api-gateway-main.md): entrypoint gateway
- Các doc service/repository/line-by-line còn lại trong `annotated/` giữ vai trò đọc sâu backend

## Điều cần nhớ khi dùng bộ docs này

- Nếu tài liệu và source mâu thuẫn, hãy tin source thật ở `cmd/main.go`, `internal/handler`, `internal/service`, `internal/repository`, `frontend/src/`, `deployments/docker/`.
- Frontend hiện ở trạng thái refactor chuyển tiếp: cấu trúc thư mục mới đã xuất hiện trong `app/`, `features/`, `shared/`, nhưng một số route/page vẫn còn import theo đường cũ. Bộ docs mới có phần source map để giải thích điều này thay vì bỏ qua.
- `frontend/` là UI local chính; `client/` là nhánh Next.js experimental, có giá trị học tập nhưng chưa phải runtime mặc định.
- Không phải mọi doc cũ đều sai, nhưng các doc frontend và local runtime đã được nâng cấp mạnh để bám hơn với source hiện tại.

## Nếu muốn hiểu repo ở mức senior

Đọc theo cụm sau:

1. [learning/11-senior-source-code-review-guide.md](./learning/11-senior-source-code-review-guide.md)
2. [deep-dive/system-overview.md](./deep-dive/system-overview.md)
3. [deep-dive/frontend-architecture.md](./deep-dive/frontend-architecture.md)
4. [annotated/shared-packages.md](./annotated/shared-packages.md)
5. [annotated/frontend-api-layer.md](./annotated/frontend-api-layer.md)
6. [annotated/order-service.md](./annotated/order-service.md)
7. [annotated/payment-service.md](./annotated/payment-service.md)
