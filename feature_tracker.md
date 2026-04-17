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

---

## 6. 5 Gợi Ý Nên Làm Tiếp Ngay

Nếu chỉ chọn 5 việc có giá trị cao nhất trong giai đoạn này, mình khuyên ưu tiên:

1. `Chốt Vai Trò frontend/client`
2. `Async Refund Queue Observability`
3. `Shopper Return Experience hoàn chỉnh`
4. `Wishlist back-in-stock / price-drop alerts`
5. `Order/payment/return timeline dễ hiểu cho support và user`

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
