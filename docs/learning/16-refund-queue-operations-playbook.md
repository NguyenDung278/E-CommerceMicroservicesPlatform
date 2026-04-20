# Refund Queue Operations Playbook

Tài liệu này dành cho lúc `refund_pending` có dấu hiệu nghẽn, retry quá nhiều, hoặc dashboard/admin UI báo bất thường.

Mục tiêu:

- biết đọc `refund queue health` theo đúng ý nghĩa
- biết kiểm tra worker, payment-service, và lease theo thứ tự hợp lý
- giảm thời gian mò log khi refund queue bắt đầu chậm hoặc kẹt

---

## 1. Nhìn Gì Trước Tiên

Mở admin dashboard và xem `Refund queue health`.

Các tín hiệu quan trọng:

- `pending_count`: tổng số job `refund_pending`
- `ready_now_count`: số job có thể chạy ngay
- `ready_with_failures_count`: số job từng lỗi nhưng đã đến lượt retry lại
- `in_flight_count`: số job đang có worker giữ lease
- `stale_in_flight_count`: số job có dấu hiệu giữ lease quá lâu
- `failed_attempt_count`: số job đang mang lỗi gần nhất
- `max_attempt_count`: attempt cao nhất hiện có
- `oldest_pending_at`: job chờ lâu nhất
- `longest_in_flight_started_at`: job in-flight lâu nhất
- `next_retry_at`: mốc retry sớm nhất tiếp theo

---

## 2. Cách Đọc Nhanh Theo Triệu Chứng

### A. `pending_count` tăng nhưng `ready_now_count` cũng cao

Ý nghĩa thường gặp:

- worker không tiêu thụ kịp
- worker không chạy
- worker bị lỗi trước khi claim/complete

Nên kiểm tra:

1. log `order-service`
2. process worker có đang chạy không
3. payment-service có đang phản hồi chậm không

### B. `ready_with_failures_count` cao

Ý nghĩa thường gặp:

- queue đang retry liên tục
- lỗi downstream chưa được xử lý dứt

Nên kiểm tra:

1. `recent_failures`
2. lỗi có lặp cùng một pattern không
3. payment-service đang trả business error hay system error

### C. `stale_in_flight_count` > 0

Ý nghĩa thường gặp:

- worker giữ lease lâu hơn bình thường
- call sang payment-service bị treo/chậm
- worker panic/crash trước khi release flow

Nên kiểm tra:

1. `longest_in_flight_started_at`
2. log của worker quanh thời điểm đó
3. trace call sang payment-service
4. payment-service latency/error rate

### D. `max_attempt_count` cao

Ý nghĩa thường gặp:

- cùng một job retry quá lâu
- lỗi gốc chưa được xử lý
- có thể cần can thiệp tay

Nên kiểm tra:

1. `recent_failures`
2. idempotency key của refund
3. return/payment đó có đang ở trạng thái business-invalid không

---

## 3. Thứ Tự Kiểm Tra Khi Có Incident

1. Xác nhận dashboard health có đang fresh không
2. Xem `recent_failures`
3. Xem `stale_in_flight_count`
4. Xem log `order-service`
5. Xem log `payment-service`
6. Nếu cần, mở trace để xác nhận call nào chậm hoặc fail

---

## 4. Dấu Hiệu Cần Can Thiệp Tay

Nên cân nhắc can thiệp nếu:

- `stale_in_flight_count` không giảm trong nhiều vòng refresh
- `max_attempt_count` tăng liên tục
- cùng một `return_id` xuất hiện lặp đi lặp lại trong `recent_failures`
- payment-service đang trả lỗi business mà retry không giúp gì

Khi can thiệp tay, nên ghi rõ:

- `return_id`
- `order_id`
- lỗi gần nhất
- hướng xử lý đã chọn

---

## 5. Sau Khi Ổn Định

Sau incident, nên chụp lại:

- backlog cao nhất
- stale lease có xảy ra không
- lỗi downstream chính là gì
- cần thêm metric/alert/playbook nào nữa không

Mục tiêu không chỉ là xử lý xong một lần, mà là làm queue dễ vận hành hơn ở lần sau.
