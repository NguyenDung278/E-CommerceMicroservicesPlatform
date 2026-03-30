# Feature Tracker

Tài liệu này theo dõi hai thứ:

- feature nào đang thật sự có trong source code hiện tại
- hướng mở rộng nào đáng làm tiếp, bám sát trạng thái repo và định hướng refactor frontend theo hướng dễ đọc, dễ quản lý, dễ mở rộng

Các nhãn trạng thái dùng trong file này:

- `Đang dùng`: đã có trong runtime mặc định hoặc đã được UI/backend dùng thật
- `Optional`: có trong code nhưng phụ thuộc config hoặc hạ tầng phụ trợ
- `Partial`: đã có một phần nhưng flow chưa khép kín hoặc UI/backend chưa khớp hoàn toàn
- `Experimental`: đã có nhánh triển khai nhưng chưa phải đường chạy mặc định

## Hiện trạng feature theo domain

### 1. Tài khoản, danh tính và phân quyền

- `Đang dùng`: đăng ký, đăng nhập, refresh token, verify email, forgot password, reset password qua `user-service` và gateway.
- `Đang dùng`: lấy/cập nhật profile người dùng.
- `Đang dùng`: quản lý địa chỉ giao hàng ở backend, gồm create/list/update/delete/set-default.
- `Đang dùng`: admin có thể xem danh sách user và đổi role qua `/api/v1/admin/users`.
- `Optional`: Google OAuth đã có start/callback/exchange flow, nhưng chỉ hoạt động khi cấu hình `OAUTH_GOOGLE_*`.
- `Optional`: xác minh số điện thoại qua Telegram OTP đã có đầy đủ status/send/resend/verify, nhưng phụ thuộc `TELEGRAM_*`.
- `Đang dùng`: local bootstrap account cho `admin` và `staff` chỉ dành cho development.
- `Partial`: frontend account area đã có nhiều trang, nhưng phần đổi mật khẩu và preference/security chưa nối trọn vẹn với capability backend hiện có.

### 2. Catalog, sản phẩm và media

- `Đang dùng`: CRUD sản phẩm với các field như brand, sku, tags, variants, image_url, image_urls, status `draft|active|inactive`.
- `Đang dùng`: product listing public có cursor pagination, `next_cursor`, `has_next`, filter theo category, brand, tag, status, search, min/max price, size, color, sort.
- `Đang dùng`: review sản phẩm gồm list, summary, lấy review của tôi, create/update/delete review.
- `Đang dùng`: upload ảnh sản phẩm qua endpoint `/api/v1/products/uploads`.
- `Optional`: MinIO object storage đã được bật trong compose và được `product-service` dùng nếu object storage enabled.
- `Optional`: Elasticsearch search index đã được bật trong compose; `product-service` có sync search index khi startup nếu config bật.
- `Đang dùng`: gRPC product lookup đang được `cart-service` và `order-service` dùng để đọc thông tin sản phẩm/stock có tính authoritative.
- `Đang dùng`: low-stock monitor chạy nền trong `product-service`.
- `Partial`: ở frontend chính, ngoài các category động từ API còn có 4 trang editorial/static data là `Shop Men`, `Shop Women`, `Footwear`, `Accessories`.

### 3. Cart, checkout và giao vận

- `Đang dùng`: `cart-service` lưu giỏ hàng của user trong Redis với TTL, hỗ trợ get/add/update/remove/clear cart.
- `Đang dùng`: frontend React có guest cart trong `localStorage` và merge lại sau login bằng cách replay `addToCart`.
- `Đang dùng`: checkout flow gọi `order-service` để preview order trước khi create.
- `Đang dùng`: shipping method hiện có `standard`, `express`, `pickup`.
- `Đang dùng`: coupon đã có backend create/list trong admin và được dùng trong order flow.
- `Partial`: chưa có server-side guest cart hoặc endpoint merge cart riêng; merge hiện nằm ở logic frontend.

### 4. Đơn hàng, timeline và vận hành admin

- `Đang dùng`: user có thể preview, tạo đơn, xem danh sách đơn, xem chi tiết đơn, xem timeline/event, hủy đơn.
- `Đang dùng`: admin/staff có thể xem report, list đơn, xem chi tiết, xem event, cập nhật trạng thái, hủy đơn.
- `Đang dùng`: order-service có `audit_entries` và `order_events` để lưu vết.
- `Đang dùng`: order-service consume payment event từ RabbitMQ để chuyển trạng thái đơn sang `paid` hoặc `refunded`.
- `Đang dùng`: order-service restore stock khi cancel flow yêu cầu.
- `Đang dùng`: endpoint `/api/v1/catalog/popularity` đang được frontend dùng cho một số khu vực catalog/home.
- `Partial`: admin order listing vẫn theo page/limit/total metadata, chưa đi theo cursor như product catalog.

