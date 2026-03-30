# Annotated: Frontend Source Map

Tài liệu này là bản đồ đọc source dành riêng cho `frontend/src/`. Nó đặc biệt hữu ích vì frontend hiện tại không phải “cấu trúc mới sạch hoàn toàn” cũng không phải “cấu trúc cũ chưa refactor”, mà là một trạng thái chuyển tiếp có chủ đích:

- source of truth mới nằm ở `app/`, `features/`, `shared/`
- nhiều file compatibility vẫn tồn tại để giữ import cũ chạy được

Mục tiêu của doc này là giúp bạn biết nên mở file nào là implementation thật, file nào chỉ là re-export.

## 1. Nhìn một lần để nhớ cả cây thư mục

| Thư mục | Vai trò | Cách nhớ nhanh |
| --- | --- | --- |
| `app/` | boot app, providers, layout, router | khởi động app |
| `routes/` | page-level UI theo URL | màn hình |
| `features/` | logic theo domain | nghiệp vụ UI |
| `shared/` | API layer, components dùng chung, types, utils | hạ tầng frontend |
| `styles/` | CSS hệ thống | skin của app |
| `hooks/`, `lib/`, `providers/`, `ui/`, `utils/`, `types/` | compatibility alias | cầu nối import cũ |

## 2. Route tree thực tế cần thuộc

Route tree lấy từ `frontend/src/app/App.tsx`:

- public/auth: `/login`, `/register`, `/forgot-password`, `/auth/callback`, `/verify-email`, `/reset-password`
- storefront: `/`, `/products`, `/products/:productId`, `/categories/:categoryName`, `/cart`, `/checkout`
- account protected: `/profile`, `/myorders`, `/addresses`, `/orders/:orderId`, `/payments`, `/security`, `/notifications`
- admin protected: `/admin`

### Vì sao route tree đáng học trước

- nó là runtime map thật của frontend
- giúp bạn biết page nào public, page nào yêu cầu auth
- giúp trace dependency từ route sang provider/hook/API dễ hơn nhiều

## 3. Source of truth mới nằm ở đâu

### App shell

- `app/main.tsx`
- `app/App.tsx`
- `app/providers/AppProviders.tsx`
- `app/router/ProtectedRoute.tsx`
- `app/router/ScrollToTop.tsx`
- `app/layout/AppLayout.tsx`

### Domain features

- `features/auth/*`
- `features/cart/*`
- `features/account/*`
- `features/admin/*`
- `features/shop-*/*`

### Shared boundary

- `shared/api/*`
- `shared/components/*`
- `shared/types/api.ts`
- `shared/utils/*`
- `shared/http/client.ts`

## 4. Compatibility layer đang tồn tại ở đâu

Đây là phần quan trọng nhất của source map.

Repo hiện có nhiều file re-export, ví dụ:

| Import path bạn dễ gặp | File thực thi thật |
| --- | --- |
| `frontend/src/lib/api.ts` | `frontend/src/shared/api/index.ts` |
| `frontend/src/lib/http/client.ts` | `frontend/src/shared/http/client.ts` -> `shared/api/http-client.ts` |
| `frontend/src/lib/normalizers/index.ts` | `frontend/src/shared/api/normalizers.ts` |
| `frontend/src/hooks/useAuth.ts` | `frontend/src/features/auth/hooks/useAuth.ts` |
| `frontend/src/hooks/useCart.ts` | `frontend/src/features/cart/hooks/useCart.ts` |
| `frontend/src/hooks/useOrderPayments.ts` | `frontend/src/features/account/hooks/useOrderPayments.ts` |
| `frontend/src/hooks/useSavedAddresses.ts` | `frontend/src/features/account/hooks/useSavedAddresses.ts` |
| `frontend/src/providers/AuthContext.tsx` | `frontend/src/features/auth/providers/AuthProvider.tsx` |
| `frontend/src/providers/CartContext.tsx` | `frontend/src/features/cart/providers/CartProvider.tsx` |
| `frontend/src/ui/account/accountConfig.ts` | `frontend/src/features/account/config/accountNavigation.ts` |
| `frontend/src/ui/account/AccountPageLayout.tsx` | `frontend/src/features/account/components/AccountPageLayout.tsx` |
| `frontend/src/ui/form/FormField.tsx` | `frontend/src/shared/components/form/FormField.tsx` |
| `frontend/src/ui/feedback/NotificationStack.tsx` | `frontend/src/shared/components/feedback/NotificationStack.tsx` |
| `frontend/src/ui/product/ProductCard.tsx` | `frontend/src/shared/components/product/ProductCard.tsx` |
| `frontend/src/types/api.ts` | `frontend/src/shared/types/api.ts` |
| `frontend/src/utils/format.ts` | `frontend/src/shared/utils/format.ts` |
| `frontend/src/utils/sanitize.ts` | `frontend/src/shared/utils/sanitize.ts` |
| `frontend/src/utils/validation.ts` | `frontend/src/shared/utils/validation.ts` |

