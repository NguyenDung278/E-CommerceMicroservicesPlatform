# Feature Tracker

File này chỉ theo dõi **những gì chưa làm hoặc chưa khép kín**.

Những feature đã chạy ổn trong source hiện tại sẽ không còn được liệt kê ở đây nữa, để tracker bớt nhiễu và dùng đúng như một backlog mở. Nếu cần xem hiện trạng toàn hệ thống, ưu tiên đọc:

- `README.md`
- `docs/README.md`
- `LOGIC_FLOW.md`

---

## Cách đọc tracker này

Các nhãn ưu tiên:

- `P0`: ảnh hưởng correctness, doanh thu, hoặc rủi ro production
- `P1`: rất nên làm để hoàn thiện sản phẩm và giảm nợ kỹ thuật
- `P2`: có giá trị nhưng chưa phải nút thắt lớn nhất hiện tại

Các nhãn trạng thái:

- `Open`: chưa bắt đầu hoặc chưa có implementation đáng kể
- `Partial`: đã có một phần nhưng flow chưa khép kín hoặc FE/BE chưa đồng bộ
- `Decision`: cần chốt hướng trước khi đầu tư thêm

---

## 1. Production Correctness Và Reliability

### P0 · Open · Stock Reservation / Allocation

Mục tiêu:

- giữ tồn kho trong thời gian ngắn khi user bước vào checkout hoặc chuẩn bị thanh toán
- tránh oversell khi nhiều người mua cùng lúc

Vì sao còn mở:

- hiện flow chủ yếu mới kiểm tra tồn khi preview/create order và hoàn tồn khi hủy đơn
- chưa có reserve transaction-safe theo kiểu allocation rõ ràng

Gợi ý triển khai:

- ưu tiên giải pháp đơn giản trong `product-service` hoặc `order-service`
- dùng PostgreSQL transaction + row lock trước khi nghĩ tới distributed lock
- làm rõ TTL release khi checkout/payment không hoàn tất

### P0 · Partial · Idempotency Cho Create Order

Mục tiêu:

- ngăn tạo trùng order khi client retry hoặc user bấm nhiều lần

Vì sao còn mở:

- `payment-service` đã có idempotency cho payment/refund
- nhưng `create order` vẫn là flow nên được harden thêm

Gợi ý triển khai:

- nhận `Idempotency-Key` ở order create path
- lưu mapping `user + key + request hash + order_id`
- replay an toàn nếu request giống hệt
- conflict nếu cùng key nhưng payload khác

### P0 · Partial · Guest Cart Merge Ở Backend

Mục tiêu:

- đưa logic merge guest cart xuống backend để thống nhất dữ liệu giỏ hàng

Vì sao còn mở:

- merge hiện vẫn chủ yếu nằm ở frontend provider
- gateway handler hiện không expose `POST /api/v1/cart/merge`

Gợi ý triển khai:

- thêm route thật ở gateway + cart-service
- merge theo product/variant/quantity ở server
- giữ logic client càng mỏng càng tốt

### P1 · Partial · Hardening Payment Retry Story

Mục tiêu:

- làm payment flow rõ ràng hơn khi timeout, redirect thất bại, hoặc webhook đến muộn

Vì sao còn mở:

- create payment và refund đã có idempotency
- nhưng end-to-end retry story giữa checkout UI, payment status polling, webhook replay, và order sync vẫn nên được document + verify sâu hơn

Gợi ý triển khai:

- bổ sung test replay/retry end-to-end
- làm rõ state transition trong docs và admin UI
- thêm metric cho replay/idempotent hit/conflict

---

## 2. Storefront Và Commerce UX

### P1 · Partial · Payment Method Parity Trên Frontend

Mục tiêu:

- làm cho frontend expose các payment method hợp lý hơn với backend capability

Vì sao còn mở:

- backend hỗ trợ nhiều method hơn
- frontend chính hiện mới thiên về `manual` và `momo`

Gợi ý triển khai:

- quyết định method nào thực sự muốn support trong runtime local
- chỉ expose method có flow hoàn chỉnh
- tránh để UI gợi ý những lựa chọn chưa dùng được

### P1 · Partial · Shopper Return Experience

Mục tiêu:

- hoàn thiện luồng đổi trả phía người dùng cuối

Vì sao còn mở:

- backend/admin return flow đã có nhiều phần mạnh
- nhưng shopper-facing return UX vẫn chưa là một hành trình commerce hoàn chỉnh

Gợi ý triển khai:

- return request form rõ lý do, ảnh chứng minh, timeline
- status copy dễ hiểu cho người dùng
- liên kết tốt hơn giữa order detail và return detail

### P1 · Open · Wishlist-Driven Retention

Mục tiêu:

- biến wishlist thành công cụ retention thay vì chỉ là nơi lưu món

Gợi ý:

- back-in-stock alerts
- price-drop alerts
- saved sizes / preferred fit
- handoff mượt hơn từ wishlist sang cart

### P2 · Partial · Search Và Discovery Nâng Cao

Mục tiêu:

- giúp user tìm sản phẩm tốt hơn khi catalog lớn lên

Vì sao còn mở:

