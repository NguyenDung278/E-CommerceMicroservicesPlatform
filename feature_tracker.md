# 🚀 Feature Tracker & Lộ Trình Lên Senior Backend

Tệp này theo dõi các tính năng hữu ích sẽ triển khai vào E-Commerce Platform. Thiết kế của các tính năng này không chỉ làm sản phẩm xịn hơn, mà mục tiêu TỐI THƯỢNG là **rèn luyện kỹ năng thực chiến của bạn** trên hành trình chinh phục mức lương và trình độ của một Senior Go Developer.

> **Triết lý thiết kế (Mệnh lệnh từ AGENTS.md):** 
> *Ưu tiên giải pháp Robust đơn giản nhất.* Không tuỳ tiện thêm Microservice rác, không thêm Database mới nếu không thực sự 100% cần thiết. Hãy bóp nghẹt giới hạn của Go, PostgreSQL, Redis và RabbitMQ hiện có.

---

## 🟢 Giai đoạn 1: Master Nền tảng (Trình độ Fresher -> Mid)
*Mục tiêu: Đạt độ cứng cáp với CRUD nâng cao, Middleware và xử lý SQL mượt mà.*

- [ ] **1. Phân trang tốc độ cao (Cursor-based Pagination) ở `product-service`**
  - **Mô tả:** Viết lại API lấy danh sách sản phẩm. Chuyển từ kiểu phân trang `Offset / Limit` truyền thống (rất chậm ở các trang cuối với DB hàng triệu dòng) sang dùng `Cursor-based` (trả về id con trỏ cuối cùng).
  - **Kỹ năng mở khoá:** Tối ưu hiệu năng SQL Query, Thiết kế API High-Performance.

- [ ] **2. Middlewares - Rate Limiting & GZIP ở `api-gateway`**
  - **Mô tả:** Tự tay viết một Middleware trong Echo để chặn các IP spam quá 60 requests / phút (dùng bộ đệm in-memory `golang.org/x/time/rate`). Viết thêm middleware nén body trả về bằng Gzip để tiết kiệm băng thông.
  - **Kỹ năng mở khoá:** System Reliability (Chống DDoD cấp thấp), Am hiểu Golang HTTP Server middleware pattern.

- [ ] **3. Phục hồi dữ liệu (Soft Delete) ở `user-service`**
  - **Mô tả:** Thêm trường `deleted_at` vào bảng User. API Xoá tài khoản thực chất chỉ `UPDATE deleted_at`. Khi đăng nhập phải filter chặn người đã xoá. Viết cronjob / worker để hard delete hẳn khỏi DB sau 30 ngày.
  - **Kỹ năng mở khoá:** Thao tác Migration/SQL phức tạp, Batch Job processing.

---

## 🟡 Giai đoạn 2: Xử lý Đồng thời & Phân Tán (Trình độ Mid -> Strong Mid)
*Mục tiêu: Giải quyết tận gốc nỗi đau "Over-selling" và "Duplicate Transaction" của ngành TMĐT.*

- [ ] **4. Optimistic Concurrency Control (Cập nhật Tồn kho) ở `product-service`**
  - **Mô tả:** Chống Race-condition khi hai người cùng mua món hàng cuối cùng. Không dùng khoá Redis đắt tiền. Hãy thêm cột `version` vào bảng Product. Khi update stock, bắt buộc dùng mệnh đề SQL: `UPDATE products SET stock = stock - q, version = version + 1 WHERE id = X AND version = Y`. Nếu affected rows = 0 thì báo lỗi kẹt hàng.
  - **Kỹ năng mở khoá:** Xử lý Đồng thời (Concurrency) đa luồng mà không cần dùng gRPC Lock hay Redis Lock, tiết kiệm cost infra.

