# Frontend Runtime Guide

`frontend/` là ứng dụng React + Vite dành cho admin console và workbook flow. Shopper storefront/account runtime chính trong Docker Compose nằm ở `client/`, không phải ở thư mục này.

## Khi nào sửa `frontend/`

- Sửa admin console, report, order management, payment management.
- Sửa workbook/import hoặc local operations UI.
- Sửa shared UI và API module đang được `frontend/` dùng thật.

Nếu mục tiêu là shopper storefront, auth, account hoặc payment return surface của Next.js, ưu tiên sửa `client/`.

## Cấu trúc nên nhớ

| Thư mục | Vai trò |
| --- | --- |
| `src/app/` | boot app, providers, layout shell |
| `src/pages/` | route-level screens |
| `src/features/` | logic theo domain như admin, auth, storefront |
| `src/services/api/` | HTTP client, module gọi gateway |
| `src/components/` | shared UI component |
| `src/styles/` | tokens, base styles, component styles |

## Source nên mở đầu tiên

1. `src/app/main.tsx`
2. `src/app/app.tsx`
3. `src/app/providers/app-providers.tsx`
4. `src/pages/admin/admin-page.tsx`
5. `src/features/admin/components/`
6. `src/services/api/modules/`

## Lệnh hay dùng

- `npm run dev`
- `npm run lint`
- `npm run test -- --run`
- `npm run build`

## Tài liệu repo liên quan

- `../README.md`
- `../docs/deep-dive/README.md`
- `../docs/annotated/README.md`
- `../docs/learning/README.md`
