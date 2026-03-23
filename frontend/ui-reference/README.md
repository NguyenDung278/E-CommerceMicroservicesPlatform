# UI Reference

Thư mục này chứa bộ giao diện tham chiếu xuất từ Stitch để áp dụng dần vào frontend hiện tại mà không phá vỡ logic React, auth flow hay API integration đang có sẵn.

## Cấu trúc

- `stitch/home-editorial/`: template tham chiếu cho trang chủ
- `stitch/catalog/`: template tham chiếu cho danh sách sản phẩm
- `stitch/catalog-alt-editorial/`: biến thể thứ hai của catalog, hiện đang trùng mục tiêu với `catalog/`
- `stitch/product-detail/`: template tham chiếu cho trang chi tiết sản phẩm
- `stitch/cart/`: template tham chiếu cho giỏ hàng
- `stitch/login/`: template tham chiếu cho đăng nhập
- `stitch/register/`: template tham chiếu cho đăng ký
- `stitch/forgot-password/`: template tham chiếu cho quên mật khẩu
- `stitch/reset-password/`: template tham chiếu cho đặt lại mật khẩu
- `stitch/admin-dashboard/`: template tham chiếu cho khu quản trị/admin
- `stitch/design-system-forest-hearth/`: tài liệu design system và tone thị giác
- `stitch/planning/`: tài liệu planning và brief thiết kế

## Mapping Với App Hiện Tại

| Page hiện có trong app | Template Stitch |
| --- | --- |
| `/` | `stitch/home-editorial/` |
| `/products` | `stitch/catalog/` |
| `/products/:productId` | `stitch/product-detail/` |
| `/cart` | `stitch/cart/` |
| `/login` | `stitch/login/` |
| `/register` | `stitch/register/` |
| `/reset-password` | `stitch/reset-password/` |
| `/admin` | `stitch/admin-dashboard/` |

## UI Còn Thiếu So Với Các Route Đang Có

Các màn sau đang có trong app React nhưng chưa có template Stitch tương ứng:

- `/checkout`
- `/categories/:categoryName`
- `/verify-email`
- `/profile`
- `/orders/:orderId`
- `/payments`

## UI Đang Thừa Hoặc Chỉ Nên Dùng Làm Tham Chiếu

- `stitch/catalog-alt-editorial/`: trùng vai trò với `catalog/`, nên chỉ giữ như phương án visual phụ
- `stitch/forgot-password/`: app hiện chưa có route riêng cho màn quên mật khẩu
- `stitch/design-system-forest-hearth/`: là tài liệu hệ thống thiết kế, không phải source giao diện chạy trực tiếp
- `stitch/planning/`: là brief/planning, không phải source giao diện chạy trực tiếp

## Ghi Chú Tích Hợp

- Không copy nguyên HTML Stitch vào app. App hiện dùng `React + Vite + TypeScript`, nên chỉ nên lấy layout, style direction, component shape và nội dung thị giác.
- Logic data fetching, auth, cart, payment, role-based access và admin actions vẫn phải giữ trong `frontend/src/`.
- `stitch/admin-dashboard/` đã được dùng làm template để làm mới UI của `frontend/src/pages/AdminPage.tsx`.
