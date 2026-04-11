# Frontend Refactor Status

Tài liệu này ghi lại những gì đã làm và những gì còn lại sau pass refactor frontend ngày 2026-04-11.

## Đã hoàn thành

### Design system và UI nền

- Chuẩn hóa font mới ở tầng token: `Manrope` cho body và `Fraunces` cho display.
- Đồng bộ spacing, radius, shadow, focus ring và motion token trong `frontend/src/styles/base/_variables.css`.
- Cập nhật button và form shared để control có cảm giác nhất quán hơn giữa storefront, account và admin.
- Đổi thứ tự import stylesheet để CSS legacy trong `styles/shared.css` không còn vô tình đè hệ modular mới.

### Account/profile

- Làm mới account shell và sidebar để bám cùng một hệ spacing/typography.
- Refactor `profile-editor-form.tsx` thành dạng ít trách nhiệm hơn:
  - avatar upload đi qua hook riêng `use-profile-avatar-upload.ts`
  - form chia thành section rõ hơn
  - hiển thị resend OTP, countdown, trạng thái xác minh và số lần thử còn lại
- `ProfileHeroPanel` giờ hiển thị avatar thật nếu có, cùng chip trạng thái email/phone verification.
- `ProfileMembershipCards` đổi copy để không ám chỉ 2FA production-ready khi backend chưa có.
- Gỡ dev badge kỹ thuật khỏi `ProfileHeroPanel` để phần profile chỉ còn thông tin hữu ích với người dùng.

### Storefront/admin refactor slice tiếp theo

- `catalog-page.tsx` đã chuyển sang hook `use-archive-catalog-state`, dùng shared toolbar/filter/card primitives thay cho phần lớn orchestration và card markup tại route.
- `category-page.tsx` giờ dùng `use-storefront-category-route`, `use-workbook-category-page-state`, và shared collection/filter/toolbar primitives để giảm logic dồn trong page.
- `home-workbook.ts` giờ lazy-load `xlsx` đúng lúc cần đọc workbook, nên storefront không phải kéo chunk Excel parser ngay từ initial load.
- Home, catalog, và workbook category cards giờ ưu tiên ảnh/link/giá live từ product service; khi có dữ liệu, media được lấy từ object storage URL do backend trả về thay vì chỉ dùng workbook image URL.
- Catalog và category listings đã có pagination shared theo cùng một primitive, áp dụng cho All Archive, Men, Women, Footwear, Accessories và các category routes tương ứng.
- Placeholder search của archive/category đã ổn định lại theo hành vi test mong đợi, đồng thời search input luôn hiển thị thay vì phụ thuộc state expand/collapse.
- `pages/admin/admin-page.tsx` đã tách render theo domain slice:
  - sidebar
  - overview
  - report
  - orders
  - users
  - coupons
  - catalog
- Các record card của admin đã chuyển dần sang shared record primitives thay vì giữ nguyên card/table markup riêng trong page.
- Đã dọn thêm copy kỹ thuật khỏi UI:
  - storefront không còn lộ copy kiểu API/workbook/sync route với người dùng cuối
  - admin không còn dùng label như `DB -> Workbook`, `object storage`, hay copy vận hành quá thiên về implementation detail

### Documentation

- Viết lại `frontend/README.md`, `docs/deep-dive/frontend-architecture.md`, `docs/annotated/frontend-app.md`, `docs/annotated/frontend-source-map.md`.
- Cập nhật index docs để phản ánh cây tài liệu mới.
- Xóa ba tài liệu frontend không còn cần thiết vì đã bị chồng chéo và lạc hậu:
  - `docs/annotated/frontend-api-layer.md`
  - `docs/annotated/frontend-auth-cart-providers.md`
  - `docs/annotated/frontend-routes-and-flows.md`

## Còn lại

### Refactor code

- Tiếp tục thu gọn CSS route-scoped cũ còn thừa ở storefront/admin sau khi đã chuyển render sang shared primitives.
- Cân nhắc tách tiếp phần state/action của admin page sang hooks chuyên biệt nếu dashboard còn mở rộng thêm.
- Nếu storefront categories bắt đầu có nhiều dữ liệu hơn curated slice hiện tại, cân nhắc nối pagination UI với cursor pagination thật từ product API thay vì chỉ chia trang trên tập dữ liệu đã nạp.

### Testing

- Thêm test cho profile editor, avatar upload states và phone verification branch.
- Thêm regression test cho account layout và route shell sau khi đổi typography/token.
- Bổ sung test riêng cho các component admin domain slices mới nếu dashboard còn tiếp tục thay đổi.
- Xem xét visual smoke test cho các surface chính: home, catalog, profile, checkout.
- Bổ sung thêm test riêng cho multi-page pagination và live-media fallback khi product service không trả về bản ghi khớp workbook.

### UX và accessibility

- Rà focus order trên mobile/account form.
- Kiểm tra empty/loading/error state cho các page lớn sau khi đổi layout.
- Chuẩn hóa copy cuối cùng giữa tiếng Việt và tiếng Anh cho toàn bộ account surface.

## Cách verify sau mỗi lát cắt tiếp theo

1. `cd frontend && npm run lint`
2. `cd frontend && npm run test -- --run`
3. `cd frontend && npm run build`
4. Rà thủ công ít nhất các route: `/`, `/products`, `/cart`, `/profile`, `/security`, `/admin`
