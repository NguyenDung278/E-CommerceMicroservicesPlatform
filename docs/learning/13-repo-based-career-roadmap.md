# 8-Week Repo-Based Career Roadmap

Tài liệu này biến chính `ecommerce-platform` thành một lộ trình học 8 tuần có đầu ra rõ ràng. Mục tiêu không phải đọc cho biết, mà là đi từ mức "đọc code còn chậm" lên mức "tự tin sửa flow quan trọng, giải thích thiết kế, và có portfolio đủ mạnh để phỏng vấn backend/full-stack thực chiến".

Nếu bạn cần rút xuống 6 tuần:

- gộp tuần 1 + 2
- gộp tuần 6 + 7
- vẫn giữ tuần 4, 5, 8 vì đây là các vùng giá trị cao nhất

## Cách dùng roadmap này

- Mỗi tuần chỉ chọn một flow chính để theo đuổi đến cùng.
- Không học tản mạn nhiều service cùng lúc khi chưa hiểu luồng dữ liệu.
- Mỗi tuần phải có đầu ra hữu hình: note, test, PR nhỏ, benchmark, diagram, hoặc feature hoàn chỉnh.
- Khi đọc code, luôn lần theo đúng layering: `handler -> service -> repository`.

## Tuần 1: Dựng Runtime Và Đọc Luồng Tổng

Mục tiêu:

- chạy được local stack
- hiểu thành phần nào là source of truth
- lần được 1 request từ UI tới DB

Việc cần làm:

1. Đọc `README.md`, `LOGIC_FLOW.md`, `AGENTS.md`.
2. Chạy local bằng `make compose-up` hoặc workflow tương đương.
3. Mở `deployments/docker/docker-compose.yml`, `api-gateway/cmd/main.go`, `frontend/src/app/app.tsx`.
4. Theo dấu 1 route storefront đơn giản như catalog hoặc product detail.
5. Vẽ lại sơ đồ dữ liệu riêng của bạn: Browser -> Gateway -> Service -> Repo -> DB.

File nên mở:

- `api-gateway/cmd/main.go`
- `api-gateway/internal/proxy/service_proxy.go`
- `frontend/src/pages/storefront/catalog-page.tsx`
- `frontend/src/services/api/modules/product-api.ts`
- `services/product-service/cmd/main.go`

Đầu ra tuần này:

- một note 1-2 trang về kiến trúc repo
- một diagram tự vẽ cho flow catalog

Kỹ năng luyện:

- Docker Compose
- đọc code theo flow
- phân biệt boundary HTTP, gRPC, event

## Tuần 2: Nắm Chắc Frontend Data Flow

Mục tiêu:

- hiểu cách frontend gọi API
- hiểu state nào là local, state nào đến từ backend
- tự sửa một bug UI nhỏ và verify được

Việc cần làm:

1. Đọc `frontend/src/services/api/`, `frontend/src/features/`, `frontend/src/pages/`.
2. Theo flow của `catalog-page`, `product-detail-page`, `checkout-page`.
3. Hiểu `useHomeWorkbook`, `useCart`, `useAuth`.
4. Sửa một bug nhỏ ở storefront và viết hoặc cập nhật test Vitest.

File nên mở:

- `frontend/src/services/api/http-client.ts`
- `frontend/src/services/api/normalizers.ts`
- `frontend/src/features/cart/providers/cart-provider.tsx`
- `frontend/src/features/auth/providers/auth-provider.tsx`
- `frontend/src/pages/storefront/checkout-page.tsx`

Đầu ra tuần này:

- một PR UI nhỏ có test
- một note mô tả data flow của checkout

Kỹ năng luyện:

- React + TypeScript
- async state
- API envelope và error mapping
- test UI với Vitest

## Tuần 3: Product Service Và SQL Cơ Bản

Mục tiêu:

- hiểu flow CRUD và listing ở backend Go
- đọc được query, pagination, validation
- tự thêm một filter hoặc trường trả về