- search cơ bản và Elasticsearch integration đã có nền
- nhưng autocomplete/fuzzy/faceted search sâu hơn vẫn chưa thành trải nghiệm mạnh

Gợi ý:

- autocomplete cho storefront search
- typo tolerance nếu dùng Elasticsearch
- facet rõ theo category/brand/size/color/price

---

## 3. Admin, Reporting, Và Vận Hành

### P1 · Partial · Admin Order Listing Scale Story

Mục tiêu:

- làm cho admin list/report bền hơn khi dữ liệu tăng

Vì sao còn mở:

- product catalog public đã có cursor pagination
- admin order listing vẫn thiên về `COUNT(*) + OFFSET/LIMIT`

Gợi ý triển khai:

- xác định endpoint nóng thật sự trước
- cân nhắc cursor hoặc pre-aggregated reporting path
- đo bằng query plan và latency trước khi tối ưu

### P1 · Partial · Async Refund Queue Observability

Mục tiêu:

- nhìn rõ hơn sức khỏe của refund queue và failure mode

Vì sao còn mở:

- hiện đã có metrics và admin surface khá tốt
- nhưng đây vẫn là vùng rất đáng đầu tư thêm vì chạm tiền và hậu mãi

Gợi ý:

- alerting rõ cho backlog tăng
- dashboard rõ retry age / stuck jobs
- playbook xử lý incident cho refund_pending

### P2 · Open · Order / Payment Audit Narrative Cho Support

Mục tiêu:

- giúp support/admin đọc được câu chuyện của đơn hàng và payment nhanh hơn

Gợi ý:

- timeline copy rõ hơn
- gom event kỹ thuật thành narrative dễ đọc
- link sâu giữa order detail, payment detail, return detail

---

## 4. Frontend Runtime Direction

### P1 · Decision · Chốt Vai Trò `frontend/` Và `client/`

Mục tiêu:

- tránh kéo dài trạng thái "2 UI cùng tồn tại nhưng không cùng mục tiêu"

Hiện trạng:

- `frontend/` vẫn là local UI chính và có admin surface rõ nhất
- `client/` đã có Docker profile riêng để smoke test, nhưng chưa là đường chạy mặc định

Điều cần chốt:

- storefront dài hạn có tiếp tục ở `frontend/` hay chuyển dần sang `client/`
- admin có ở lại `frontend/` hay tách app riêng
- CI/CD/publish image sẽ bám theo hướng nào

Nếu chưa chốt, đừng đầu tư refactor lớn theo cả hai hướng cùng lúc.

---

## 5. DevEx Và Docs

### P1 · Open · Postman / API Contract Collection Chính Thức

Mục tiêu:

- có một collection hoặc contract suite chính thức bám route thật

Vì sao nên làm:

- hiện route và helper cũ có chỗ đã lệch nhau
- tài liệu đã được cập nhật, nhưng collection sống sẽ giúp verify nhanh hơn

Gợi ý:

- build một Postman collection hoặc script-based smoke test từ gateway route thật
- ưu tiên auth, cart, order, payment, returns

### P1 · Open · End-To-End Verification Checklist Theo Flow

Mục tiêu:

- giảm tình trạng sửa UI xong nhưng không verify đủ backend, hoặc ngược lại

Gợi ý:

- tạo checklist riêng cho `catalog`, `checkout`, `payment`, `returns`
- mỗi flow nên có happy path + negative path + async verification

---

## 6. 5 Gợi Ý Nên Làm Tiếp Ngay

Nếu chỉ chọn 5 việc có giá trị cao nhất trong giai đoạn này, mình khuyên ưu tiên:

1. `Stock Reservation / Allocation`
2. `Idempotency Cho Create Order`
3. `Guest Cart Merge Ở Backend`
4. `Admin Order Listing Scale Story`
5. `Chốt Vai Trò frontend/client`

Đây là 5 việc cân bằng tốt giữa:

- correctness
- khả năng scale
- trải nghiệm người dùng
- giảm nợ kỹ thuật
- rõ hướng phát triển dài hạn

---

## 7. 5 Gợi Ý Nếu Muốn Tăng Giá Trị Sản Phẩm

Nếu mục tiêu là tăng chất lượng sản phẩm và conversion thay vì hardening thuần backend, hãy cân nhắc:

1. `Wishlist back-in-stock / price-drop alerts`
2. `Saved sizes / preferred fit`
3. `Shopper return experience hoàn chỉnh`
4. `Search autocomplete + facet rõ hơn`
5. `Order/payment/return timeline dễ hiểu cho support và user`

---

## 8. Cách Dùng Tracker Này

Khi một hạng mục đã hoàn thành thật sự:

- xóa nó khỏi tracker này
- cập nhật `README.md`, `LOGIC_FLOW.md`, hoặc docs domain liên quan nếu contract/runtime thay đổi

Khi phát sinh ý tưởng mới:

- chỉ thêm nếu nó là nhu cầu thật hoặc rủi ro thật
- tránh biến file này thành wish-list quá dài nhưng không có thứ tự ưu tiên

Mục tiêu của tracker là giúp team nhìn rõ:

- cái gì chưa xong
- cái gì đáng làm tiếp
- cái gì nên ưu tiên trước để repo tiến gần hơn tới một sản phẩm commerce production-ready