### 5. Thanh toán

- `Đang dùng`: tạo payment, lấy payment history, lấy payment detail, lấy payment theo order, refund cho admin/staff.
- `Đang dùng`: webhook MoMo đã có verify signature bằng secret cấu hình.
- `Đang dùng`: payment-service publish `payment.completed`, `payment.failed`, `payment.refunded` sang RabbitMQ.
- `Đang dùng`: model payment đã có các field lifecycle tương đối đầy đủ như gateway provider, gateway transaction ID, checkout URL, signature_verified, outstanding_amount.
- `Partial`: backend chấp nhận nhiều payment method hơn (`manual`, `momo`, `credit_card`, `digital_wallet`, `demo`), nhưng frontend chính hiện chủ yếu expose `manual` và `momo`.
- `Partial`: chưa thấy idempotency key rõ ràng cho initiation/payment retry path.

### 6. Thông báo và async workflow

- `Đang dùng`: `notification-service` consume event từ RabbitMQ và gửi email cho order/payment flows.
- `Đang dùng`: service này có HTTP server nội bộ tối thiểu cho health/metrics, không phải public business API.
- `Partial`: chưa có notification center riêng ở backend để phục vụ in-app notification hoặc user inbox.

### 7. Frontend React + Vite (`frontend/`)

- `Đang dùng`: đây là frontend local chính, có storefront, auth pages, cart, checkout, profile, orders, payments, admin area.
- `Đang dùng`: API layer đã được tách thành `frontend/src/lib/api/*` và vẫn có lớp compatibility qua `frontend/src/lib/api.ts`.
- `Đang dùng`: `AuthProvider` và `CartProvider` đang là hai provider chính cho session/cart flow.
- `Đang dùng`: `/admin` đã nối với API thật cho products, upload ảnh, coupon, order report/listing, payment history/refund, user role.
- `Partial`: một số trang account vẫn thiên về UI hoặc derived data hơn là flow nghiệp vụ hoàn chỉnh, nhất là `SecurityPage`, `NotificationsPage`, một phần `AddressesPage`.

### 8. Frontend Next.js (`client/`)

- `Experimental`: `client/` đã có nhiều route storefront/account, provider cho auth/cart/wishlist và Dockerfile riêng.
- `Experimental`: chưa có service `client` trong Docker Compose mặc định.
- `Experimental`: CI hiện không build `client/`; workflow publish Docker cũng không push image cho `client/`.
- `Experimental`: phù hợp để thử nghiệm hướng UI khác, nhưng chưa nên coi là source of truth cho onboarding.

### 9. DevOps, observability và local runtime

- `Đang dùng`: Docker Compose hiện có đầy đủ `frontend`, `api-gateway`, 6 Go services, PostgreSQL, Redis, RabbitMQ, MinIO, Jaeger, Elasticsearch, Prometheus, Grafana, Nginx edge.
- `Đang dùng`: gateway và các service có tracing/metrics/logging theo cấu trúc hiện có.
- `Đang dùng`: CI chạy repo-safety, Go checks cho mọi module và build `frontend`.
- `Đang dùng`: Docker publish workflow build/push `api-gateway`, tất cả Go services và `frontend`.
- `Partial`: Prometheus/Grafana có trong compose nhưng hiện chưa publish port ra host.

## Các điểm lệch hoặc khoảng trống đang thấy từ source

- `frontend/src/lib/api/cart.ts` có helper `mergeCart`, nhưng backend/gateway hiện không có route `/api/v1/cart/merge`. Merge thật đang nằm ở logic provider phía frontend.
- `frontend/src/lib/api/order.ts` đang gọi hủy đơn bằng `POST`, trong khi route backend/gateway user hiện là `PUT /api/v1/orders/:id/cancel`.
- `frontend/src/lib/api/payment.ts` có helper `verifyPaymentSignature`, nhưng backend không có route `/api/v1/payments/:id/verify`.
- `frontend` có UI cho security/preferences/notifications, nhưng chưa phải mọi hành vi đều có backend API chuyên biệt hoặc flow hoàn chỉnh.
- `client/README.md` mô tả phạm vi hẹp hơn so với source hiện tại của `client/`.
- local runtime mặc định không chạy `client/`, không expose Postgres/Redis/RabbitMQ ra host, và `http://localhost` không phải frontend chính.

## Hướng mở rộng gợi ý bám theo codebase hiện tại