Việc cần làm:

1. Đọc `services/product-service/internal/handler`, `service`, `repository`.
2. Theo flow list products và get product by id.
3. Xem migration và index liên quan tới listing.
4. Thêm một filter nhỏ hoặc cải thiện response field.
5. Viết test cho service/repository tương ứng.

File nên mở:

- `services/product-service/internal/service/product_service.go`
- `services/product-service/internal/service/storefront_service.go`
- `services/product-service/internal/repository/*`
- `services/product-service/migrations/000003_add_products_listing_index.up.sql`

Đầu ra tuần này:

- một PR backend nhỏ đi trọn `handler -> service -> repository -> test`

Kỹ năng luyện:

- Go service layering
- SQL query đọc
- pagination
- migration và index

## Tuần 4: Order Pricing, Coupon Và Checkout

Mục tiêu:

- hiểu luồng tạo đơn là flow nghiệp vụ lõi
- nắm pricing preview, coupon, shipping method
- tự tin sửa checkout mà không phá contract

Việc cần làm:

1. Đọc toàn bộ flow preview order và create order.
2. So sánh payload frontend gửi với DTO backend nhận.
3. Trace đường đi của coupon từ UI đến DB.
4. Viết test cho một nhánh lỗi hoặc nhánh edge case của checkout.
5. Ghi ra các invariant đang có và invariant còn thiếu.

File nên mở:

- `frontend/src/pages/storefront/checkout-page.tsx`
- `services/order-service/internal/handler/order_handler.go`
- `services/order-service/internal/service/order_pricing.go`
- `services/order-service/internal/service/order_lifecycle.go`

Đầu ra tuần này:

- tài liệu ngắn về checkout contract
- test bổ sung cho checkout hoặc preview pricing

Kỹ năng luyện:

- business rule
- DTO mapping
- invariant thinking
- debugging cross-layer

## Tuần 5: Payment, Webhook Và Idempotency

Mục tiêu:

- hiểu payment là nơi rủi ro production cao nhất
- nắm retry-safety, webhook replay, duplicate side effect
- có một đề tài portfolio mạnh

Việc cần làm:

1. Đọc create payment, refund, webhook MoMo.
2. Ghi ra các chỗ có thể bị duplicate nếu retry.
3. Thiết kế hoặc implement thêm idempotency key cho một nhánh quan trọng.
4. Viết test mô phỏng duplicate webhook hoặc retry payment.

File nên mở:

- `services/payment-service/internal/service/payment_processing.go`
- `services/payment-service/internal/service/payment_refunds.go`
- `services/payment-service/internal/handler/payment_handler.go`
- `services/payment-service/internal/repository/payment_repository.go`

Đầu ra tuần này:

- một PR hoặc proposal về idempotency/webhook hardening

Kỹ năng luyện:

- webhook design
- errors.Is / domain error
- transaction safety
- payment risk analysis

## Tuần 6: Event-Driven Flow Và Notification

Mục tiêu:

- hiểu rõ async side effect thay vì chỉ sync HTTP
- nắm outbox/inbox pattern
- đọc được message lifecycle từ publish tới consume

Việc cần làm:

1. Đọc outbox ở order/payment service.
2. Đọc inbox và consumer của notification service.
3. Theo một event từ lúc order/payment phát ra tới lúc email được gửi.
4. Thêm metric, log context, hoặc test cho consumer.

File nên mở:

- `services/order-service/internal/model/messaging.go`
- `services/payment-service/internal/model/messaging.go`
- `services/notification-service/internal/handler/event_handler.go`
- `services/notification-service/internal/inbox/redis_store.go`
- `docs/deep-dive/order-payment-outbox-inbox.md`

Đầu ra tuần này:

- một sequence diagram cho async flow
- một PR nhỏ về observability hoặc retry handling

Kỹ năng luyện:

