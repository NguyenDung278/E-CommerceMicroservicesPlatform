# Annotated: Client Next.js Experimental

Tài liệu này dành cho `client/`, tức nhánh frontend Next.js đang ở trạng thái experimental.

Nó không phải runtime mặc định, nhưng vẫn rất đáng đọc nếu bạn muốn:

- so sánh hai cách tổ chức frontend trong cùng repo
- học App Router, provider tree và alias import sạch hơn
- tìm cảm hứng cho các bước refactor tiếp theo của `frontend/`

File nên mở song song:

- `client/src/app/layout.tsx`
- `client/src/providers/app-providers.tsx`
- `client/src/app/page.tsx`
- `client/src/components/account-pages.tsx`
- `client/src/lib/api/*`
- `client/src/providers/*`

## 1. Vai trò thật của `client/`

Hiện trạng theo source:

- dùng Next.js App Router
- có route storefront và account khá đầy đủ
- có `AuthProvider`, `CartProvider`, `WishlistProvider`
- có `Makefile` targets `client-dev` và `client-build`
- không có service compose mặc định

Nói ngắn gọn:

- `frontend/` là thứ bạn đọc để hiểu runtime local hiện tại
- `client/` là nơi bạn đọc để thấy hướng tổ chức frontend khác, gọn hơn ở import graph

## 2. Những gì khác với `frontend/`

### Routing

- `frontend/` dùng React Router
- `client/` dùng file-system routing của Next App Router

### Import graph

- `frontend/` đang giữ nhiều compatibility alias
- `client/` dùng alias `@/*` sạch và ổn định hơn

### Provider tree

- `client/` có thêm `WishlistProvider`
- tree hiện tại là `Auth -> Cart -> Wishlist`

### Component organization

- nhiều page được đẩy logic trình bày sang `components/*`
- account surface được gom khá mạnh trong `components/account-pages.tsx`

## 3. Bản đồ thư mục nên nhớ

| Vùng | Vai trò |
| --- | --- |
| `client/src/app/*` | route entrypoints theo App Router |
| `client/src/components/*` | feature/view components lớn |
| `client/src/providers/*` | app-wide state |
| `client/src/hooks/*` | hooks consumer |
| `client/src/lib/api/*` | API boundary |
| `client/src/types/api.ts` | type contract |
| `client/src/utils/*` | auth/cart/format helpers |

### Route đáng chú ý

- `/`
- `/products`
- `/products/[productId]`
- `/categories/[categoryName]`
- `/cart`
- `/checkout`
- `/profile`
- `/myorders`
- `/addresses`
- `/orders/[orderId]`
- `/payments`
- `/security`
- `/notifications`
- `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/auth/callback`

Điều này cho thấy `client/` không phải một skeleton trống. Nó là một nhánh frontend tương đối thật, chỉ chưa được dùng làm runtime mặc định.

## 4. `app/layout.tsx`: layout gốc của Next app

Điểm đáng chú ý:

- load font bằng `next/font`
- mount `AppProviders`
- gắn metadata toàn app

### Vì sao đây là cách đúng

Trong App Router, layout gốc là boundary rất hợp lý để:

- set font
- set provider tree
- định nghĩa metadata chung

Tổ chức như vậy sạch hơn việc mỗi page tự lặp các concern toàn cục.

## 5. `providers/app-providers.tsx`: provider tree rõ và dễ trace

Thứ tự hiện tại:

1. `AuthProvider`
2. `CartProvider`
3. `WishlistProvider`

### Vì sao đáng học

- dependency graph dễ nhìn
- logic auth/cart/wishlist được phân ranh giới rõ
- rất tiện so sánh với `frontend/src/app/providers/AppProviders.tsx`

## 6. `account-pages.tsx`: file lớn nhưng giàu giá trị học tập

File này gom nhiều account views vào một module lớn.

### Vì sao vẫn đáng đọc

- có shared primitives cho account surface
- tái sử dụng hooks như `useAuth`, `useOrderPayments`, `useSavedAddresses`
- cho thấy cách gom feature module lớn trong frontend

### Bài học quan trọng

File lớn không phải lúc nào cũng xấu. Nó chỉ trở thành vấn đề khi:

- responsibility quá trộn lẫn
- phần nào cũng muốn sửa cùng một lúc
- test và mental model bắt đầu khó kiểm soát

Trong `client/`, file này là “feature module lớn” khá rõ ràng, nên vẫn là tài liệu học tốt.

## 7. Vì sao `client/` đáng đọc dù chưa là runtime chính

### Điểm tốt

- import alias `@/*` làm dependency graph sạch hơn
- component organization mạch lạc
- đã có `WishlistProvider`, mở ra thêm ví dụ về state domain
- App Router cho mental model khác với React Router

### Điểm chưa tốt

- chưa có trong Compose mặc định
- chưa phải frontend được ưu tiên verify end-to-end
- dễ bị hiểu nhầm là source of truth nếu không đọc README hoặc docs runtime trước

## 8. Khi nào nên đọc `client/`

Nên đọc khi:

- muốn so sánh hai hướng tổ chức frontend trong cùng repo
- đang nghĩ về refactor lớn cho `frontend/`
- muốn học cách dùng App Router với provider tree

Không nên coi `client/` là nguồn đầu tiên nếu câu hỏi của bạn là:

- local runtime hiện tại chạy cái gì
- compose đang dựng frontend nào
- API flow nào đang được verify thường xuyên nhất

## 9. Mẹo nhớ nhanh

- `frontend/` = chạy chính
- `client/` = nhánh thử nghiệm đáng học
- `frontend/` cho bạn biết hệ thống đang vận hành thế nào
- `client/` cho bạn thấy repo có thể đi tiếp theo hướng nào

## 10. Cách debug hoặc học nhanh

1. Bắt đầu ở `client/src/app/layout.tsx`
2. Xem `client/src/providers/app-providers.tsx`
3. Mở `client/src/app/page.tsx`
4. Theo dõi sang `client/src/components/*`
5. So sánh cùng flow tương ứng ở `frontend/`

## 11. Mối liên hệ với file khác

- [../deep-dive/frontend-architecture.md](../deep-dive/frontend-architecture.md)
- [frontend-source-map.md](./frontend-source-map.md)
- [frontend-app.md](./frontend-app.md)
- [frontend-routes-and-flows.md](./frontend-routes-and-flows.md)
