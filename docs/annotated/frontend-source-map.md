# Annotated: Frontend Source Map

Doc này là bản đồ đọc source cho `frontend/src/` theo đúng cấu trúc hiện tại.

## 1. Mở cây thư mục theo thứ tự này

| Thư mục                          | Khi nào nên mở                                               |
| -------------------------------- | ------------------------------------------------------------ |
| `app/`                           | cần hiểu app boot, provider tree, router, shell              |
| `pages/`                         | cần hiểu route-level UX và màn hình người dùng nhìn thấy     |
| `features/`                      | cần sửa logic theo domain như auth, cart, account            |
| `services/`                      | cần sửa API call, normalizer, error handling, network policy |
| `components/`                    | cần sửa UI shared dùng xuyên page                            |
| `styles/`                        | cần sửa token, layout, button/form, page skin                |
| `constants/`, `types/`, `utils/` | cần tra value dùng lại hoặc helper nhỏ                       |

## 2. Không còn source of truth ở đâu

Frontend hiện tại không còn dùng những khái niệm sau làm nơi triển khai chính:

- `routes/`
- `shared/`
- `lib/`
- `ui/`

Nếu gặp doc cũ hoặc commit cũ nhắc tới các path này, hãy trace lại về `pages/`, `features/`, `services/`, `components/`.

## 3. Nếu đang tìm một capability, mở file nào trước

### Auth

1. `features/auth/providers/auth-provider.tsx`
2. `features/auth/hooks/use-auth.ts`
3. `features/auth/hooks/use-session-token.ts`
4. `features/auth/storage/*`

### Cart

1. `features/cart/providers/cart-provider.tsx`
2. `features/cart/hooks/use-cart.ts`
3. `features/cart/storage/guest-cart-storage.ts`

### Account/profile

1. `pages/account/profile-page.tsx`
2. `features/account/hooks/use-profile-page-state.ts`
3. `features/account/hooks/use-profile-avatar-upload.ts`
4. `features/account/components/profile/*`
5. `features/account/utils/profile-editor.ts`

### API boundary

1. `services/api/http-client.ts`
2. `services/api/error-handler.ts`
3. `services/api/normalizers.ts`
4. `services/api/modules/*.ts`
5. `services/api/index.ts`

### Shell/layout

1. `app/app.tsx`
2. `app/providers/app-providers.tsx`
3. `app/layout/app-layout.tsx`
4. `app/router/*`

## 4. Flow chuẩn khi trace bug

```text
page
-> feature hook/provider
-> services/api/modules/*
-> services/api/http-client.ts
-> backend
-> state update
-> render component
```

Ví dụ với profile:

```text
pages/account/profile-page.tsx
-> use-profile-page-state.ts
-> use-order-payments.ts + use-saved-addresses.ts + auth-provider.tsx actions
-> orderApi/paymentApi/userApi/authApi
-> render hero/form/cards
```

## 5. Flow sửa UI đúng chỗ

- Đổi font, radius, spacing, shadow: `styles/base/_variables.css`
- Đổi button/form shared: `styles/components/*`
- Đổi shell header/footer: `app/layout/app-layout.css`
- Đổi riêng route profile: `styles/pages/account/profile-page.css`
- Đổi copy hoặc rendering của profile section: `features/account/components/profile/*`

## 6. Những file lớn cần ưu tiên refactor tiếp

- `pages/admin/admin-page.tsx`
- `pages/storefront/catalog-page.tsx`
- `pages/storefront/category-page.tsx`

Đây là ba file đáng đọc kỹ trước khi chạm feature mới vì chúng vẫn gánh nhiều orchestration.

## 7. Sau khi bộ docs frontend được gom lại

Nội dung từ ba doc cũ đã được gộp về đây và `frontend-app.md`:

- API layer
- auth/cart provider flow
- route/page flow

Mục tiêu là để người đọc không còn phải đoán doc nào mới nhất.
