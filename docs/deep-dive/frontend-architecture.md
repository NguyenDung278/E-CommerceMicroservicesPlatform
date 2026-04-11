# Frontend Architecture

Tài liệu này mô tả frontend đang chạy thật trong repo theo đúng source code hiện tại của `frontend/`.

## 1. Runtime nào là source of truth

- `frontend/` là UI chính cho local/dev và Docker runtime hiện tại.
- `client/` là nhánh Next.js experimental để tham khảo hướng tổ chức khác, không phải bề mặt mặc định của hệ thống.

## 2. Cây thư mục quan trọng

| Thư mục                    | Trách nhiệm                                                              |
| -------------------------- | ------------------------------------------------------------------------ |
| `frontend/src/app/`        | entrypoint `main.tsx`, route tree `app.tsx`, provider tree, layout shell |
| `frontend/src/pages/`      | screen theo URL, giữ logic mỏng và compose từ feature hook/component     |
| `frontend/src/features/`   | business UI theo domain: auth, cart, account, admin, home                |
| `frontend/src/services/`   | HTTP client, error handling, normalizer, API module                      |
| `frontend/src/components/` | reusable component dùng xuyên domain                                     |
| `frontend/src/styles/`     | design token + global CSS + page CSS                                     |

Điểm quan trọng: runtime hiện tại không dùng cây `routes/` hay `shared/` làm source of truth. Nếu gặp tài liệu cũ nói như vậy, hãy tin `pages/`, `features/`, `services/` và `components/` trong source hiện tại.

## 3. Provider tree và app shell

Provider tree hiện tại:

1. `AppProviders`
2. `AuthProvider`
3. `CartProvider`
4. `BrowserRouter`
5. `ProtectedRoute`
6. `AppLayout`
7. route page thật

Ý nghĩa:

- `AuthProvider` giữ token lifecycle, bootstrap session, refresh profile, email/phone verification action.
- `CartProvider` đứng sau auth để quyết định guest cart hay authenticated cart.
- `ProtectedRoute` chặn account/admin surface ở boundary router thay vì rải auth check trong từng page.
- `AppLayout` chỉ lo shell điều hướng, không ôm business logic của từng domain.

## 4. Route tree đang chạy

### Public/auth

- `/login`
- `/register`
- `/forgot-password`
- `/auth/callback`
- `/verify-email`
- `/reset-password`

### Storefront

- `/`
- `/products`
- `/products/:productId`
- `/categories/:categoryName`
- `/cart`
- `/checkout`

### Account protected

- `/profile`
- `/myorders`
- `/addresses`
- `/orders/:orderId`
- `/payments`
- `/security`
- `/notifications`

### Admin protected

- `/admin`

## 5. Data flow chuẩn nên trace

```text
route/page
-> feature hook hoặc provider
-> services/api/modules/*
-> services/api/http-client.ts
-> api-gateway
-> backend service
```

Với guest cart:

```text
page
-> useCart()
-> cart-provider.tsx
-> guest-cart-storage.ts
-> product-api.ts
```

## 6. Các luồng người dùng quan trọng

### Auth

- Login/register/reset password đi qua `features/auth/providers/auth-provider.tsx`
- OAuth callback dùng short-lived login ticket thay vì đẩy JWT thẳng lên URL
- Email verification và phone verification cùng ở auth layer, không nhét vào page riêng lẻ

### Cart

- Guest mode dùng local storage và refresh giá/stock qua `productApi`
- Authenticated mode dùng `cartApi`
- Khi vừa đăng nhập, provider merge guest cart vào cart server

### Profile/account

- `useProfilePageState()` tổng hợp `user`, `orders`, `payments`, `addresses`
- Profile form hiện có upload avatar tức thì, OTP resend/timer, và save flow rõ ràng hơn sau refactor gần nhất
- `SecurityPage` hiện là security center thực dụng, không quảng bá 2FA đầy đủ khi backend chưa có thật

### Checkout

- Checkout page orchestration `create order -> process payment -> clear cart nếu cần -> redirect order detail`
- Business invariant vẫn ở backend; page chỉ điều phối UX và state

### Admin

- `pages/admin/admin-page.tsx` vẫn là file lớn nhất và là ứng viên refactor tiếp theo
- Admin vẫn gọi nhiều API module thật; chưa phải mock-only surface

## 7. Hệ thống UI và CSS

- Token: `styles/base/_variables.css`
- Typography/reset: `styles/base/*`
- Button/form shared: `styles/components/*`
- App shell: `app/layout/app-layout.css`
- Account layout: `features/account/components/*.css`
- Page-specific surfaces: `styles/pages/*`

Lưu ý:

- `styles/shared.css` vẫn còn nhiều lớp legacy, nhưng hiện được nạp trước để hệ modular mới override an toàn.
- Đây là cách refactor có kiểm soát, tránh “big bang redesign”.

## 8. Phần đã cải thiện trong pass này

- Đồng bộ font, spacing, focus state, button và form control ở tầng shared.
- Refactor profile editor để giảm độ phức tạp và làm rõ boundary avatar upload.
- Nâng UX account/profile bằng avatar thật, phone verification status, resend OTP, timer và copy trung thực hơn.
- Gom lại bộ docs frontend và bỏ bớt tài liệu lặp/lạc hậu.

## 9. Nợ kỹ thuật còn lại

- `admin-page.tsx`, `catalog-page.tsx`, `category-page.tsx` vẫn còn dày.
- Chưa có visual regression cho layout/styling sau khi đổi design token.
- Một số page cũ vẫn còn CSS hardcode thay vì đi qua shared primitive.
- Cần mở rộng test cho profile/account flow và accessibility audit.

## 10. Tài liệu nên đọc tiếp

- [Frontend Refactor Status](./frontend-refactor-status.md)
- [Annotated Frontend Source Map](../annotated/frontend-source-map.md)
- [Annotated Frontend App](../annotated/frontend-app.md)
