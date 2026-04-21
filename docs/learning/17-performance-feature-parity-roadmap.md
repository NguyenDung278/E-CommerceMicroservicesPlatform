# Performance, Feature Parity, And Backend Learning Roadmap

Tài liệu này gom 4 thứ vào cùng một chỗ:

1. những tối ưu hiệu suất vừa đáng làm trong repo hiện tại
2. những gì backend đã có nhưng `frontend/` hoặc `client/` chưa khép kín
3. những chức năng backend nên ưu tiên bổ sung để tiến gần hơn tới một ứng dụng commerce hoàn chỉnh
4. những cụm source code đáng đọc nếu mục tiêu của bạn là phát triển sự nghiệp backend Golang

Mục tiêu không phải viết wish-list dài, mà là chỉ ra các bước tiếp theo có giá trị thực tế và có ích cho việc học nghề.

---

## 1. Tối ưu đã làm ngay trong repo

### 1.1. Batch admin payment history để cắt N+1 request ở admin ledger

Vấn đề cũ:

- `frontend/src/pages/admin/admin-page.tsx` tải một lô order rồi gọi tiếp từng request `payment history` cho từng order
- số request tăng theo số order hiển thị
- gateway và `payment-service` phải xử lý nhiều request nhỏ thay vì một request batch

Thay đổi đã làm:

- thêm endpoint batch `GET /api/v1/admin/payments/history`
- wire route qua `api-gateway`
- `payment-service` hỗ trợ load payment history cho nhiều `order_id` trong một query
- admin page chuyển sang một batch call cho cả lô order

Những file đáng đọc:

- `services/payment-service/internal/handler/payment_handler.go`
- `services/payment-service/internal/service/payment_queries.go`
- `services/payment-service/internal/repository/payment_repository.go`
- `api-gateway/internal/handler/payment_handler.go`
- `frontend/src/services/api/modules/admin-api.ts`
- `frontend/src/pages/admin/admin-page.tsx`

Giá trị backend học được:

- thiết kế batch endpoint không phá layering
- giảm fan-out request từ UI
- giữ data contract đủ đơn giản để frontend map lại dễ dàng

---

## 2. Những gì backend đã có nhưng frontend chưa khép kín

Phần này phân biệt rõ giữa 2 nhánh UI:

- `frontend/`: React + Vite, là admin/workbook app và UI local chính để verify runtime
- `client/`: Next.js App Router, là app dài hạn cho storefront/account

### 2.1. Wishlist parity giữa hai UI đã được khép kín

Backend đã có:

- `GET /api/v1/users/wishlist`
- `POST /api/v1/users/wishlist`
- `POST /api/v1/users/wishlist/sync`
- `DELETE /api/v1/users/wishlist/:productId`

Thay đổi đã làm:

- `client/` đã được nối sang wishlist API thật thay vì chỉ giữ localStorage
- vẫn giữ cơ chế guest wishlist trong localStorage để không làm xấu first session UX
- khi user đăng nhập, guest wishlist sẽ được sync lên account qua `/api/v1/users/wishlist/sync`

Giá trị học được:

- thiết kế provider có optimistic UI nhưng vẫn giữ source of truth ở backend
- chuyển dữ liệu tạm cục bộ thành account state mà không làm vỡ trải nghiệm guest
- chuẩn bị nền cho alert, retention, và personalization

### 2.2. Shopper return flow trong `client/` đã được khép kín

Backend đã có:

- tạo return
- list return theo user
- lấy return detail
- upload evidence
- admin queue và refund workflow

Hiện trạng UI:

- `frontend/` đã có `returns-page`, `return-detail-page`, upload evidence
- `client/` hiện đã có:
  - returns center `/returns`
  - return detail `/returns/[returnId]`
  - create return trực tiếp từ order detail
  - upload evidence trong return detail
  - account navigation dẫn tới returns center

Hệ quả:

- account experience trong `client/` đã khép kín được post-purchase lifecycle cơ bản
- shopper có thể đi hết flow `order detail -> create return -> upload evidence -> theo dõi refund`

### 2.3. Search assist/facet đã được nối sang `client/` catalog

Backend đã có:

- `GET /api/v1/products/search/assist`
- facet, suggestion, sort option, search result count

Hiện trạng UI:

- `frontend/` đã dùng search assist trong catalog/archive
- `client/` catalog hiện đã:
  - gọi `GET /api/v1/products/search/assist`
  - hiển thị suggestion chips theo backend
  - render facet counts cho category / brand / size / color
  - dùng sort options từ response backend
  - giữ fallback local khi assist endpoint lỗi

Hệ quả:

- App Router storefront giờ đã bám được capability discovery chính của product-service

### 2.4. Capability admin của backend được chốt giữ ở `frontend/`

Backend đã có:

- admin users / role update
- admin orders report
- admin returns queue health
- admin coupon management
- admin payment refund actions

Hiện trạng UI:

- `frontend/` có admin console khá rõ
- `client/` không còn là nơi nên tiếp tục nhân đôi admin surface

