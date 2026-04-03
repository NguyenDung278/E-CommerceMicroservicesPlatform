# Hướng Dẫn Đăng Nhập Và Quản Lý Cơ Sở Dữ Liệu Dành Cho Developers

Tài liệu này cung cấp hướng dẫn toàn diện từ cách kết nối, kiểm tra, đến chỉnh sửa cơ sở dữ liệu PostgreSQL của dự án E-commerce Platform. 

Do dự án áp dụng mô hình kiến trúc Microservices, mỗi service sở hữu một CSDL riêng nhằm đảm bảo nguyên tắc Decentralized Data.

---

## 1. Chuẩn Bị Thông Tin Kết Nối (Connection Info)

Hệ thống đang chạy CSDL PostgreSQL trong Docker container có tên `ecommerce-postgres`. Bạn có thể lấy thông tin dựa trên file `Makefile` hoặc `.env`.

**Thông số kết nối Local (Mặc định):**
- **Host**: `localhost` (hoặc `127.0.0.1`)
- **Port**: `5432`
- **Username**: `admin`
- **Password**: `change-me-db-password`
- **Tên Databases** (bao gồm 4 CSDL riêng biệt):
  - `ecommerce_user` (Cho User Service)
  - `ecommerce_product` (Cho Product Service)
  - `ecommerce_order` (Cho Order Service)
  - `ecommerce_payment` (Cho Payment Service) 

*(Lưu ý: Mật khẩu có thể khác nếu bạn đã định nghĩa biến `POSTGRES_PASSWORD` trong file `.env.local` hoặc `.env` của thư mục dự án).*

---

## 2. Lựa Chọn Cài Đặt Công Cụ Khách Hàng (Client Tools)

Bạn có thể kết nối với CSDL bằng giao diện đồ họa (GUI) hoặc thông qua giao diện dòng lệnh (CLI).

### 2.1. Sử dụng GUI (Giao diện người dùng)
*Phù hợp cho các thao tác xem, sửa, và Visualize trực quan Schema.*
- **DBeaver** (Phổ biến, khuyên dùng): Hỗ trợ kết nối hầu hết RDBMS. Trải nghiệm tốt với Data Grid.
- **TablePlus**: Client rất nhẹ và có tốc độ native trên macOS/Windows.
- **pgAdmin**: Công cụ quản trị chuyên sâu độc quyền của PostgreSQL (Lưu ý: Đừng nhầm lẫn với phpMyAdmin của MySQL).

### 2.2. Sử dụng CLI
*Phù hợp để tự động hóa, chạy script hoặc tương tác nhanh.*
- **psql**: Công cụ Terminal mặc định có sẵn.
- **Docker Exec**: Truy cập trực tiếp vào trong container để chạy `psql` mà không cần cài đặt thêm client ở Host machine.

---

## 3. Thực Hiện Kết Nối Vào Database

### Mẫu kết nối với DBeaver / TablePlus
1. Mở phần mềm và chọn **Tạo kết nối mới (New Connection)**.
2. Chọn loại hệ quản trị là **PostgreSQL**.
3. Tại phần Server: Điền `localhost` (Port: `5432`).
4. Tại phần Database: Điền `ecommerce_user` (Làm tương tự kết nối cho 3 DB còn lại nếu muốn quản lý nhiều bên).
5. Username/Password: Điền `admin` và `change-me-db-password`.
6. Ấn **Test Connection**. Khi thông báo "*Success*" hiện lên, nhấn Finish.

### Mẫu kết nối bằng lệnh Terminal (Docker Exec)
Nếu bạn không cài Data Grid Client nào trên máy, hãy mở Terminal trên Mac và truy cập luôn vào container:

```bash
# Đăng nhập vào user db
docker exec -it ecommerce-postgres psql -U admin -d ecommerce_user

# Đăng nhập vào order db
docker exec -it ecommerce-postgres psql -U admin -d ecommerce_order
```

---

## 4. Kiểm Tra Danh Sách Bảng Và Xem Cấu Trúc Bảng

Một khi đã kết nối qua `psql` CLI, bạn có thể dùng các lệnh meta sau:

- **`\l`**: Liệt kê các Databases có trên server máy chủ.
- **`\c ecommerce_product`**: Đổi nhánh qua Database khác.
- **`\dt`**: Hiển thị danh sách tất cả các bảng (Tables) trong DB hiện tại.
- **`\d <tên_bảng>`** (ví dụ: `\d products`): Xem chi tiết cấu trúc cột, kiểu dữ liệu và danh sách khóa (Indexes / FK / Constraints).

*Nếu dùng GUI*, bạn chỉ cần Expand (Mở) cấu hình thư mục Database -> `Schemas` -> `public` -> `Tables` rồi click đúp vào bảng để xem mô tả/ERD.

