# Production-Readiness Roadmap

Tài liệu này dành cho lúc bạn đã đọc repo ở mức "biết file nào nằm ở đâu", nhưng muốn đi xa hơn:

- hiểu hệ thống hiện tại đủ chắc để không sửa sai boundary
- biết còn thiếu gì để biến một demo/local stack thành sản phẩm commerce production-ready
- có thứ tự học rõ ràng thay vì nhảy lung tung giữa frontend, backend, infra, và product

## 1. Hệ thống hiện tại đang cho bạn học được gì

Repo này đã có khá nhiều khối cốt lõi của một sản phẩm e-commerce thực tế:

- catalog và product detail
- cart và wishlist
- checkout, order, payment
- auth, profile, OTP verification
- event-driven integration giữa order, payment, notification
- observability cơ bản: structured logging, metrics, tracing
- multi-service runtime gần production qua Docker Compose

Điều quan trọng là: đây không phải sample toy app. Bạn có đủ chất liệu để học cách một sản phẩm commerce vận hành xuyên nhiều boundary.

## 2. Cách hiểu codebase theo đúng luồng sản phẩm

Nếu mục tiêu là hiểu hệ thống để build feature mới, hãy đọc theo journey thay vì đọc theo folder:

1. browse:
   `frontend/src/pages/storefront/home-page.tsx`, `catalog-page.tsx`, `category-page.tsx`
2. evaluate:
   `product-detail-page.tsx`, variant selection, review flow, wishlist save
3. commit:
   `cart-page.tsx`, `checkout-page.tsx`
4. fulfill:
   `services/order-service/`, `services/payment-service/`, `services/notification-service/`

Song song đó, map boundary thật:

- UI state và orchestration: `frontend/src/pages/`, `frontend/src/features/`
- API boundary: `frontend/src/services/api/`
- gateway routing: `api-gateway/`
- business rules: `services/*/internal/service/`
- persistence: `services/*/internal/repository/`

## 3. Những năng lực bạn nên học để ship production-ready

### A. Backend correctness

Bạn cần hiểu chắc:

- transaction và invariant ở order/payment/inventory flow
- idempotency cho payment, webhook, retry path
- optimistic locking hoặc row locking khi có stock/coupon cạnh tranh
- error mapping giữa repository -> service -> handler

Repo này đã cho bạn điểm bắt đầu tốt nhất ở:

- `services/order-service/internal/service/`
- `services/payment-service/internal/service/`
- `services/user-service/internal/service/`

### B. Data và performance

Bạn nên học:

- index, query shape, `EXPLAIN ANALYZE`
- pagination chiến lược: cursor vs offset
- cache chỉ khi có số liệu chứng minh
- search/index là integration phụ, không phải source of truth

Repo hiện có bài học tốt ở:

- `product-service` catalog listing
- `order-service` admin listing
- `docs/deep-dive/database-schema.md`

### C. Distributed systems vừa đủ

Không cần nhảy thẳng vào saga choreography. Hãy nắm:

- outbox/inbox pattern
- at-least-once delivery
- retry và dedupe
- graceful degradation với dependency phụ

Đọc:

- `docs/deep-dive/order-payment-outbox-inbox.md`
- `services/order-service/internal/repository/`
- `services/notification-service/`

### D. Frontend commerce UX

Nếu muốn build fashion-app tốt hơn, bạn nên học:

- variant selection không gây nhầm lẫn
- gallery theo finish/size/SKU
- mobile sticky CTA và thông tin ra quyết định tối thiểu
- saved items -> cart -> checkout handoff mượt
- empty/loading/error states rõ và có đường thoát

Đọc:

- `frontend/src/pages/storefront/product-detail-page.tsx`
- `frontend/src/pages/storefront/wishlist-page.tsx`
- `frontend/src/pages/storefront/cart-page.tsx`
- `frontend/src/pages/storefront/checkout-page.tsx`

### E. Security và operational safety

Muốn lên production, bạn phải quen với:

- auth/authz boundary
- secret/config discipline
- input validation
- safe logging
- migration strategy
- rollout/rollback mindset

