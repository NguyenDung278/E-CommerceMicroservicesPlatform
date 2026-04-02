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
- `Đang dùng`: xác minh số điện thoại qua Telegram OTP đã có đầy đủ status/send/resend/verify, kèm theo OTP rate limiting.
- `Đang dùng`: user profile management, chuẩn hoá đầu vào (input normalization) cho email, số điện thoại, và tên người dùng.
- `Đang dùng`: local bootstrap account cho `admin` và `staff` chỉ dành cho development.
- `Partial`: frontend account area đã có nhiều trang, nhưng phần đổi mật khẩu và preference/security chưa nối trọn vẹn với capability backend hiện có.

### 2. Catalog, sản phẩm và media

- `Đang dùng`: CRUD sản phẩm với các field như brand, sku, tags, variants, image_url, image_urls, status `draft|active|inactive`.
- `Đang dùng`: product listing public có cursor pagination, `next_cursor`, `has_next`, filter theo category, brand, tag, status, search, min/max price, size, color, sort.
- `Đang dùng`: review sản phẩm gồm list, summary, lấy review của tôi, create/update/delete review được tối ưu bằng Redis cache, transaction bảo đảm tính nhất quán, và có benchmark đánh giá hiệu năng.
- `Đang dùng`: upload ảnh sản phẩm qua endpoint `/api/v1/products/uploads`.
- `Optional`: MinIO object storage đã được bật trong compose và được `product-service` dùng nếu object storage enabled.
- `Optional`: Elasticsearch search index đã được bật trong compose; `product-service` có sync search index khi startup nếu config bật.
- `Đang dùng`: gRPC product lookup đang được `cart-service` và `order-service` dùng để đọc thông tin sản phẩm/stock có tính authoritative.
- `Đang dùng`: low-stock monitor chạy nền trong `product-service`.
- `Đang dùng`: ở frontend chính, có 4 trang thiết kế đặc biệt (editorial category page) với custom layout và filter logic: `Shop Men`, `Shop Women`, `Footwear`, `Accessories`.

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
- `Đang dùng`: order-service sử dụng HTTP client để lấy dữ liệu payment logic.
- `Đang dùng`: order-service consume payment event từ RabbitMQ qua cơ chế Outbox/Inbox message pattern để bảo đảm tính bền vững (durable message processing).
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

- `Đang dùng`: `notification-service` xử lý worker consume RabbitMQ bằng Redis store, tích hợp retry publisher và lưu trữ metrics cho queue state, delivery outcome.
- `Đang dùng`: service này có HTTP server nội bộ tối thiểu cho health/metrics, không phải public business API.
- `Đang dùng`: sử dụng kiến trúc Outbox và Inbox queue cho các luồng event bất đồng bộ quan trọng thay vì publish mất mát.

### 7. Frontend React + Vite (`frontend/`)

- `Đang dùng`: đây là frontend local chính, có storefront, auth pages, cart, checkout, profile, orders, payments, admin area.
- `Đang dùng`: API layer được quy hoạch tập trung lại cùng với kiến trúc dựa theo module tính năng (feature-based modular design), giúp code dễ quản lý hơn.
- `Đang dùng`: `AuthProvider` và `CartProvider` đang là hai provider chính cho session/cart flow.
- `Đang dùng`: `/admin` đã nối với API thật cho products, upload ảnh, coupon, order report/listing, payment history/refund, user role.
- `Partial`: một số trang account vẫn thiên về UI hoặc derived data hơn là flow nghiệp vụ hoàn chỉnh, nhất là `SecurityPage`, `NotificationsPage`, một phần `AddressesPage`.

### 8. Frontend Next.js (`client/`)

- `Experimental`: `client/` đã có nhiều route storefront/account, provider cho auth/cart/wishlist và Dockerfile riêng.
- `Experimental`: hỗ trợ kịch bản standalone preparation cho production, cấu hình image host policy cho Next.js optimization, và chia sẻ các API types tiêu chuẩn.
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

## Hướng mở rộng gợi ý bám theo codebase hiện tại (Best Solutions cho E-Commerce)

Dưới đây là lộ trình các tính năng đáng đầu tư nhất, bám sát các luồng microservices hiện tại để giúp dự án trở thành một nền tảng thương mại điện tử cấp độ Production, đáp ứng yêu cầu khắt khe về UI/UX và tính chính xác dữ liệu gốc.

### 1. Backend (Microservices, Hiệu năng, và An toàn Dữ liệu)

