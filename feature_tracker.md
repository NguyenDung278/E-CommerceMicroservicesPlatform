# Feature Tracker

File này chỉ theo dõi **những gì còn mở hoặc chưa khép kín giữa backend và các UI hiện tại**.

Nếu cần bức tranh đầy đủ hơn về runtime và định hướng học tập, ưu tiên đọc thêm:

- `README.md`
- `docs/README.md`
- `docs/learning/17-performance-feature-parity-roadmap.md`

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

### P1 · Partial · Shopper Return Flow Chưa Có Trong `client/`

Hiện trạng:

- backend đã có create/list/detail/evidence cho returns
- `frontend/` đã có returns center
- `client/` hiện mới đọc được `return eligibility` ở order detail
- `client/` vẫn chưa có returns center, return detail, create return, hoặc upload evidence

Tác động:

- App Router storefront/account chưa khép kín post-purchase lifecycle

Gợi ý:

- thêm returns list
- thêm return detail
- thêm create return từ order detail
- thêm upload evidence

### P1 · Partial · Payment Method Parity Giữa Hai UI Chưa Thống Nhất

Hiện trạng:

- `client/` expose nhiều method hơn
- `frontend/` checkout hiện nghiêng về `manual` và `momo`
- backend/payment layer đang rộng hơn một số surface UI

Gợi ý:

- chốt danh sách method thực sự muốn support cho local/runtime
- ẩn những method chưa có flow hoàn chỉnh

### P2 · Partial · Search Assist Và Facet Chưa Đồng Bộ Sang `client/`

Hiện trạng:

- backend đã có `search/assist`
- `frontend/` đã tận dụng facet/suggestion tốt hơn
- `client/` catalog chưa bám theo capability này

Gợi ý:

- autocomplete
- facet theo category/size/color/price
- sort option bám response backend

---

## 2. Admin, Reporting, Và Runtime Direction

### P1 · Partial · Admin Surface Mới Chỉ Thật Sự Hoàn Chỉnh Ở `frontend/`

Hiện trạng:

- backend đã có admin orders, payments, coupons, returns queue, users
- `frontend/` có admin console rõ hơn nhiều
- `client/` mới có rất ít admin-facing surface

Gợi ý:

- nếu `client/` là hướng dài hạn, cần plan migrate admin rõ ràng
- nếu không, nên giữ `frontend/` như admin app và nói rõ điều đó trong docs/runtime

### P1 · Decision · Chốt Vai Trò `frontend/` Và `client/`

Điều cần chốt:

- storefront dài hạn thuộc app nào
- admin ở lại `frontend/` hay tách riêng
- CI/CD và publish image sẽ bám app nào

Nếu chưa chốt, tránh refactor lớn theo cả hai hướng cùng lúc.

### P2 · Open · Order / Payment / Return Narrative Cho Support

Mục tiêu:

- giúp support đọc trạng thái đơn, payment, return nhanh hơn

Gợi ý:

- narrative timeline ít kỹ thuật hơn
- deep link giữa order detail, payment detail, return detail

---

## 3. 5 Việc Nên Ưu Tiên Tiếp

1. Hoàn thiện shopper return flow trong `client/`.
2. Chốt payment method parity giữa backend, `frontend/`, và `client/`.
3. Dùng search assist/facet thật trong `client/`.
4. Chốt vai trò dài hạn của `frontend/` và `client/`.
5. Thêm support narrative hoặc in-app inbox nếu muốn mở rộng notification experience sau lớp email hiện tại.

---

## 4. Cách Dùng Tracker Này

Khi một hạng mục hoàn thành thật sự:

- xóa nó khỏi tracker này
- cập nhật docs/runtime liên quan nếu contract hoặc hướng đi thay đổi

Khi thêm hạng mục mới:

- chỉ thêm nếu đó là nhu cầu thật hoặc risk thật
- tránh biến tracker thành wish-list quá dài nhưng không có thứ tự ưu tiên