---

## 5. Truy Vấn Và Sửa Đổi Dữ Liệu (DML)

Dưới đây là một số ví dụ khi bạn cần tương tác trực tiếp với dữ liệu bằng SQL.

### Xem / Truy vấn dữ liệu (SELECT)
```sql
-- Lọc danh sách Order có subtotal > 100
SELECT id, user_id, status, subtotal_price 
FROM orders 
WHERE subtotal_price > 100 
ORDER BY created_at DESC 
LIMIT 10;
```

### Thêm dữ liệu (INSERT)
```sql
INSERT INTO categories (id, name, created_at, updated_at) 
VALUES ('cat_123', 'Điện thoại', NOW(), NOW());
```

### Cập nhật dữ liệu (UPDATE)
```sql
-- Chữa cháy (Hotfix) update trạng thái đơn hàng khi xảy ra lỗi kẹt Payment
UPDATE orders 
SET status = 'paid', updated_at = NOW() 
WHERE id = 'ord_err_555' AND status = 'pending';
```
*(Lưu ý: Khi trực tiếp update ở production, hãy cập nhật cùng trường `updated_at` để data không mất tính chuẩn xác).*

### Xóa Dữ Liệu (DELETE)
```sql
DELETE FROM product_reviews 
WHERE user_id = 'usr_spam11' AND product_id = 'prd_989';
```
*(Lưu ý Cẩn Trọng: Thao tác DELETE là vĩnh viễn unless bạn set cấu hình Soft-Delete trong Service layer).*

---

## 6. Sao Lưu (Backup) Và Khôi Phục (Restore) Dữ Liệu

Đôi khi bạn cần lấy Database ở Production về Local để debug hoặc backup định kỳ.

**Lệnh Sao Lưu (Dump) một DB thành file SQL:**
Chạy trên Host terminal (máy của bạn):
```bash
docker exec -t ecommerce-postgres pg_dump -U admin -d ecommerce_user -c > backup_user_db.sql
```

**Lệnh Khôi Phục (Restore) từ file SQL:**
*(Hãy cẩn thận vì thao tác này ghi đè vào hệ thống)*
```bash
cat backup_user_db.sql | docker exec -i ecommerce-postgres psql -U admin -d ecommerce_user
```

---

## 7. Các Lưu Ý Bảo Mật Và Xử Lý Lỗi Thường Gặp

### Lỗi Thường Gặp
1. **Lỗi: `Connection refused (Port 5432)`**
   - **Nguyên nhân**: Docker container chưa chạy, hoặc bạn quên map port (-p `5432:5432`) ở `docker-compose.yml`.
   - **Xử lý**: Kiểm tra lại bằng lệnh `docker ps`. Đảm bảo service `ecommerce-postgres` trong Makefile/compose đang Up. Thử chạy `make compose-up`.
2. **Lỗi: `FATAL: database "ecommerce" does not exist`**
   - **Nguyên nhân**: Quá trình Init DB bị lỗi hoặc volume rác ở version trước vẫn còn.
   - **Xử lý**: Chạy `docker rm -f ecommerce-postgres` và xóa volume `docker volume rm ecommerce-platform_postgres-data`, sau đó docker compose cài đặt lại sạch sẽ.
3. **Lỗi Migration Dirty: `Dirty database version...`**
   - **Nguyên nhân**: Các lệnh migrate fail nửa chừng. 
   - **Xử lý**: Dùng tập lệnh force của Golang Migrate: `make migrate-force`.

### Thực Hành Bảo Mật (Tối Quan Trọng)
- **Tuyệt đối không dùng account `admin` này kết nối từ ngoài public:** Mật khẩu nên để ở dạng Secret, config firewall không mở cổng DB 5432 ra public (chỉ dùng nội bộ Docker Network). Chạy `psql` thông qua bastion host.
- **Dùng Transaction thủ công khi UPDATE/DELETE trên Live DB:** 
  Luôn bọc các câu lệnh sửa đổi trong khối BEGIN...COMMIT để tránh update nhầm do WHERE gõ thiếu.
  ```sql
  BEGIN;
  UPDATE users SET role = 'admin' WHERE id = 'uuid-chinh-xac';
  -- Kiểm tra dòng bị tác động
  COMMIT; 
  -- Hoặc ROLLBACK; nếu nhầm
  ```
- **Không bypass Application Logic:** Tránh thay đổi thủ công những cột liên quan đến Outbox Inbox như (`outbox_events.status`) trừ phi bạn rất rõ cách hệ thống RabbitMQ xử lý dữ liệu. Mọi thay đổi nên diễn ra ở Service để đảm bảo Audit Log (Sourcing).
