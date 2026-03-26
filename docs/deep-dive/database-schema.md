# Tổ chức Dữ liệu và Tách biệt Lược đồ (Database Schema Isolation)

Trong thiết kế Microservices tiêu chuẩn, một trong những quy tắc bất biến (Invariants) là **Database Per Service**. Tài liệu này giải thích các bảng dữ liệu đang nằm ở đâu và tại sao chúng lại bị "cắt đứt" khỏi nhau.

## 1. Nguyên tắc "Mỗi Dịch vụ một Database"
Dự án không có `JOIN` trực tiếp bằng SQL giữa bảng `Users`, `Orders` và `Products`.  
- **Vì sao?** Vì DB của User có thể sập nhưng DB của Product vẫn chạy. Khách hàng vẫn lướt xem hàng được, chỉ là không xem profile được. Nếu `JOIN` trực tiếp, bạn sẽ ép kết nối các service lại thành Monolithic Database.
- **Sự đánh đổi (Trade-off)**: Khi muốn lấy Order và Name của User, service Order phải trích xuất `user_id` hiện tại từ token hoặc thực hiện gọi API (gRPC) sang User service.

## 2. Tổ chức Schema theo Service

### `user-service` DB (PostgreSQL)
Quản lý các tài nguyên xoay quanh cá nhân.
- `users`: Bảng chính, lưu trữ email, hashed_password, tên, quyền (role).
- `addresses`: Bảng phụ 1-N lưu thông tin giao hàng của User (cờ `is_default`, max 10 dòng/user).

### `product-service` DB (PostgreSQL)
Nguồn sự thật của danh mục và giá cả.
- `products`: ID, Tên, Giá, Số lượng tồn kho (stock), Category. (Sau này có thể Scale thêm SKU, Variants).

### `order-service` DB (PostgreSQL)
Lưu dấu vết mua bán. Rất quan trọng, phải dùng Transaction gắt gao.
- `orders`: Master record (Mã đơn, ID User mua, Shipping Address ID, Tổng tiền, Trạng thái: pending/paid/cancelled/shipped).
- `order_items`: Chi tiết các món (Lưu ý: Bảng này snapshot (lưu cứng) lại `Product Name` và `Price` ngay tại thời điểm đặt để ngăn chặn việc bị đổi giá làm sai lệch bill cũ).
- `order_events`: Bảng log/tracking lưu từng mốc thời gian chuyển trạng thái của 1 order.

### `payment-service` DB (PostgreSQL)
Quản lý đối soát tiền nong.
- `payments`: Status (pending, failed, completed), Payment Method (stripe, cash), Lượng tiền giao dịch (Amount). Tham chiếu chéo tới `order_id`.

### `cart-service` Cache (Redis)
Cơ sở dữ liệu dạng Key-Value chạy trên RAM.
- **Key**: `cart:{user_id}`
- **Value**: Một Hash Table hoặc JSON string lưu mảng các `cartItem` (`product_id`, `quantity`).
- **Lý do dùng Redis**: Giỏ hàng thay đổi liên tục, Insert/Update cực cao. Cho vào DB quan hệ sẽ làm cạn kiệt I/O disk. Redis giải quyết hoàn hảo bài toán này kèm theo TTL (Tự động xóa giỏ hàng nếu bỏ quên quá 3 ngày).

## 3. Quản lý Migrations (Phiên bản DB)
Bản thân source code Go được đính kèm (embedded) sẵn các file raw `.sql` trong folder `migrations/`.
Khi các Service chạy lên (tại `cmd/main.go`), nó sẽ gọi thư viện `golang-migrate/migrate` để auto-apply các script SQL tạo bảng nếu DB rỗng, đảm bảo lập trình viên không bao giờ quên chạy script SQL tay.