| Ưu tiên | Đề xuất (Backend) | Giá trị mang lại | Phụ thuộc chính / Giải pháp kỹ thuật |
| --- | --- | --- | --- |
| **P0** | **Quản lý Tồn kho & Đặt cọc (Stock Reservation / Allocation).** Lock số lượng khi user bắt đầu quá trình thanh toán, release sau 15 phút nếu hỏng/cancel. | Chống lỗi bán vượt hàng (Overselling) trong các dịp Flash Sale hay cao điểm khi nhiều khách cùng mua 1 sản phẩm. | Dùng Row-level lock (`SELECT FOR UPDATE`) ở `product-service` hoặc Redis Distributed Locks. Tách transaction rõ ràng. |
| **P0** | **Idempotency Key cho Order & Payment.** Ngăn chặn hành động bị lặp lại khi network rớt gói tin hoặc user bấm "Thanh toán" liên tục nhiều lần. | Chống trừ tiền 2 lần (double charge) hay tạo trùng đơn hàng cho cùng một session thanh toán. | Yêu cầu Frontend truyền `Idempotency-Key` header, Backend cache key này trên Redis trong 24h. |
| **P0** | **Cung cấp API Merge Guest Cart.** Mang logic gộp giỏ hàng (Guest -> Authenticated) xuống Backend `cart-service` thay vì để ở React Provider. | Server quản lý giỏ hàng thống nhất, chống thất thoát dữ liệu ngay cả khi user đăng nhập trên thiết bị khác. | Khai báo API `/api/v1/cart/merge` xử lý gộp Item IDs qua cache Redis. |
| **P1** | **Nâng cấp Search Engine chuyên sâu (Elasticsearch).** Triển khai Autocomplete, Fuzzy Search (tìm sai chính tả vẫn ra), và Faceted/Filter Search (lọc động). | Tính năng không thể thiếu để user tìm thấy đúng món hàng. Giảm tải truy vấn chéo nhiều bảng cho database PostgreSQL. | `product-service` chuyển queries Product List nặng từ DB sang Elasticsearch. Tập trung build Index Data. |
| **P1** | **Server-Sent Events (SSE) / WebSockets cho Trạng thái Đơn hàng.** Push kết quả thanh toán từ Gateway trực tiếp xuống thiết bị User. | Trải nghiệm App Real-time mượt mà, user không cần F5 (Reload) để biết đơn đã thanh toán xong hay chưa. | Nối tín hiệu từ RabbitMQ Payment Worker về API-Gateway để phát stream xuống Client. |
| **P2** | **Tối ưu Admin Dashboard với Materialized Views / Cache.** Cung cấp báo cáo doanh thu, sản phẩm bán chạy bằng tổng hợp background. | Giao diện Backoffice tính toán hàng triệu records không làm treo hệ thống User (`COUNT(*) + OFFSET`). | Thiết lập Cron jobs hoặc Postgres Materialized Views ở `order-service` để phân tích report. |

### 2. Frontend (React/Vite & Next.js, SEO, UI/UX)

| Ưu tiên | Đề xuất (Frontend) | Giá trị mang lại | Phụ thuộc chính / Giải pháp kỹ thuật |
| --- | --- | --- | --- |
| **P0** | **Đẩy mạnh SEO với Next.js (SSR / SSG) làm Storefront chính.** Đưa thư mục `client/` trở thành kênh bán lẻ mặc định thay vì Vite SPA. React/Vite lùi về phục vụ luồng App Private / Admin Backoffice. | Nguồn sống E-Commerce đến từ Organic Traffic (Google Search). Storefront SPA hiện tại rất khó index tự nhiên. | Merge các Components từ `frontend/` sang `client/`, cấu hình CI/CD Docker image chuẩn cho nhánh Next.js. |
| **P0** | **Tối ưu UI/UX State và Skeleton Loaders.** Xóa bỏ giao diện giật/nháy (layout shift) trong quá trình call API bằng cách áp dụng bộ khung Skeleton thay thế spinner ở mọi page. | Tăng điểm Core Web Vitals (LCP, CLS, FID) mang lại cảm giác premium, "bấm là load tức thì". | Áp dụng SWR / React Query trên frontend giúp cache tạm dữ liệu Catalog / Profile giữa các lần chuyển trang. |
| **P1** | **Triển khai Lazy Loading, Image Optimization tự động.** Mọi hình ảnh product listing phải được tự thu nhỏ, lazy load (chỉ render khi scroll tới). | Giảm dung lượng tải trang xuống 80%, site render nhanh hơn cho mạng di động yếu. | Dùng `next/image` và CDN provider policy phù hợp để tự format WebP / auto-sizing. |
| **P2** | **Phân quyền và Bảo mật Màn hình theo Role.** Tái cấu trúc bộ component chặn trang admin dựa theo logic Role-Based / JWT Expiration hợp lý. Xử lý timeout phiên tự động. | Mở rộng dễ dàng cho các role cụ thể trong Admin: Content Writer, Accountant, Super Admin thay vì chỉ 1 role. | Dùng Middleware Authentication tập trung của cả API & Frontend App. |
| **P3** | **Cá nhân hóa (Personalization) / Behavior Tracking.** Block "Sản phẩm vừa xem" (Recently Viewed) hoặc "Có thể bạn cũng thích". Khuyến nghị Cross-sell, Up-sell lúc Checkout. | Đẩy mạnh AOV (Average Order Value) - giá trị đơn hàng trung bình. Bí quyết tăng lợi nhuận sau chốt sale. | Frontend bám theo Storage Metadata kết hợp thuật toán Gợi ý nhẹ từ Backend `product-service`. |

## Cách dùng file này

- Khi thêm feature mới, hãy cập nhật cả phần "Hiện trạng feature" và "Hướng mở rộng" nếu nó làm đổi roadmap.
- Khi refactor frontend, ưu tiên làm rõ trạng thái `Partial` trước khi bổ sung abstraction mới.
- Khi backend thay đổi contract, hãy rà lại ngay những dòng đang ghi "điểm lệch" để tránh tài liệu cũ tiếp tục tồn tại.

