# 08. Lộ trình Phát triển Sự nghiệp Backend Golang (Career Path)

Chào mừng bạn đến với tài liệu quan trọng nhất để định hướng sự nghiệp của mình thông qua project này. Dự án E-commerce Microservices này không chỉ là một ứng dụng, mà là một **"giáo trình thực chiến"** giúp bạn từ một lập trình viên biết cú pháp Go trở thành một Backend Engineer thực thụ.

---

## 🚀 1. Tại sao dự án này giúp bạn thăng tiến?

Trong thị trường tuyển dụng Golang hiện nay, các công ty (đặc biệt là các công ty lớn như Shopee, Tiki, Grab, Gojek...) không chỉ tìm người biết code Go, mà tìm người hiểu:
1. **Kiến trúc hệ thống (System Architecture)**: Microservices, API Gateway.
2. **Giao tiếp giữa các service**: REST, gRPC, Message Queue (RabbitMQ).
3. **Quản lý dữ liệu**: SQL (PostgreSQL) vs NoSQL/Cache (Redis).
4. **Tính ổn định (Observability)**: Logging, Tracing, Metrics.

Dự án này hội tụ đủ 100% các yếu tố trên.

---

## 🎯 2. Lộ trình phát triển năng lực (Skill Mapping)

Hãy tự đánh giá và rèn luyện bản thân theo 3 cấp độ dựa trên codebase hiện tại:

### Cấp độ 1: Junior Backend Engineer (Nắm vững nền tảng)
*Mục tiêu: Hiểu cách một request đi từ client vào DB và trả về.*

- [ ] **Go Basics**: Hiểu `struct`, `interface`, `defer`, `context.Context` (Đọc [01-go-backend-foundations.md](./01-go-backend-foundations.md)).
- [ ] **REST API**: Hiểu cách Echo framework nhận request, bind JSON và trả response (Xem `user-service`).
- [ ] **SQL & Migration**: Hiểu cách viết SQL thuần (không ORM) và tại sao cần migration (Xem thư mục `migrations` ở các service).
- [ ] **Auth**: Hiểu JWT hoạt động như thế nào (Xem `pkg/middleware/auth.go`).

### Cấp độ 2: Mid-level Backend Engineer (Tư Duy Hệ Thống)
*Mục tiêu: Hiểu sự tương tác giữa các service và tính nhất quán dữ liệu.*

- [ ] **gRPC**: Hiểu tại sao dùng gRPC cho giao tiếp nội bộ thay vì HTTP (Xem `order-service` gọi `product-service`).
- [ ] **Redis Caching**: Hiểu sự khác biệt giữa lưu trữ bền vững (PostgreSQL) và lưu trữ tạm thời (Redis) (Xem `cart-service`).
- [ ] **Event-Driven**: Hiểu cách dùng RabbitMQ để tách rời các công việc tốn thời gian như gửi email/thông báo (Xem `notification-service`).
- [ ] **Transaction Management**: Hiểu cách bảo vệ dữ liệu khi tạo đơn hàng (Xem `order_service.go`).

### Cấp độ 3: Senior Backend Engineer (Optimization & Robustness)
*Mục tiêu: Đảm bảo hệ thống chạy tốt ở quy mô lớn và dễ vận hành.*

- [ ] **Observability**: Biết cách đọc Trace trong Jaeger để tìm bottleneck, đọc Grafana dashboard (Xem `pkg/logger` và các metrics endpoint).
- [ ] **Rate Limiting & Security**: Hiểu cách bảo vệ hệ thống khỏi tấn công brute-force hoặc spam (Xem `api-gateway` và redis rate limiter).
- [ ] **Error Handling Pattern**: Hiểu cách bọc lỗi (error wrapping) để trace log hiệu quả nhất.
- [ ] **Performance Tuning**: Tìm cách tối ưu SQL query, sử dụng Index hợp lý (Xem `product_repository.go`).

---

## 🛠 3. Các bài tập "Nâng cấp sự nghiệp" (Career Exercises)

Để thực sự giỏi, bạn đừng chỉ đọc code. Hãy thử thực hiện các task sau theo độ khó tăng dần:

### Task Dễ (Cho Junior):
- [ ] Thêm tính năng "Đổi mật khẩu" (Change Password) cho `user-service`.
- [ ] Thêm field `brand` cho sản phẩm và cho phép filter sản phẩm theo brand trong `product-service`.

### Task Trung bình (Cho Mid-level):
- [ ] Implement tính năng "Yêu thích sản phẩm" (Wishlist). Service nào sẽ quản lý? Database nào?
- [ ] Tích hợp một Mock Payment Gateway thật (như MoMo Test hoặc Stripe Test) thay vì chỉ log "Payment Success".

### Task Khó (Cho Senior):
- [ ] **Distributed Tracing**: Gắn OpenTelemetry vào toàn bộ luồng tạo đơn hàng để thấy được trace từ lúc nhấn nút ở Frontend đến lúc nhận Email.
- [ ] **Elasticsearch Search**: Tối ưu tính năng tìm kiếm sản phẩm bằng cách dùng Elasticsearch cho các truy vấn phức tạp thay vì PostgreSQL `ILIKE`.

---

## 📚 4. Lời khuyên dành cho bạn

1. **Đừng học vẹt**: Khi thấy một đoạn code gRPC, hãy hỏi "Tại sao chỗ này không dùng HTTP?".
2. **Trace code thủ công**: Chọn một luồng nghiệp vụ (ví dụ: Thanh toán) và mở từng file code theo đúng trình tự request chạy.
3. **Tự tay gõ lại**: Đừng chỉ copy-paste. Hãy thử tự build một service mới (ví dụ: `review-service`) theo đúng style của project này.

**Career Path của bạn bắt đầu từ việc hiểu sâu những gì dự án này đang có.** Nếu bạn làm chủ được codebase này, bạn hoàn toàn tự tin ứng tuyển vào các vị trí Backend Go tại các công ty lớn.

---
> [!IMPORTANT]
> Để bắt đầu đọc code đúng cách, hãy làm theo [03-source-reading-roadmap.md](./03-source-reading-roadmap.md). Đây là bước đầu tiên để hiện thực hóa lộ trình này.


---
> [!TIP]
> Hãy dùng file [04-study-prompts.md](./04-study-prompts.md) để "phỏng vấn" AI về các phần bạn chưa rõ. Đó là cách tốt nhất để củng cố kiến thức!