- [ ] **5. Idempotent API (Chống trùng lặp thanh toán) ở `payment-service`**
  - **Mô tả:** Xây dựng API Thanh toán chuẩn Ngân hàng: Yêu cầu Frontend gửi kèm Header `X-Idempotency-Key` (bản chất là chuỗi uuid frontend tự sinh mồi cho 1 lần click). Backend lưu tạm key xuống Redis. Nếu Client rớt mạng rồi bấm thanh toán lần 2 với cùng key đó, API sẽ bỏ qua và trả về kết quả thành công ảo của lần 1.
  - **Kỹ năng mở khoá:** Tiêu chuẩn Vàng cho khối FinTech, làm chủ Redis caching mechanism.

- [ ] **6. Xử lý "Bom nổ chậm" với Dead Letter Exchange ở `RabbitMQ` / `notification-service`**
  - **Mô tả:** Cấu hình queue của Gửi Email sao cho: Nếu việc gửi Email sinh lỗi (API third party sập), từ chối message và nhét vào Dead Letter Queue. Sau đó thử gửi lại (Retry) tối đa 3 lần theo nguyên tắc Exponential Backoff (chờ 10s, 30s, 60s). 
  - **Kỹ năng mở khoá:** Xử lý Hệ thống Hướng sự kiện (Event-driven) gãy đổ. Phỏng vấn vị trí Senior 90% sẽ hỏi câu này.

---

## 🔴 Giai đoạn 3: Trưởng thành Cấu trúc - Enterprise (Trình độ Senior)
*Mục tiêu: Đạt chuẩn Cloud-Native của hệ thống Lớn.*

- [ ] **7. Distributed Tracing (Centralized Log) xuyên suốt toàn Hệ thống**
  - **Mô tả:** Ta không thể debug dễ dàng nếu Gateway, Order, và Product mỗi nơi vứt log 1 kiểu. Hãy sinh ra một `X-Correlation-ID` ngay từ API Gateway. Đẩy ID này vào Golang `context.Context` xuyên suốt vòng đời Request, gửi nó qua Header chuẩn gRPC, và chèn vào mọi dòng log `zap` ở tất cả các Services.
  - **Kỹ năng mở khoá:** `context.WithValue` chuyên sâu, Observability & Telemetry (Một skill cốt tử của System Designer).

- [ ] **8. Saga Pattern - Cuộc vãn hồi (Compensating Transaction) ở `order-service`**
  - **Mô tả:** Đây là trùm cuối. Nếu tạo Order xong, nhưng dịch vụ trừ điểm thưởng hoặc tạo Payment ngầm bị lỗi (Mất kết nối MQ). Phải làm sao để rollback lại Order đó về "Huỷ" khi các dịch vụ khác nhau sở hữu Database khác nhau? Áp dụng Choreography Saga.
  - **Kỹ năng mở khoá:** Distributed Transaction - Cảnh giới cao nhất của Microservices. Hiểu được cái này, System Architecture Design không còn là trở ngại.

- [ ] **9. Graceful Shutdown & Zero-Downtime Deploy (Cho All Services)**
  - **Mô tả:** Đảm bảo khi tắt một cái Docker container hay K8s Pod, server Go không đứt rụp 1 phát giữa chừng. Phải viết đoạn code bắt tín hiệu `os/signal` SIGTERM. Ngừng nhận request mới, đợi mớ request đang chạy dở lưu DB xong rồi mới tự sát.
  - **Kỹ năng mở khoá:** Master Goroutine Control (`sync.WaitGroup`, `select`), Cloud Native Readiness.

---

## Kế hoạch của bạn (How to start)
Bạn thấy ngợp? Đừng ráng ôm đồm. 
1. Mỗi tuần hãy đánh dấu `[x]` vào đúng **một gạch đầu dòng duy nhất** từ Giai đoạn 1. 
2. Làm dựa trên cấu trúc các bước tại `docs/learning/09-how-to-add-new-feature.md`.
3. Làm xong tự kiểm tra theo Checklist và bắt AI review code. 
Hết tệp này, trình duyệt code của bạn sẽ cực kỳ bén nhọn.
