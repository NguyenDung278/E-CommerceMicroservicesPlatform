# Frontend Runtime Guide

`frontend/` là runtime UI chính của repo hiện tại. Đây là ứng dụng React 18 + Vite dùng cho storefront, auth, account và admin. `client/` vẫn tồn tại như nhánh Next.js experimental, nhưng không phải source of truth cho local/dev mặc định.

## Cấu trúc nên nhớ

| Thư mục                                      | Vai trò                                                     |
| -------------------------------------------- | ----------------------------------------------------------- |
| `src/app/`                                   | boot app, provider tree, router helpers, layout shell       |
| `src/pages/`                                 | route-level screens theo URL                                |
| `src/features/`                              | logic theo domain như auth, cart, account, admin, home      |
| `src/services/`                              | HTTP client, normalizer, API modules, compatibility exports |
| `src/components/`                            | shared UI component dùng lại giữa nhiều page                |
| `src/styles/`                                | design tokens, base styles, layout styles, page styles      |
| `src/constants/`, `src/types/`, `src/utils/` | constant, type alias, helper dùng rộng                      |

## Luồng chính

- Auth: `pages/auth/* -> features/auth -> services/api/modules/auth-api.ts -> api-gateway/user-service`
- Cart: `pages/storefront/* -> features/cart/providers/cart-provider.tsx -> cartApi hoặc guest cart storage`
- Profile/account: `pages/account/* -> features/account/hooks/* -> orderApi/paymentApi/userApi`
- Admin: `pages/admin/admin-page.tsx -> services/api/modules/*`

## Hệ UI hiện tại

- Design tokens nằm ở `src/styles/base/_variables.css`
- Typography, form, button được chuẩn hóa qua `src/styles/base` và `src/styles/components`
- Layout shell nằm ở `src/app/layout/app-layout.tsx` + `src/app/layout/app-layout.css`
- CSS legacy trong `src/styles/shared.css` vẫn còn được giữ để tránh phá app, nhưng được nạp sớm hơn để lớp modular mới override an toàn

## Lệnh chất lượng

- `npm run dev`: chạy Vite dev server ở `127.0.0.1:5174`
- `npm run lint`: chạy ESLint
- `npm run format`: chạy Prettier
- `npm run test -- --run`: chạy Vitest theo chế độ CI
- `npm run build`: type-check và build bundle production

## Trạng thái refactor hiện tại

### Đã làm trong đợt này

- Chuẩn hóa design tokens, typography, button, form và thứ tự import CSS để giao diện đồng đều hơn trên toàn app.
- Nâng cấp account shell và profile page: avatar thật, OTP resend/timer, form section rõ ràng hơn, copy trung thực hơn với năng lực backend hiện có.
- Tách riêng logic upload avatar thành `features/account/hooks/use-profile-avatar-upload.ts` để giảm độ phức tạp của `profile-editor-form.tsx`.
- Gom tài liệu frontend về ít đầu mối chính và xóa các doc frontend trùng/lạc hậu trong `docs/annotated/`.

### Còn lại

- Tiếp tục chia nhỏ các page lớn như `pages/admin/admin-page.tsx`, `pages/storefront/catalog-page.tsx`, `pages/storefront/category-page.tsx`.
- Giảm thêm CSS hardcode theo page bằng shared primitives cho card, filter, table, empty state.
- Bổ sung test cho profile/account flow và regression test cho các bề mặt storefront quan trọng.
- Rà soát accessibility sâu hơn cho keyboard states, focus order và empty/loading states.

## Tài liệu liên quan

- [Frontend Architecture](../docs/deep-dive/frontend-architecture.md)
- [Frontend Refactor Status](../docs/deep-dive/frontend-refactor-status.md)
- [Annotated Frontend App](../docs/annotated/frontend-app.md)
- [Annotated Frontend Source Map](../docs/annotated/frontend-source-map.md)