Hệ quả:

- repo tránh được việc đầu tư song song vào hai admin app
- `client/` tập trung vào shopper/account, còn `frontend/` tập trung vào admin/workbook

### 2.5. Payment method parity giữa hai nhánh UI đã được chốt cho local/runtime

Hiện trạng:

- backend/payment layer vẫn có thể rộng hơn một số surface UI
- `frontend/` checkout đã chốt `manual` và `momo`
- `client/` checkout nay cũng chỉ expose `manual` và `momo`

Điều cần làm:

- nếu sau này mở thêm method, chỉ bật UI khi flow end-to-end đã thật sự chạy được
- giữ docs/runtime nói rõ method nào là supported path trong môi trường local

### 2.6. Address và shipping contract đã được dọn về một source of truth đơn giản hơn

Hiện trạng:

- cả `frontend/` và `client/` hiện đã được đơn giản hoá về một trường địa chỉ duy nhất là `location`
- shared types và các normalizer ở UI đã phản ánh lại shape này để build/type-check sạch
- code backend hiện đã được cập nhật để:
  - `user-service` persist `location` cho default address và address book
  - `order-service` snapshot `shipping_location` trong order aggregate
  - migration gốc của hai service đã được dọn lại để tạo trực tiếp `location` và `shipping_location`

Trạng thái runtime:

- local Docker stack đã được reset sạch để áp schema baseline mới
- flow profile, address book, checkout, payment, order history đã được smoke-test lại trên runtime thật

Giá trị học được:

- khi repo học tập chưa có data thật, reset baseline migration đôi khi là quyết định tốt hơn backfill phức tạp
- contract evolution nên đi kèm verify runtime, không chỉ dừng ở build xanh

---

## 3. Những backend feature vừa được bổ sung và phần còn lại

### 3.1. Wishlist alerts + notification preferences đã có nền backend

Đã làm:

- `user-service` đã persist baseline price và baseline stock cho wishlist item
- thêm `GET /api/v1/users/wishlist/alerts`
- thêm `GET/PUT /api/v1/users/notification-preferences`
- `notification-service` đã đọc preference trước khi gửi event `order/payment/return`
- thêm wishlist alert poller trong `notification-service` để gửi email signal thật
- dedupe wishlist signal bằng Redis TTL để tránh spam cùng một alert
- `frontend/` và `client/` đã có surface toggle preference + feed wishlist alerts
- hỗ trợ topic theo domain cơ bản:
  - `order_updates`
  - `payment_updates`
  - `return_updates`
  - `wishlist_back_in_stock`
  - `wishlist_price_drop`
- `wishlist alerts` hiện detect được:
  - back-in-stock
  - price-drop

Đã khép kín thêm:

- `notification-service` hiện đã có in-app inbox và delivery history cho event `order/payment/return`
- `frontend/` và `client/` đều đã đọc inbox này thay vì chỉ dựng feed giả lập từ state cục bộ

Chưa khép kín:

- chưa có batching/digest policy nếu sau này muốn giảm tần suất email ở production lớn
- chưa có admin audit view riêng cho delivery ops nếu support cần tra soát tập trung

Vì sao đáng đọc:

- đây là ví dụ tốt về cách thêm retention capability mà vẫn giữ PostgreSQL và HTTP call đơn giản, không phải đẻ thêm stack

### 3.2. Return eligibility snapshot đã có

Đã làm:

- thêm `GET /api/v1/orders/:id/return-eligibility`
- snapshot trả về theo từng order item:
  - ordered quantity
  - already requested quantity
  - remaining quantity
  - eligible flag
  - reason
- rule hiện tại bám:
  - delivered status
  - return window 30 ngày
  - quantity đã request trước đó
- `frontend/` order detail đã dùng snapshot này để render CTA, quantity còn lại, và empty-state copy
- `client/` order detail hiện đã dùng snapshot này để:
  - hiển thị trạng thái returnable per line item
  - tạo return request trực tiếp từ order detail
  - refresh lại eligibility sau khi tạo return

Chưa khép kín:

- `CreateReturn` hiện chưa reuse snapshot này như một guard tập trung ở boundary handler/service path

Vì sao đáng đọc:

- đây là kiểu backend rule aggregation giúp frontend không phải đoán business rule

### 3.3. Batch product lookup đã đủ ở backend, không cần đẻ thêm service

Hiện trạng:

- repo đã có `GET /api/v1/products/batch`
- API này đã được dùng lại trong `user-service` để dựng wishlist baseline và alert

Hướng đúng tiếp theo:

- tận dụng `products/batch` cho order history, return detail, payment history ở UI
- chỉ cân nhắc endpoint tổng hợp mới nếu thật sự đo được fan-out lớn hoặc UI map quá phức tạp

Vì sao đây là quyết định tốt:

- bám nguyên tắc đơn giản nhất nhưng robust
- tránh thêm composite service không cần thiết khi một batch read API đã đủ mạnh

### 3.4. Search analytics nhẹ đã có