| Ưu tiên | Đề xuất | Giá trị mang lại | Phụ thuộc chính |
| --- | --- | --- | --- |
| P0 | Chuẩn hóa kiến trúc frontend theo domain module trong `frontend/`: tách rõ page container, hook/use-case, API mapper, UI component thuần | Giảm độ khó khi refactor, dễ đọc hơn, giảm coupling giữa UI và business logic | Cần chốt boundary cho auth, catalog, cart, checkout, admin |
| P0 | Làm sạch API layer frontend và sửa các contract mismatch hiện có như `mergeCart`, `cancelOrder`, `verifyPaymentSignature` | Tránh bug âm thầm, giảm chỗ phải workaround trong provider/page | Cần đối chiếu lại route gateway và service thật |
| P0 | Nối trọn vẹn các flow account còn partial: đổi mật khẩu, quản lý địa chỉ rõ ràng hơn, notifications/preferences có boundary thật hoặc ghi rõ chỉ là UI | Làm account area bớt "nửa backend nửa mock", giúp onboarding dễ hiểu | Cần quyết định feature nào thực sự cần backend mới, feature nào giữ ở UI |
| P0 | Tách `/admin` thành các khối rõ hơn theo domain: users, products, coupons, orders, payments; gom guard quyền và action state | Giảm độ phức tạp của một page lớn, dễ mở rộng cho staff/admin | Cần chuẩn hóa naming, route segment và shared admin primitives |
| P1 | Chuẩn hóa strategy state management cho `frontend/`: tiếp tục với provider + custom hook khi đủ, chỉ thêm store/query library nếu pain point thật | Tránh thêm framework sớm nhưng vẫn giảm duplication và request orchestration rối | Cần audit chỗ nào đang duplicate fetch/cache/error state |
| P1 | Chuẩn hóa naming convention, DTO mapping và shared type strategy giữa `frontend/` và `client/` | Giảm drift giữa hai nhánh UI, giảm công refactor về sau | Cần quyết định nhánh UI nào là source of truth cho shared contract |
| P1 | Làm rõ search/filter/sort UX dựa trên contract catalog hiện có, đặc biệt khi backend đã có cursor pagination và optional Elasticsearch | Tăng giá trị thực cho product discovery mà không cần bẻ backend quá nhiều | Cần quyết định search nào dùng DB filter, search nào cần ES |
| P1 | Nâng cấp cart/checkout theo hướng retry-safe hơn: xác định rõ merge strategy, payment retry behavior, xử lý lỗi hiển thị tốt hơn | Giảm bug ở flow mua hàng, phù hợp với backend order/payment hiện có | Phụ thuộc vào việc chốt contract cart merge và payment initiation |
| P1 | Chuẩn hóa transaction helper cho write flow nhiều bước ở backend, sau đó cân nhắc outbox cho order/payment event quan trọng | Giảm duplication transaction code, tăng độ an toàn dữ liệu và event consistency | Cần khoanh rõ write path nào đang nhạy cảm nhất |
| P1 | Giảm dần `COUNT(*) + OFFSET/LIMIT` ở admin order listing hoặc ít nhất audit lại query/index theo số liệu | Tránh bottleneck khi dữ liệu đơn tăng | Cần số liệu query plan và nhu cầu UX thật của backoffice |
| P2 | Bổ sung test chiến lược cho các flow rủi ro cao: payment webhook, order status transition, authz admin/staff, frontend API integration quan trọng | Tăng tự tin khi refactor frontend/backend song song | Cần chốt test boundary trước để không viết test dàn trải |
| P2 | Tăng logging/monitoring cho async flow và lỗi frontend gọi API, tận dụng tracing/Prometheus/Jaeger đã có | Debug sự cố nhanh hơn, nhất là order/payment/notification path | Cần quyết định field correlation và dashboard tối thiểu |
| P2 | Rà soát bảo mật thực dụng: callback URL, upload, webhook idempotency, secret handling, authz cho admin route | Giảm risk khi dự án mở rộng tính năng thật | Cần checklist ngắn gọn bám repo thay vì policy chung chung |
| P3 | Quyết định rõ vai trò của `client/`: tiếp tục đầu tư hay giữ experimental; sau đó cập nhật CI/CD và docs cho nhất quán | Giảm nhiễu khi onboarding và giảm chi phí giữ hai nhánh UI | Cần thống nhất owner và mục tiêu của `client/` |
| P3 | Giữ tài liệu sống đồng bộ với source, ưu tiên README, Docker guide và feature tracker mỗi khi route/config/runtime thay đổi | Giảm nhầm lẫn cho contributor mới, giảm drift giữa docs và code | Cần đưa việc cập nhật docs vào checklist merge |

## Cách dùng file này

- Khi thêm feature mới, hãy cập nhật cả phần "Hiện trạng feature" và "Hướng mở rộng" nếu nó làm đổi roadmap.
- Khi refactor frontend, ưu tiên làm rõ trạng thái `Partial` trước khi bổ sung abstraction mới.
- Khi backend thay đổi contract, hãy rà lại ngay những dòng đang ghi "điểm lệch" để tránh tài liệu cũ tiếp tục tồn tại.
