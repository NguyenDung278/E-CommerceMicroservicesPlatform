# Feature Tracker

File này chỉ theo dõi **những gì còn mở hoặc chưa khép kín giữa backend và các UI hiện tại**.

Nếu cần bức tranh đầy đủ hơn về runtime và định hướng học tập, ưu tiên đọc thêm:

- `README.md`
- `docs/README.md`
- `docs/learning/README.md`

---

## Cách đọc tracker này

Các nhãn ưu tiên:

- `P0`: correctness, rủi ro production, hoặc tạo lệch dữ liệu/account experience
- `P1`: rất nên làm để khép kín sản phẩm và giảm nợ kỹ thuật
- `P2`: có giá trị nhưng chưa phải nút thắt lớn nhất hiện tại

Các nhãn trạng thái:

- `Open`: chưa có implementation đáng kể
- `Partial`: backend đã có một phần mạnh nhưng UI/runtime chưa khép kín
- `Decision`: cần chốt hướng trước khi đầu tư thêm

---

## 1. Commerce UX Và Feature Parity

### P1 · Partial · Storefront Ownership Đã Được Promote, Còn Thiếu Rollout Discipline

Hiện trạng:

- `client/` là shopper app dài hạn cho storefront/account và đã được publish/deploy trong pipeline
- `frontend/` là admin/workbook app và vẫn chạy song song để hỗ trợ local operations
- rủi ro còn lại là vô tình thêm feature shopper mới vào `frontend/` khi đã có `client`

Gợi ý:

- giữ review discipline để feature shopper mới chỉ đi vào `client/`
- tiếp tục smoke test OAuth, payment return và asset pipeline trên `client` sau các lần đổi infra

### P1 · Partial · Admin Surface Cố Ý Ở `frontend/`, Chưa Nên Nhân Đôi Sang `client/`

Hiện trạng:

- backend đã có admin orders, payments, coupons, returns queue, users
- `frontend/` đã có admin console dùng được
- `client/` không nên tiếp tục nhận thêm admin surface trừ khi repo tách một admin app riêng

Gợi ý:

- ưu tiên làm sâu admin workflow trong `frontend/`
- dùng `client/` cho shopper/account, tránh lặp cùng một feature ở hai app

### P2 · Partial · Search Analytics Đã Có Query, Click, Và Filter-Level

Hiện trạng:

- backend đã có top queries, zero-result queries, click-through queries, và top filter combinations
- chưa có conversion-ish signal hoặc funnel từ search -> cart -> order

Gợi ý:

- nếu muốn đi xa hơn, thêm conversion-ish signal nhẹ trước khi nghĩ tới stack analytics riêng

### P2 · Partial · Notification Delivery Ops Đã Có Audit Và Exponential Backoff

Hiện trạng:

- đã có notification inbox, delivery history, preference gating, wishlist signals, admin audit, và exponential backoff
- chưa có digest policy hoặc delivery analytics sâu theo channel/template

Gợi ý:

- thêm delivery analytics sâu theo channel/template nếu support cần tối ưu vận hành email
- cân nhắc audit filtering theo routing key hoặc outcome khi backlog lớn hơn

---

## 2. 5 Việc Nên Ưu Tiên Tiếp

1. Giữ `frontend/` tập trung vào admin/workbook và tránh nhận thêm feature shopper mới.
2. Nếu muốn đi xa hơn ở search, thêm conversion-ish signal trước khi nghĩ tới stack analytics mới.
3. Làm sâu hơn delivery analytics cho `notification-service` theo channel/template nếu support cần.
4. Tiếp tục tối ưu các hot path admin còn dùng `COUNT(*) + OFFSET` khi dữ liệu lớn dần.
5. Cân nhắc tách admin app riêng chỉ khi `frontend/` thực sự trở thành nút thắt vận hành.

---

## 3. Cách Dùng Tracker Này

Khi một hạng mục hoàn thành thật sự:

- xóa nó khỏi tracker này
- cập nhật docs/runtime liên quan nếu contract hoặc hướng đi thay đổi

Khi thêm hạng mục mới:

- chỉ thêm nếu đó là nhu cầu thật hoặc risk thật
- tránh biến tracker thành wish-list quá dài nhưng không có thứ tự ưu tiên
