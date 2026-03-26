# UI Reference

Thư mục này chứa bộ giao diện tham chiếu để áp dụng dần vào frontend hiện tại mà không phá vỡ logic React, auth flow hay API integration đang có sẵn.

## Cấu trúc

- `screens/`: mỗi màn hình được gom theo domain, trong cùng folder có thể chứa cả `page.html/page.png` và `stitch.html/stitch.png`
- `docs/design-system/`: tài liệu hệ thống thiết kế
- `docs/planning/`: brief, PRD, planning note

## Nhóm Màn Hình

- `screens/auth/login/`
- `screens/auth/register/`
- `screens/auth/forgot-password/`
- `screens/auth/reset-password/`
- `screens/storefront/home/`
- `screens/storefront/catalog/`
- `screens/storefront/catalog-alt/`
- `screens/storefront/product-detail/`
- `screens/storefront/cart/`
- `screens/admin/dashboard/`

## Quy Ước File

- `page.html`, `page.png`: bản tham chiếu HTML/screenshot đã được team lưu lại thủ công
- `stitch.html`, `stitch.png`: bản xuất trực tiếp từ Stitch
- Không phải màn nào cũng có đủ cả hai nguồn. Thiếu file nghĩa là hiện chỉ có một nguồn tham chiếu cho màn đó.

## Mapping Với App Hiện Tại

| Route hiện có trong app | Thư mục tham chiếu |
| --- | --- |
| `/` | `screens/storefront/home/` |
| `/products` | `screens/storefront/catalog/` |
| `/products/:productId` | `screens/storefront/product-detail/` |
| `/cart` | `screens/storefront/cart/` |
| `/login` | `screens/auth/login/` |
| `/register` | `screens/auth/register/` |
| `/forgot-password` | `screens/auth/forgot-password/` |
| `/reset-password` | `screens/auth/reset-password/` |
| `/admin` | `screens/admin/dashboard/` |

## UI Còn Thiếu So Với Các Route Đang Có

Các màn sau đang có trong app React nhưng hiện chưa có thư mục tham chiếu đầy đủ:

- `/checkout`
- `/categories/:categoryName`
- `/verify-email`
- `/profile`
- `/orders/:orderId`
- `/payments`

## Ghi Chú

- Không copy nguyên HTML vào app. Frontend hiện dùng `React + Vite + TypeScript`, nên chỉ nên lấy layout, style direction, component shape và nội dung thị giác.
- Logic data fetching, auth, cart, payment, role-based access và admin actions vẫn phải giữ trong `frontend/src/`.
- `screens/storefront/catalog-alt/` là biến thể visual phụ của catalog, nên chỉ dùng như hướng art direction bổ sung.
- Cấu trúc cũ `pages/` và `stitch/` đã được gộp lại theo feature để giảm việc phải nhớ màn nào nằm ở nguồn nào.