- RabbitMQ
- message dedupe
- eventual consistency
- observability cho worker

## Tuần 7: Performance, Query Và Observability

Mục tiêu:

- ngừng tối ưu theo cảm giác
- biết dùng số liệu để quyết định
- luyện cách nhìn hệ thống như senior

Việc cần làm:

1. Chọn một hot path như product listing, order report, review summary.
2. Xem metric/tracing hiện có.
3. Chạy benchmark hoặc profile.
4. Nếu là SQL hot path, dùng `EXPLAIN ANALYZE`.
5. Viết note trước/sau tối ưu.

Vùng nên ưu tiên:

- list endpoint admin/order
- listing product nhiều filter
- checkout preview
- review aggregation

Đầu ra tuần này:

- benchmark note hoặc report tối ưu
- một PR giảm query count, latency, hoặc allocation

Kỹ năng luyện:

- Prometheus / tracing
- benchmark / pprof
- query tuning
- performance communication

## Tuần 8: Portfolio Feature Hoàn Chỉnh

Mục tiêu:

- hoàn thành một feature đủ sâu để đưa vào CV/portfolio
- chứng minh bạn không chỉ sửa bug nhỏ mà còn ship được flow production-minded

Feature nên chọn một:

1. Idempotent payment + webhook replay protection.
2. Inventory reservation transaction-safe cho checkout.
3. Order/admin listing chuyển khỏi `COUNT(*) + OFFSET`.
4. Returns/refund portal cơ bản với timeline rõ ràng.
5. Promotion engine cơ bản hơn: giới hạn usage, min order, expiry, admin validation.

Checklist đầu ra:

- có docs ngắn
- có test
- có observability
- có rollback/failure mode note
- có demo script local

Kỹ năng luyện:

- đóng feature end-to-end
- trade-off reasoning
- viết PR như engineer production

## Các vùng giá trị cao nhất để luyện tập và làm portfolio

- `order-service`: giá trị cao nhất vì chạm transaction, pricing, coupon, state machine.
- `payment-service`: rất tốt để nói về idempotency, webhook, retry, reliability.
- `notification-service`: tốt để thể hiện hiểu biết async architecture.
- `product-service`: phù hợp để luyện SQL, pagination, search, media integration.
- `frontend/checkout + product detail`: tốt để thể hiện full-stack thinking và UX + contract alignment.

## Kỹ năng cần có để thành thạo repo này

- Go, `context`, interface hợp lý, error wrapping
- SQL, migration, index, transaction
- Redis, RabbitMQ, gRPC, HTTP
- React + TypeScript + test frontend
- Docker Compose, env config, local ops
- structured logging, Prometheus, tracing
- security basics: auth/authz, webhook verify, input validation

## Gợi ý chức năng nên làm tiếp để tăng giá trị dự án

Nhóm nên ưu tiên trước:

1. Idempotency đầy đủ cho payment/webhook path.
2. Inventory reservation hoặc stock deduction transaction-safe.
3. Returns/RMA flow cơ bản thay vì chỉ refund.
4. Order timeline chi tiết hơn cho customer.
5. Admin audit trail rõ hơn cho các thay đổi nhạy cảm.

Nhóm mạnh về portfolio:

1. Recommendation rail dựa trên category + purchase history.
2. Search ranking và faceted filtering tốt hơn.
3. Loyalty points / membership tier.
4. Saved payment methods và payment retry UX tốt hơn.
5. Shipping carrier integration + tracking events.

## Cách tự đánh giá sau 8 tuần

Bạn đang tiến bộ đúng hướng nếu bạn có thể:

- giải thích luồng checkout từ UI tới DB mà không nhìn note
- chỉ ra transaction nào đang giữ invariant và invariant nào còn hở
- tự viết test cho một bug mới trước khi sửa
- đọc log/trace để tìm lỗi thay vì đoán
- đề xuất feature mới mà không phá layering hiện có