### Còn có compatibility bên trong `features/`

Bạn sẽ thấy thêm một số re-export kiểu:

- `features/account/lib/api.ts` -> `shared/api`
- `features/account/types/api.ts` -> `shared/types/api`
- `features/cart/lib/api.ts` -> `shared/api`
- `features/cart/types/api.ts` -> `shared/types/api`
- `features/cart/hooks/useAuth.ts` -> `features/auth/hooks/useAuth.ts`

### Vì sao pattern này tồn tại

Đây là chiến lược migration an toàn:

- giữ import cũ hoạt động
- cho phép tách module dần
- giảm số lượng file phải sửa trong một lần refactor

### Nhược điểm

- cùng một capability có thể có nhiều “điểm vào”
- người mới dễ mở nhầm file re-export rồi tưởng đó là nơi chứa logic thật

## 5. Nếu đang tìm một capability, mở file nào trước

### Auth

1. `features/auth/providers/AuthProvider.tsx`
2. `features/auth/hooks/useAuth.ts`
3. `features/auth/hooks/useSessionToken.ts`
4. `features/auth/utils/*`

### Cart

1. `features/cart/providers/CartProvider.tsx`
2. `features/cart/hooks/useCart.ts`
3. `features/cart/utils/guestCartStorage.ts`

### Account

1. `features/account/hooks/useOrderPayments.ts`
2. `features/account/hooks/useSavedAddresses.ts`
3. `features/account/components/*`
4. `features/account/config/accountNavigation.ts`

### API boundary

1. `shared/api/http-client.ts`
2. `shared/api/error-handler.ts`
3. `shared/api/modules/*.ts`
4. `shared/api/normalizers.ts`
5. `shared/types/api.ts`

## 6. Dependency flow nên đọc như thế nào

Luồng tư duy đúng khi trace một bug hoặc một feature:

```text
route/page
-> feature hook hoặc provider
-> shared/api module
-> http client
-> gateway/backend
-> normalizer/type
-> render UI component
```

Nếu là cart guest mode:

```text
page
-> useCart
-> CartProvider
-> guest cart storage
-> productApi.getProductById
-> update localStorage
```

## 7. Điều cần ghi nhớ khi học từ source map này

- `routes/` không phải lúc nào cũng là nơi chứa logic thật
- `shared/` không phải đồ phụ; đây là boundary kỹ thuật quan trọng nhất của frontend
- `lib/`, `hooks/`, `ui/`, `providers/` ở root phần lớn là lớp compatibility, không phải kiến trúc đích cuối cùng
- nếu một import path trông “cũ”, rất có thể file đó chỉ đang làm nhiệm vụ re-export

## 8. Lỗi thường gặp

- mở `lib/api.ts` rồi tưởng API layer thật chỉ có một file
- mở `ui/account/accountConfig.ts` rồi không nhận ra implementation thật nằm ở `features/account/config/accountNavigation.ts`
- chỉnh nhầm file compatibility mà quên trace đến file implementation
- nghĩ refactor chưa hoàn tất nghĩa là kiến trúc thất bại; thực ra đây là một giai đoạn chuyển đổi có chủ đích

## 9. Cách debug khi import trông “không hợp lý”

1. Kiểm tra file import có nằm trong `hooks/`, `lib/`, `ui/`, `providers/`, `types/`, `utils/` không.
2. Nếu có, mở file đó xem nó re-export sang đâu.
3. Nhảy tiếp đến `features/` hoặc `shared/` để đọc logic thật.
4. Khi sửa hành vi, ưu tiên sửa implementation thật thay vì entrypoint compatibility.

## 10. Mối liên hệ với file khác

- [frontend-app.md](./frontend-app.md)
- [frontend-auth-cart-providers.md](./frontend-auth-cart-providers.md)
- [frontend-api-layer.md](./frontend-api-layer.md)
- [frontend-routes-and-flows.md](./frontend-routes-and-flows.md)
- [../deep-dive/frontend-architecture.md](../deep-dive/frontend-architecture.md)