Đã làm:

- `product-service` đã ghi search analytics nhẹ vào PostgreSQL
- có summary admin endpoint `GET /api/v1/products/analytics/search`
- `frontend/` admin console đã có section top queries + zero-result queries
- track được:
  - top queries
  - zero-result queries
  - average result count
  - source giữa `catalog` và `assist`

Chưa khép kín:

- chưa track click-through hay filter-combination vì hiện tại muốn giữ scope nhẹ, không thêm stack mới
- `client/` chưa có admin surface tương ứng nếu sau này muốn hội tụ admin vào một app

Vì sao đáng đọc:

- đây là ví dụ tốt về analytics đủ dùng bằng PostgreSQL aggregate table thay vì đẩy ngay sang hệ thống event analytics riêng

### 3.5. Address persistence parity cho profile và checkout

Nên thêm:

- giữ migration baseline sạch cho cả `user-service` và `order-service`
- reset sample data cho môi trường học tập khi schema contract thay đổi lớn
- giữ contract địa chỉ ở một trường `location` thay vì tách `street/ward/district/city`
- validation rõ cho `location` ở boundary, không đẩy rule mơ hồ sang UI

Vì sao đáng làm:

- đây là nền tảng để order detail, return pickup, support flow, invoice/shipping label làm việc đúng
- rất hợp để học migration an toàn, model evolution, và contract compatibility trong Go service thực tế

---

## 4. 5 ưu tiên nên làm tiếp nếu mục tiêu là hoàn chỉnh sản phẩm

1. Giữ `frontend/` tập trung vào admin/workbook, không mở thêm nhánh feature shopper mới trừ parity fix.
2. Nếu muốn đi xa hơn ở backend search, thêm conversion-ish signal sau lớp query/click/filter analytics hiện có.
3. Làm sâu delivery ops cho `notification-service` theo channel/template sau lớp audit + backoff đã có.
4. Tiếp tục tối ưu các list/admin hot path còn phụ thuộc `COUNT(*) + OFFSET`.
5. Chỉ cân nhắc tách admin app riêng nếu `frontend/` thực sự trở thành nút thắt vận hành hoặc deploy.

---

## 5. 5 cụm source code đáng đọc nhất nếu muốn lên tay backend Golang

### 5.1. Order + payment idempotency

Đọc:

- `services/order-service/internal/service/order_lifecycle.go`
- `services/order-service/internal/service/order_idempotency.go`
- `services/payment-service/internal/service/payment_processing.go`
- `services/payment-service/internal/service/payment_idempotency.go`

Bạn sẽ học:

- request dedupe
- replay-safe write flow
- cách map idempotency conflict thành API contract rõ ràng

### 5.2. Outbox / inbox pattern

Đọc:

- `services/order-service/internal/service/order_events.go`
- `services/order-service/internal/repository/order_repository.go`
- `services/payment-service/internal/service/payment_events.go`
- `services/notification-service/internal/handler/event_handler.go`
- `services/notification-service/internal/inbox/redis_store.go`

Bạn sẽ học:

- publish event bền vững
- duplicate protection
- retry và lease semantics

### 5.3. Return refund queue

Đọc:

- `services/order-service/internal/service/order_returns.go`
- `services/order-service/internal/service/order_return_refund_worker.go`
- `services/order-service/internal/service/order_return_refund_metrics.go`
- `services/order-service/internal/repository/order_repository.go`

Bạn sẽ học:

- async workflow có retry
- idempotency giữa service với external dependency
- cách biểu diễn health/queue metrics cho ops

### 5.4. Cursor pagination và query shaping

Đọc:

- `services/product-service/internal/service/product_queries.go`
- `services/product-service/internal/repository/product_repository.go`
- `services/order-service/internal/repository/order_repository.go`

Bạn sẽ học:

- cursor payload design
- query theo sort key nhiều cột
- khi nào nên tránh `COUNT(*) + OFFSET`

### 5.5. Batch API để giảm fan-out

Đọc:

- `services/payment-service/internal/handler/payment_handler.go`
- `services/payment-service/internal/service/payment_queries.go`
- `services/payment-service/internal/repository/payment_repository.go`
- `frontend/src/pages/admin/admin-page.tsx`

Bạn sẽ học:

- tối ưu ở boundary giữa UI và service
- giảm request count mà không thêm hạ tầng phức tạp

---

## 6. Kết luận ngắn

Nếu mục tiêu là vừa hoàn thiện sản phẩm vừa học nghề backend tốt hơn, hướng đi đáng tiền nhất lúc này không phải thêm service mới hay stack mới.

Thứ đáng làm hơn là:

- giữ ownership giữa hai nhánh UI đủ rõ để không lặp công
- tiếp tục tối ưu những chỗ fan-out hoặc query shape chưa đẹp
- ưu tiên các flow có idempotency, transaction, queue, observability rõ ràng

Đó cũng chính là những bài học có giá trị cao nhất cho một backend developer Golang đang muốn tiến gần hơn tới production work.