Đọc:

- `pkg/config/`
- `pkg/middleware/`
- `services/*/cmd/main.go`
- `docs/learning/06-testing-and-verification.md`

## 4. Learning path thực dụng theo thứ tự

### Giai đoạn 1: hiểu repo và chạy đúng local

- `docs/learning/00-local-setup.md`
- `docs/learning/03-source-reading-roadmap.md`
- `README.md`

Kết quả mong đợi:

- tự chạy được stack
- biết frontend nào là runtime chính
- biết flow request đi qua gateway và service nào

### Giai đoạn 2: đọc một flow end-to-end

Chọn flow:

- wishlist -> cart -> checkout
- order -> payment -> notification

Kết quả mong đợi:

- trace được dữ liệu đi qua UI, API, service, DB, event
- biết rule nào nằm ở đâu và vì sao

### Giai đoạn 3: tự sửa một feature nhỏ nhưng trọn vòng

Ví dụ:

- polish wishlist badge/page
- thêm mobile sticky CTA
- cải thiện variant gallery
- thêm validation hoặc empty state rõ hơn

Kết quả mong đợi:

- biết sửa code mà không phá layering
- biết build/test/verifying đúng chỗ

### Giai đoạn 4: học production hardening

Sau khi đã sửa được UI/feature, chuyển sang:

- transaction safety
- retry/idempotency
- metrics/tracing
- integration tests
- migration discipline

## 5. Checklist tự hỏi trước khi nói "repo này đã production-ready"

- checkout có idempotent đủ cho retry chưa?
- payment webhook có verify, dedupe, retry-safe chưa?
- inventory/coupon có chống race condition chưa?
- log và metrics có đủ để debug incident chưa?
- migration có rollback path rõ chưa?
- feature quan trọng có test thành công, lỗi, edge case chưa?
- mobile storefront có đủ CTA rõ ràng để không tụt conversion không?

Nếu còn trả lời "chưa chắc", đó là backlog học tập và backlog sản phẩm của bạn.

## 6. Gợi ý feature tiếp theo theo mức độ giá trị

### Ưu tiên cao: production hardening

- inventory reservation theo thời gian ngắn khi bắt đầu checkout
- payment/idempotency key cho retry từ client hoặc webhook
- order status audit rõ hơn cho admin
- abandoned checkout recovery

### Ưu tiên cao: conversion UX

- saved sizes / preferred fit per user
- variant-specific gallery và size-guide tốt hơn
- sticky mobile checkout bar xuyên cart/checkout
- low-stock và restock notification từ wishlist

### Ưu tiên trung bình: retention

- back-in-stock alerts
- price-drop alerts cho wishlist
- saved collections / moodboards
- reorder flow từ order history

### Ưu tiên trung bình: post-purchase

- return / exchange request flow
- shipment tracking timeline
- richer payment history + invoice download

## 7. Cách dọn code cho đỡ noisy mà không over-engineer

Khi đụng vào một flow commerce, ưu tiên:

- đổi tên theo intent thay vì theo dữ liệu thô
- gom các helper transform nhỏ vào cuối file hoặc util thật gần
- giữ page component làm orchestration, đừng nhét persistence logic vào UI
- chỉ tạo abstraction khi có ít nhất hai consumer hoặc giúp test rõ rệt hơn
- xoá branch/comment thừa nếu chúng làm người đọc phải đoán

Một dấu hiệu tốt là: sau khi sửa, người mới có thể mở file và đoán đúng "đoạn này phụ trách bước nào trong journey mua hàng".

## 8. Kết luận

Muốn đi từ "biết repo này chạy" sang "có thể xây sản phẩm commerce thực chiến", bạn không cần học mọi thứ cùng lúc.

Thứ tự nên là:

1. hiểu journey người dùng
2. map journey đó vào boundary của source code
3. sửa một flow nhỏ nhưng trọn vòng
4. quay lại harden correctness, observability, và operations

Đi đúng thứ tự này sẽ giúp bạn vừa học nhanh hơn, vừa tránh biến code thành một mớ abstraction mà không tăng chất lượng sản phẩm.
