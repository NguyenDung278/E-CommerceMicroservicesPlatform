# Shared Libraries (`pkg/`) Deep Dive

Thư mục `pkg/` không chứa nghiệp vụ thương mại (domain logic) mà chứa các mã nguồn tiện ích cốt lõi (Core Utilities). Bất kì Microservice nào trong dự án cũng phải import thư mục này. 

Việc tạo ra `pkg/` giải quyết bài toán cốt lõi: **Đừng lặp lại mã (DRY - Don't Repeat Yourself) giữa các service.**

## 1. `pkg/middleware/`

### `auth.go`
- Cung cấp hàm `JWTAuth(secret)` để chặn các HTTP Request không có token hoặc token đã hết hạn.
- Định nghĩa struct `JWTClaims` dùng chung cho toàn bộ dự án, thống nhất việc trích xuất `UserID`, `Email`, và `Role` từ chuỗi Token.
- Cung cấp hàm `RequireRole(...)` dùng để khóa các API dành riêng cho quản trị viên (Admin).

### `security.go`
- Tích hợp sẵn HTTP Security Headers như XSS Protection, No-sniff, Content-type options, để đạt chuẩn an toàn cơ bản của Web.

### `logger.go`
- Log toàn bộ Request (Method, Path, Thời gian phản hồi ngẫu nhiên, Lỗi trả về) thông qua thư viện `go.uber.org/zap`. Việc log mọi thứ ra định dạng JSON giúp công cụ như ELK/Grafana Loki đọc cực kỳ dễ dàng.

## 2. `pkg/response/`
- Thống nhất toàn bộ cấu trúc phản hồi JSON. Thay vì Service A trả về mảng, Service B trả về object lỗi mờ tịt, `pkg/response` chuẩn hoá Format:
```json
{
  "success": true,
  "message": "...",
  "data": {},
  "meta": {} // Dành cho pagination
}
```

## 3. `pkg/validation/`
- Wraps thư viện `go-playground/validator/v10`.
- Chức năng: Extract các lỗi (ví dụ "Field Email is required", "Password must be >= 8") ra thành câu chữ thân thiện với Frontend.

## 4. Báo động đỏ khi sửa `pkg/`
Vì hàng chục service đang reference chung thư mục này. Nếu bạn đổi Interface hay đổi Payload của một file (ví dụ sửa cách đọc `JWTClaims`), toàn bộ các Service (User, Order, Product...) sẽ lăn quay ra chết/build fail cùng lúc. Điểm mạnh là đồng bộ cực tốt, điểm yếu là đòi hỏi cẩn thận tuyệt đối khi sửa đổi.
