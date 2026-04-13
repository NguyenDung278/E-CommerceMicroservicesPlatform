# Bảng Theo Dõi Triển Khai Dự Án

Cập nhật lần cuối: 2026-04-13

Tài liệu này ghi lại trạng thái triển khai theo lát cắt chức năng đang được phát triển mạnh nhất trong repo. Mục tiêu là để người mới vào dự án có thể:

- hiểu nhanh back-end đã làm đến đâu
- biết mỗi function dùng để làm gì, nhận gì, trả gì
- thấy rõ test nào đã có và phần nào còn thiếu
- bám đúng luồng dữ liệu thật của mã nguồn hiện tại

Phạm vi ưu tiên hiện tại:

- `services/order-service`
- `services/payment-service`
- `services/notification-service`
- `api-gateway`
- `frontend` cho các bề mặt admin/storefront liên quan đến order, payment, returns

Nếu có mâu thuẫn giữa file này và source code, hãy ưu tiên source code.

## Mục lục

- [1. Tóm tắt trạng thái](#1-tóm-tắt-trạng-thái)
- [2. Back-end](#2-back-end)
- [3. Front-end](#3-front-end)
- [4. Test, coverage và cách verify](#4-test-coverage-và-cách-verify)
- [5. Gợi ý mở rộng tiếp theo](#5-gợi-ý-mở-rộng-tiếp-theo)

## 1. Tóm tắt trạng thái

### Nhãn trạng thái

- `done`: đã có trong source, chạy được, có test hoặc verify rõ ràng
- `in progress`: đã có scaffold hoặc logic chính, nhưng còn thiếu hardening hoặc test sâu hơn
- `todo`: chưa bắt đầu hoặc mới ở mức roadmap

### Snapshot hiện tại

| Hạng mục | Trạng thái | Ghi chú |
| --- | --- | --- |
| Payment idempotency cho `POST /api/v1/payments` | `done` | Có replay, conflict detection, test service |
| Returns/RMA cơ bản | `done` | Tạo return, xem chi tiết, xem theo order, đổi trạng thái |
| `refund_pending` production-safe | `done` | Queue nội bộ, worker async, retry-safe, idempotent refund call |
| `return.*` outbox + notification | `done` | `order-service` phát event, `notification-service` consume |
| Admin returns timeline UI + queue health | `done` | Danh sách, filter, pagination, timeline, queue health, recent failures, responsive |
| User-facing returns portal | `done` | Có trang `/returns`, route account, form tạo return ngay tại order detail |
| Returns evidence upload, shipping label, SLA | `todo` | Chưa có bề mặt UI và integration tương ứng |

## 2. Back-end

### 2.1 Order Service: returns, `refund_pending`, outbox

| Layer | Function | File | Mục đích | Input chính | Output / side effect | Trạng thái | Test liên quan |
| --- | --- | --- | --- | --- | --- | --- | --- |
| handler | `CreateReturn` | `services/order-service/internal/handler/order_handler.go` | Nhận request tạo return, validate boundary, gọi service | `order_id`, JWT claims, `dto.CreateReturnRequest` | `201` với `ReturnRequest` | `done` | `TestCreateReturnRouteCreatesRequestedReturn` |
| handler | `ListOrderReturns` | `services/order-service/internal/handler/order_handler.go` | Liệt kê return theo order cho user/operator | `order_id`, JWT claims | `200` với `[]ReturnRequest` | `done` | Verify qua route và compile |
| handler | `ListUserReturns` | `services/order-service/internal/handler/order_handler.go` | Liệt kê return theo user hiện tại với filter/pagination cho storefront account | JWT claims, `query`, `status`, `page`, `limit` | `200` với `[]ReturnRequest` + `meta` | `done` | `TestListUserReturnsRouteReturnsMeta` |
| handler | `GetReturn` | `services/order-service/internal/handler/order_handler.go` | Xem chi tiết một return theo quyền actor | `return_id`, JWT claims | `200` với `ReturnRequest` | `done` | Verify qua route và compile |
| handler | `UpdateReturnStatus` | `services/order-service/internal/handler/order_handler.go` | Cho staff/admin đổi trạng thái return | `return_id`, `dto.UpdateReturnStatusRequest` | `200` với return đã cập nhật | `done` | `TestAdminUpdateReturnStatusRouteUpdatesReturn` |
| handler | `RequestReturnRefund` | `services/order-service/internal/handler/order_handler.go` | Queue hoặc retry refund async cho return | `return_id`, actor claims, `dto.RequestReturnRefundRequest` | `202` với trạng thái `refund_pending` hoặc `409` nếu worker đang xử lý | `done` | `TestAdminRequestReturnRefundRouteQueuesRefundPending`, `TestAdminRequestReturnRefundRouteReturnsConflictWhenRefundIsInFlight` |
| handler | `ListAdminReturns` | `services/order-service/internal/handler/order_handler.go` | Liệt kê toàn bộ returns cho backoffice có filter và meta phân trang | `query`, `status`, `page`, `limit` | `200` với `[]ReturnRequest` + `meta` | `done` | `TestListAdminReturnsRouteReturnsMeta` |
| handler | `GetReturnQueueHealth` | `services/order-service/internal/handler/order_handler.go` | Trả snapshot queue `refund_pending` cho admin dashboard | JWT claims staff/admin | `200` với `ReturnQueueHealth` | `done` | `TestGetReturnQueueHealthRouteReturnsSnapshot` |
| service | `CreateReturn` | `services/order-service/internal/service/order_returns.go` | Chặn over-return, kiểm tra order delivered, tạo item/event/outbox | `order_id`, `user_id`, `user_email`, DTO items | Tạo `return.requested` trong Postgres + outbox | `done` | `TestCreateReturnCreatesRequestedReturnForDeliveredOrder`, `TestCreateReturnRejectsQuantityAbovePurchasedAmount`, `TestCreateReturnRejectsAlreadyReturnedQuantity` |
| service | `ListUserReturns` | `services/order-service/internal/service/order_returns.go` | Chuẩn hóa pagination cho user portal và ép scope theo `user_id` hiện tại | `user_id`, `model.ReturnFilters` | `returns`, `total` | `done` | `TestListUserReturnsNormalizesPaginationAndScopesUser` |
| service | `ListAdminReturns` | `services/order-service/internal/service/order_returns.go` | Chuẩn hóa bounds cho filter/pagination trước khi chạm repo | `model.ReturnFilters` | Trả `returns`, `total` | `done` | `TestListAdminReturnsNormalizesPaginationBounds` |
| service | `GetReturnQueueHealth` | `services/order-service/internal/service/order_returns.go` | Bọc repository snapshot để admin UI lấy queue health | `context.Context` | `ReturnQueueHealth` | `done` | `TestGetReturnQueueHealthReturnsRepositorySnapshot` |
| service | `UpdateReturnStatus` | `services/order-service/internal/service/order_returns.go` | Kiểm tra transition, build outbox status mới | `return_id`, status, actor info, message | Ghi event + outbox trong transaction | `done` | `TestUpdateReturnStatusTransitionsApprovedAndWritesOutbox`, `TestUpdateReturnStatusRejectsInvalidTransition`, `TestUpdateReturnStatusRejectsInvalidStatus`, `TestUpdateReturnStatusReturnsNilWhenStatusIsUnchanged` |
| service | `RequestReturnRefund` | `services/order-service/internal/service/order_returns.go` | Chuẩn bị metadata refund, phát `return.refund_pending`, tránh double-queue khi worker đang giữ lease | `return_id`, actor info, message | Return chuyển sang `refund_pending`, chưa gọi external refund ngay | `done` | `TestRequestReturnRefundQueuesRefundPending`, `TestRequestReturnRefundRejectsWhileWorkerOwnsLease`, `TestRequestReturnRefundReturnsNilWhenAlreadyRefunded`, `TestRequestReturnRefundRejectsRequestedStatus`, `TestRequestReturnRefundRetriesExistingPendingRefundWithoutRepricing` |
| service | `prepareReturnRefund` | `services/order-service/internal/service/order_returns.go` | Tính `refund_amount`, tìm charge payment hợp lệ, sinh idempotency key | `ReturnRequest`, `Order`, `[]PaymentSummary` | Trả `ReturnRequest` đã sẵn sàng cho worker | `done` | Cover qua các test queue refund |
| service | `calculateReturnRefundAmount` | `services/order-service/internal/service/order_returns.go` | Tính tiền hoàn dựa trên item trả và phân bổ discount | `ReturnRequest`, `Order` | `float64` đã round | `done` | Cover qua queue refund / worker tests |
| service | `findRefundableChargePayment` | `services/order-service/internal/service/order_returns.go` | Tìm charge còn balance để refund | `[]PaymentSummary`, `amount` | `payment_id` hoặc lỗi nghiệp vụ | `done` | Cover qua queue refund tests |
| service | `StartReturnRefundWorker` | `services/order-service/internal/service/order_return_refund_worker.go` | Worker nền polling các return `refund_pending` | `context.Context` | Vòng lặp claim và xử lý refund | `done` | Verify qua compile và các hàm worker bên dưới |
| service | `flushPendingReturnRefunds` | `services/order-service/internal/service/order_return_refund_worker.go` | Claim batch returns đang đến hạn retry, xử lý lần lượt, lên lịch retry khi lỗi | `context.Context` | Gọi payment client, log, mark retry | `done` | `TestReturnRefundWorkerMarksFailureForRetry` |
| service | `processPendingReturnRefund` | `services/order-service/internal/service/order_return_refund_worker.go` | Gọi `payment-service` bằng idempotency key, hoàn tất return khi refund thành công | `ReturnRequest` đã được claim | Cập nhật `refunded`, ghi outbox `return.refunded` | `done` | `TestReturnRefundWorkerCompletesQueuedRefund` |
| repository | `ListReturns` | `services/order-service/internal/repository/order_repository.go` | Query danh sách returns có filter status/query + count + offset/limit | `model.ReturnFilters` | `[]ReturnRequest`, `total` | `done` | Cover qua service/handler list admin tests |
| repository | `GetReturnQueueHealth` | `services/order-service/internal/repository/order_repository.go` | Aggregate queue `refund_pending`, số job chờ, retry, in-flight và lỗi gần nhất | `context.Context` | `ReturnQueueHealth` | `done` | Cover qua service/handler queue health tests |
| repository | `ScheduleReturnRefund` | `services/order-service/internal/repository/order_repository.go` | Đổi status sang `refund_pending`, chèn `return_event`, chèn outbox trong cùng transaction | `ReturnRequest`, actor info, message, outbox | Transaction local trước khi worker chạy | `done` | Cover qua `RequestReturnRefund*` tests |
| repository | `ClaimPendingReturnRefunds` | `services/order-service/internal/repository/order_repository.go` | Claim job refund bằng `FOR UPDATE SKIP LOCKED`, lease và retry metadata | `limit`, `leaseDuration` | Danh sách returns đã claim | `done` | Cover qua worker tests |
| repository | `CompleteReturnRefund` | `services/order-service/internal/repository/order_repository.go` | Finalize return sau khi external refund thành công | `ReturnRequest`, actor info, outbox | `status=refunded`, `refund_payment_id`, event + outbox | `done` | Cover qua worker success test |
| repository | `MarkReturnRefundAttemptFailed` | `services/order-service/internal/repository/order_repository.go` | Lưu lỗi lần retry gần nhất và thời điểm thử lại | `return_id`, `lastError`, `nextRetryAt` | Trạng thái vẫn `refund_pending`, có metadata retry | `done` | Cover qua worker failure test |
| client | `RefundPayment` | `services/order-service/internal/client/payment_client.go` | Gọi admin refund endpoint của `payment-service` với service JWT và `Idempotency-Key` | `payment_id`, `amount`, `message`, `idempotencyKey` | Trả `PaymentSummary` hoặc map lỗi `400/404/409` | `done` | Cover qua worker success/failure path |

### 2.2 Order Service: model, DTO, migration

| Item | File | Mục đích | Trạng thái | Ghi chú |
| --- | --- | --- | --- | --- |
| `ReturnStatusRefundPending` + refund metadata | `services/order-service/internal/model/return.go` | Thêm trạng thái trung gian và metadata retry/refund | `done` | Có `refund_amount`, `refund_charge_payment_id`, `refund_payment_id`, `refund_last_error`, `refund_attempt_count`, `refund_requested_at`, `refund_completed_at`, `refund_next_retry_at`, `refund_processing_started` |
| `RequestReturnRefundRequest` | `services/order-service/internal/dto/order_dto.go` | DTO cho endpoint queue/retry refund | `done` | Body tối giản, có `message` tùy chọn |
| `UpdateReturnStatusRequest` | `services/order-service/internal/dto/order_dto.go` | Loại bỏ `refunded` khỏi transition thủ công | `done` | Refund giờ đi qua queue async |
| Migration `000007_extend_returns_refund_processing` | `services/order-service/migrations/000007_extend_returns_refund_processing.*.sql` | Thêm cột retry/idempotency/lease và check constraint mới cho `refund_pending` | `done` | Có index cho queue retry và charge payment lookup |

### 2.3 Payment Service: refund idempotency cho luồng returns

| Layer | Function | File | Mục đích | Input chính | Output / side effect | Trạng thái | Test liên quan |
| --- | --- | --- | --- | --- | --- | --- | --- |
| handler | `RefundPayment` | `services/payment-service/internal/handler/payment_handler.go` | Nhận `Idempotency-Key` cho refund admin/system | `payment_id`, actor claims, header `Idempotency-Key`, DTO refund | `201`, `400`, `404`, `409` | `done` | Verify qua payment service tests |
| service | `RefundPayment` | `services/payment-service/internal/service/payment_refunds.go` | Replay refund cũ nếu cùng key/hash, chặn reuse key sai payload | `payment_id`, actor info, `idempotencyKey`, DTO refund | Persist refund + outbox + audit | `done` | `TestRefundPaymentReplaysCompletedRequestByIdempotencyKey`, `TestRefundPaymentRejectsIdempotencyKeyReuseForDifferentPayload` |
| service | `hashRefundPaymentRequest` | `services/payment-service/internal/service/payment_idempotency.go` | Hash payload refund để so sánh replay/conflict | `paymentID`, `dto.RefundPaymentRequest` | Chuỗi hash | `done` | Cover qua service tests |
| service | `loadEnrichedPayment` | `services/payment-service/internal/service/payment_queries.go` | Nạp refund hoàn chỉnh từ order siblings thay vì phụ thuộc actor sở hữu payment | `*model.Payment` | Payment đã enrich | `done` | Cover qua refund replay tests |

### 2.4 Notification Service và Gateway

| Layer | Function | File | Mục đích | Trạng thái | Test / verify |
| --- | --- | --- | --- | --- | --- |
| notification | `returnEmailContent` | `services/notification-service/internal/handler/event_handler.go` | Gửi nội dung mail cho các trạng thái `requested`, `approved`, `received`, `refund_pending`, `refunded`, `rejected`, `cancelled` | `done` | `TestHandleMessageReturnApprovedAcknowledgesAndSendsEmail` + compile verify |
| notification | queue binding `return.*` | `services/notification-service/internal/messaging/queue_monitor.go` | Đảm bảo consumer nhận mọi event lifecycle của return | `done` | Compile verify |
| gateway | proxy `/api/v1/returns`, `/api/v1/returns/:id`, `/api/v1/orders/:id/returns` | `api-gateway/internal/handler/order_handler.go` | Expose returns surface cho user portal storefront/account | `done` | Compile verify |
| gateway | proxy `/api/v1/admin/returns`, `/api/v1/admin/returns/health`, `/api/v1/admin/returns/:id/status`, `/api/v1/admin/returns/:id/refund` | `api-gateway/internal/handler/order_handler.go` | Expose đầy đủ admin returns + queue health ra ngoài gateway | `done` | Compile verify |

### 2.5 Back-end còn thiếu

| Hạng mục | Trạng thái | Ghi chú |
| --- | --- | --- |
| Upload ảnh/bằng chứng cho return | `todo` | Chưa có object storage flow cho bằng chứng |
| Shipping label / carrier integration cho hàng trả | `todo` | Chưa có tạo mã vận đơn trả hàng |
| Metrics/Prometheus riêng cho worker refund | `in progress` | UI queue health đã có, nhưng chưa có metric time series và alert chuyên biệt |

## 3. Front-end

### 3.1 UI đã làm

| Surface | File / khu vực | Đã làm gì | Trạng thái | Test / verify |
| --- | --- | --- | --- | --- |
| Checkout spacing và padding | `frontend/src/pages/storefront/checkout-page.tsx`, CSS checkout | Cải thiện line-height, khoảng cách nội bộ và nhịp trình bày | `done` | Build pass, checkout tests đã được cập nhật ở các lần chỉnh trước |
| Workbook refresh | `frontend/src/features/home/use-home-workbook.ts`, `home-workbook.ts` | Giảm stale reload khi admin sync workbook/editorial content | `done` | `frontend/tests/use-home-workbook.test.tsx`, `frontend/tests/home-workbook.test.ts` |
| Admin order ledger | `frontend/src/features/admin/components/admin-orders-section.tsx` | Xem đơn gần đây, payment history, cancel/refund thủ công | `done` | Build pass |
| Admin returns timeline + queue health | `frontend/src/features/admin/components/admin-returns-section.tsx`, `frontend/src/pages/admin/admin-page.tsx`, `frontend/src/styles/pages/admin/admin-page.css` | Hiển thị danh sách trả hàng, trạng thái, lịch sử thao tác, filter, pagination, warning retry, queue health cards, recent failures, responsive | `done` | `frontend/tests/admin-returns-section.test.tsx`, `frontend/tests/api-contracts.test.ts`, `npm run build` |
| User returns center | `frontend/src/pages/account/returns-page.tsx`, `frontend/src/styles/pages/account/returns-page.css`, `frontend/src/app/app.tsx`, account sidebar | Có route `/returns`, filter, pagination, timeline, refund summary, responsive | `done` | `frontend/tests/returns-page.test.tsx`, `frontend/tests/api-contracts.test.ts`, `npm run build` |
| Return form ngay tại order detail | `frontend/src/pages/account/order-detail-page.tsx`, `frontend/src/styles/pages/account/order-detail-page.css` | Chọn line item còn khả dụng, nhập lý do, tạo return và xem timeline ngay trong order detail | `done` | `npm run build`, verify thủ công |
| Front-end API contract cho returns | `frontend/src/services/api/modules/order-api.ts`, `frontend/src/services/api/modules/admin-api.ts`, `frontend/src/services/api/index.ts`, `frontend/src/services/api/normalizers.ts` | Thêm `listReturns`, `listReturnsByOrder`, `getReturnById`, `createReturn`, `getReturnQueueHealth`, normalizer queue health | `done` | `frontend/tests/api-contracts.test.ts` |

### 3.2 UI còn thiếu

| Surface | Trạng thái | Ghi chú |
| --- | --- | --- |
| Bộ lọc theo khoảng ngày và operator ở admin returns | `todo` | Hiện tại mới có `query`, `status`, `page`, `limit` |
| Trang detail riêng `/returns/:id` | `todo` | Hiện user portal hiển thị list + link order detail, chưa có route detail tách riêng |
| Upload bằng chứng trả hàng ở storefront | `todo` | Chưa có ảnh/video/file cho từng line item |
| SLA card nâng cao và auto-refresh queue health | `in progress` | Đã có queue health cơ bản, nhưng chưa có auto refresh / latency / trend chart |

### 3.3 Ghi chú về cấu hình test FE

- Đã thêm `test.coverage` vào `frontend/vite.config.ts` và `frontend/vite.config.js` để tập trung coverage vào đúng hai file mới:
  - `src/features/admin/components/admin-returns-section.tsx`
  - `src/services/api/modules/admin-api.ts`
- Với user returns portal vừa thêm, phần verify hiện đi theo:
  - unit test cho `returns-page`
  - contract test cho `order-api`
  - `npm run build`
- Workflow `npm exec ... vitest --coverage` trong repo hiện tại đã tạo raw V8 coverage dưới `frontend/coverage/tmp/`, nhưng reporter text/cobertura chưa in ra summary cuối cùng qua cơ chế `npm exec` tạm thời.
- Vì vậy, phần verify FE hiện được chốt bằng:
  - unit tests cho component
  - contract tests cho API module
  - `npm run build`

## 4. Test, coverage và cách verify

### 4.1 Automated tests đã chạy pass

```bash
cd services/order-service
go test -run 'TestRequestReturnRefundQueuesRefundPending|TestRequestReturnRefundRejectsWhileWorkerOwnsLease|TestRequestReturnRefundReturnsNilWhenAlreadyRefunded|TestRequestReturnRefundRejectsRequestedStatus|TestRequestReturnRefundRetriesExistingPendingRefundWithoutRepricing|TestUpdateReturnStatusTransitionsApprovedAndWritesOutbox|TestUpdateReturnStatusRejectsInvalidTransition|TestUpdateReturnStatusRejectsInvalidStatus|TestUpdateReturnStatusReturnsNilWhenStatusIsUnchanged|TestListAdminReturnsNormalizesPaginationBounds|TestListUserReturnsNormalizesPaginationAndScopesUser|TestGetReturnQueueHealthReturnsRepositorySnapshot|TestReturnRefundWorkerCompletesQueuedRefund|TestReturnRefundWorkerMarksFailureForRetry|TestCreateReturnCreatesRequestedReturnForDeliveredOrder|TestCreateReturnRejectsQuantityAbovePurchasedAmount|TestCreateReturnRejectsAlreadyReturnedQuantity' ./internal/service
go test -run 'TestCreateReturnRouteCreatesRequestedReturn|TestAdminUpdateReturnStatusRouteUpdatesReturn|TestAdminRequestReturnRefundRouteQueuesRefundPending|TestAdminRequestReturnRefundRouteReturnsConflictWhenRefundIsInFlight|TestListAdminReturnsRouteReturnsMeta|TestListUserReturnsRouteReturnsMeta|TestGetReturnQueueHealthRouteReturnsSnapshot' ./internal/handler

cd ../payment-service
go test ./internal/service ./internal/handler

cd ../../api-gateway
go test -run '^$' ./...

cd ../../frontend
npm test -- --run tests/admin-returns-section.test.tsx tests/api-contracts.test.ts tests/returns-page.test.tsx
npm run build
```

### 4.2 Coverage đã đo cho back-end mới

Targeted coverage cho các hàm lõi của flow `refund_pending` và returns admin:

| Function | Coverage |
| --- | --- |
| `flushPendingReturnRefunds` | `81.2%` |
| `processPendingReturnRefund` | `81.8%` |
| `ListUserReturns` (service) | `87.5%` |
| `GetReturnQueueHealth` (service) | `100.0%` |
| `ListAdminReturns` | `85.7%` |
| `UpdateReturnStatus` | `83.3%` |
| `RequestReturnRefund` | `80.0%` |
| `ListUserReturns` (handler) | `88.9%` |
| `GetReturnQueueHealth` (handler) | `83.3%` |
| `calculateReturnRefundAmount` | `81.0%` |
| `prepareReturnRefund` | `84.4%` |

Lệnh đã dùng:

```bash
cd services/order-service
go test -coverprofile=coverage_returns.out -run 'TestRequestReturnRefundQueuesRefundPending|TestRequestReturnRefundRejectsWhileWorkerOwnsLease|TestRequestReturnRefundReturnsNilWhenAlreadyRefunded|TestRequestReturnRefundRejectsRequestedStatus|TestRequestReturnRefundRetriesExistingPendingRefundWithoutRepricing|TestUpdateReturnStatusTransitionsApprovedAndWritesOutbox|TestUpdateReturnStatusRejectsInvalidTransition|TestUpdateReturnStatusRejectsInvalidStatus|TestUpdateReturnStatusReturnsNilWhenStatusIsUnchanged|TestListAdminReturnsNormalizesPaginationBounds|TestReturnRefundWorkerCompletesQueuedRefund|TestReturnRefundWorkerMarksFailureForRetry|TestCreateReturnCreatesRequestedReturnForDeliveredOrder|TestCreateReturnRejectsQuantityAbovePurchasedAmount|TestCreateReturnRejectsAlreadyReturnedQuantity' ./internal/service
go tool cover -func=coverage_returns.out | grep 'order_returns.go\|order_return_refund_worker.go'

go test -coverprofile=coverage_returns_portal_service.out -run 'TestListUserReturnsNormalizesPaginationAndScopesUser|TestGetReturnQueueHealthReturnsRepositorySnapshot' ./internal/service
go tool cover -func=coverage_returns_portal_service.out | grep 'ListUserReturns\|GetReturnQueueHealth'

go test -coverprofile=coverage_returns_portal_handler.out -run 'TestListUserReturnsRouteReturnsMeta|TestListUserReturnsRouteReturnsEmptyArrayWhenRepoIsEmpty|TestGetReturnQueueHealthRouteReturnsSnapshot|TestGetReturnQueueHealthRouteReturnsEmptySnapshotWhenServiceReturnsNil' ./internal/handler
go tool cover -func=coverage_returns_portal_handler.out | grep 'ListUserReturns\|GetReturnQueueHealth'
```

### 4.3 Manual verify đề xuất

1. Chạy stack local bằng Docker Compose như flow chuẩn của repo.
2. Tạo một order có charge payment hoàn tất.
3. Đăng nhập user và vào `/orders/:id` hoặc `/returns`:
   - tạo return từ order detail
   - kiểm tra portal `/returns` có filter, pagination và timeline đúng
4. Vào admin dashboard:
   - lọc theo `requested`
   - bấm `Chấp nhận`
   - bấm `Đã nhận hàng` hoặc `Xếp hàng hoàn tiền`
5. Kiểm tra queue health admin:
   - `pending_count`, `ready_now_count`, `retry_scheduled_count`
   - danh sách lỗi gần nhất hiển thị `return_id`, `attempt_count`, `next_retry_at`
6. Kiểm tra dữ liệu:
   - bảng `returns`, `return_events`, `outbox_messages`
   - `refund_attempt_count`, `refund_last_error`, `refund_next_retry_at`
   - `payment-service` có refund row mới khi worker xử lý thành công
7. Kiểm tra mail/queue:
   - `notification-service` nhận `return.refund_pending` và `return.refunded`
   - mail không gửi nhầm cho staff/admin actor

### 4.4 Checklist deploy

- [ ] Chạy migration `services/order-service/migrations/000007_extend_returns_refund_processing.*.sql`
- [ ] Deploy đồng bộ `order-service`, `payment-service`, `notification-service`, `api-gateway`
- [ ] Đảm bảo `order-service` có thể gọi `payment-service` bằng service JWT hiện tại
- [ ] Kiểm tra RabbitMQ routing cho `return.*`
- [ ] Smoke test user portal `/returns` và return form tại `/orders/:id`
- [ ] Kiểm tra admin queue health card khớp dữ liệu thật trong DB
- [ ] Smoke test admin returns list, approve, received, refund queue, retry
- [ ] Kiểm tra log có `return_id`, `order_id`, `attempt_count`, `next_retry_at`
- [ ] Theo dõi bảng `returns` xem lease/retry metadata tăng đúng khi lỗi

## 5. Gợi ý mở rộng tiếp theo

### Ưu tiên cao

- Trang detail riêng cho từng return và deep link từ email/notification.
- Upload ảnh lỗi sản phẩm và bằng chứng nhận hàng cho return.
- Shipping label / carrier integration cho chiều trả hàng.
- Metrics/alert cho refund worker: độ trễ xử lý, retry rate, failure rate, age của queue.

### Ưu tiên portfolio

- Inventory reservation transaction-safe ở checkout.
- SLA / timeline hợp nhất cho `order.*`, `payment.*`, `return.*`.
- Recommendation hoặc recently viewed trên storefront.
- Return analytics dashboard: lý do trả hàng phổ biến, tỷ lệ refund thành công, thời gian xử lý trung bình.
