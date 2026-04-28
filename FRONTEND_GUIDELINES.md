# FRONTEND_GUIDELINES

## Rule Chung Bắt Buộc

- Front-end chỉ được sinh dựa trên API, route, DTO, response envelope và capability thật của back-end hiện có; không tự bịa dữ liệu, không tự thêm nghiệp vụ, không hard-code sản phẩm, user, order, payment hoặc trạng thái nếu back-end chưa cung cấp.

## Vai Trò

- Đóng vai trò là nhà phát triển front-end chuyên về ứng dụng thương mại điện tử.
- Ưu tiên trải nghiệm mua hàng rõ ràng, nhanh, dễ thao tác.
- Thiết kế giao diện theo hướng marketplace hiện đại, lấy cảm hứng từ Shopee và Lazada nhưng không sao chép nguyên mẫu.
- Tập trung vào các flow cốt lõi: xem sản phẩm, tìm kiếm, xem chi tiết, thêm vào giỏ, thanh toán, tài khoản.

## Phạm Vi Front-end

- Chỉ xây dựng các phần liên quan trực tiếp đến ứng dụng bán hàng.
- Các trang chính bắt buộc nên tách riêng:
- Trang chủ.
- Danh sách sản phẩm.
- Chi tiết sản phẩm.
- Giỏ hàng.
- Thanh toán.
- Tài khoản người dùng.
- Không gom toàn bộ chức năng vào một trang duy nhất.
- Không tạo màn hình quản trị, dashboard, biểu đồ, CMS hoặc workflow vận hành nếu người dùng không yêu cầu.
- Không tự tạo mock server hoặc dữ liệu tĩnh thay thế API thật.

## Nguyên Tắc API Và Dữ Liệu

- Luôn gọi dữ liệu động qua API back-end.
- Không hard-code danh sách sản phẩm, giá, ảnh, danh mục, tồn kho, thông tin user hoặc cart.
- Tôn trọng response envelope của back-end: `success`, `message`, `data`, `error`, `meta`.
- Tạo lớp `services` riêng cho HTTP client và API modules.
- Tách API theo domain như `productService`, `cartService`, `authService`, `orderService`, `userService`.
- Xử lý loading, empty state và error state cho mọi API quan trọng.
- Nếu API thiếu field cần thiết cho UI, ghi chú ngắn gọn field bị thiếu và không tự thêm field giả.
- Nếu back-end không hỗ trợ chức năng, không tự tạo flow giả ở front-end.
- Nếu route API chưa rõ, kiểm tra tài liệu back-end hoặc route map trước khi dùng.

## Capability Back-end Hiện Có Cần Dùng

- Auth email/password đang đi qua gateway với `POST /api/v1/auth/login`, `POST /api/v1/auth/register`, `POST /api/v1/auth/refresh`; login chấp nhận `email` hoặc `identifier` và trả `AuthPayload` gồm `token`, `refresh_token`, `user`.
- Đăng nhập Gmail/Google OAuth đã có ở `user-service`: bắt đầu bằng `GET /api/v1/auth/oauth/google/start?redirect_to=/account`, backend redirect sang Google, callback backend trả về frontend ở `/auth/callback#ticket=...&next=...`, frontend phải gọi `POST /api/v1/auth/oauth/exchange` với `{ "ticket": "..." }` để nhận token chuẩn. Không đọc token trực tiếp từ URL.
- Profile user dùng `GET /api/v1/users/profile` và `PUT /api/v1/users/profile`; avatar dùng `POST /api/v1/users/avatar`; các route này cần Bearer token.
- Wishlist đã có ở backend và cần được ưu tiên dùng cho UI yêu thích sản phẩm: `GET /api/v1/users/wishlist`, `POST /api/v1/users/wishlist` với `{ "product_id": "..." }`, `POST /api/v1/users/wishlist/sync` với `{ "product_ids": [...] }`, `DELETE /api/v1/users/wishlist/:productId`, `GET /api/v1/users/wishlist/alerts`. Source of truth là PostgreSQL trong `user-service`; frontend không lưu wishlist thật ở localStorage.
- Wishlist item hiện trả `user_id`, `product_id`, `baseline_price`, `baseline_stock`, `created_at`, `updated_at`; nếu UI cần tên/ảnh sản phẩm thì gọi product API bằng `product_id`, không tự bịa field.
- Notification preferences đã có dưới `/api/v1/users/notification-preferences`; wishlist alerts phụ thuộc preference `wishlist_back_in_stock` và `wishlist_price_drop`.
- Address book đã có dưới `/api/v1/users/addresses`; checkout/profile nên dùng API này khi cần địa chỉ thay vì tạo dữ liệu địa chỉ giả.
- Product catalog có `GET /api/v1/products`, `GET /api/v1/products/batch`, `GET /api/v1/products/:id`, `GET /api/v1/products/:id/reviews`, `GET /api/v1/products/search/assist`, `POST /api/v1/products/analytics/search/events`, `GET /api/v1/storefront/home`, `GET /api/v1/storefront/categories`; list sản phẩm dùng cursor pagination qua `meta.next_cursor` và `meta.has_next`. Frontend được dùng các query filter thật của backend: `search`, `category`, `brand`, `tag`, `status`, `min_price`, `max_price`, `size`, `color`, `sort`.
- Product review có route public `GET /api/v1/products/:id/reviews` và route cần đăng nhập `GET /api/v1/products/:id/reviews/me`, `POST /api/v1/products/:id/reviews`, `PUT /api/v1/products/:id/reviews/me`, `DELETE /api/v1/products/:id/reviews/me`. UI viết/sửa/xóa review sau mua chỉ nên mở khi đơn liên quan đã `delivered`.
- Cart dùng `GET/DELETE /api/v1/cart`, `POST /api/v1/cart/merge`, `POST /api/v1/cart/items`, `PUT/DELETE /api/v1/cart/items/:productId`.
- Order dùng `POST /api/v1/orders/preview`, `POST /api/v1/orders`, `GET /api/v1/orders`, `GET /api/v1/orders/summary`, `GET /api/v1/orders/:id`, `GET /api/v1/orders/:id/events`, `GET /api/v1/orders/:id/tracking`, `PUT /api/v1/orders/:id/cancel`, return flow dùng `GET /api/v1/orders/:id/return-eligibility`, `POST /api/v1/orders/:id/returns`, `GET /api/v1/orders/:id/returns`, `POST /api/v1/returns/:id/evidence`, `GET /api/v1/returns`.
- Payment dùng `POST /api/v1/payments`, `GET /api/v1/payments/history`, `GET /api/v1/payments/:id`, `GET /api/v1/payments/order/:orderId`, `GET /api/v1/payments/order/:orderId/history`; webhook `POST /api/v1/payments/webhooks/momo` không phải flow browser thông thường. Side effect quan trọng phải giữ idempotency key nếu service đã yêu cầu.
- Public coupon catalog cho shopper dùng `GET /api/v1/coupons/public?subtotal=...`; checkout vẫn phải xác nhận coupon cuối cùng qua `POST /api/v1/orders/preview`. Không gọi `/api/v1/admin/coupons` cho shopper UI.

## Kiến Trúc Thư Mục

- Mã nguồn phải chia rõ trách nhiệm theo thư mục.
- `components/`: component tái sử dụng như product card, header, search box, cart item, price label, rating, button.
- `pages/`: các trang chính như home, product list, product detail, cart, checkout, account.
- `routes/`: cấu hình router và route guard nếu cần.
- `services/`: HTTP client, API modules, request/response adapters.
- `styles/`: global style, tokens, layout, page-specific style.
- `types/` hoặc `models/`: kiểu dữ liệu dùng chung nếu dự án dùng TypeScript.
- `utils/`: helper nhỏ như format tiền, format ngày, build query string.
- Không đặt API call trực tiếp rải rác trong component nếu có thể đưa vào `services`.
- Không đặt logic phức tạp vào file style hoặc component trình bày đơn giản.

## Routing

- Router phải phản ánh flow mua hàng thực tế.
- Route đề xuất:
- `/`: trang chủ.
- `/products`: danh sách sản phẩm.
- `/products/:id`: chi tiết sản phẩm.
- `/cart`: giỏ hàng.
- `/checkout`: thanh toán.
- `/account`: tài khoản.
- `/auth/callback`: callback nội bộ để đổi OAuth ticket từ Gmail/Google thành session frontend.
- `/account/orders`: danh sách đơn hàng nếu back-end hỗ trợ.
- `/account/orders/:id`: chi tiết đơn hàng, timeline, payment history theo order, cancel CTA, return/refund CTA, upload evidence và review sau mua.
- `/payments/:id`: trạng thái thanh toán theo payment.
- `/payments/order/:orderId`: trạng thái thanh toán mới nhất theo order.
- Wishlist có thể đặt trong `/account#wishlist` hoặc route riêng `/account/wishlist` nếu UI cần tách màn hình; chỉ dùng khi backend wishlist route đã được gọi thật.
- Route cần đăng nhập phải có guard rõ ràng.
- Route không tồn tại phải có trang not found đơn giản.
- Không redirect vòng lặp khi token hết hạn hoặc người dùng chưa đăng nhập.

## Giao Diện Và Trải Nghiệm

- Lấy cảm hứng từ marketplace như Shopee và Lazada: rõ sản phẩm, rõ giá, rõ nút hành động, dễ quét bằng mắt.
- Giao diện phải sạch, thống nhất, khoảng cách hợp lý.
- Ưu tiên layout nhiều section nhưng không rối.
- Header nên có logo/text brand, ô tìm kiếm, lối vào giỏ hàng và tài khoản.
- Danh sách sản phẩm nên dùng grid responsive.
- Product card cần hiển thị tối thiểu: ảnh, tên, giá, mô tả ngắn nếu có, nút thêm vào giỏ.
- Chi tiết sản phẩm cần hiển thị: ảnh lớn, tên, giá, mô tả, trạng thái có thể mua nếu API cung cấp, nút thêm vào giỏ.
- Giỏ hàng cần hiển thị item, số lượng, giá, tổng tiền nếu API cung cấp.
- Thanh toán chỉ hiển thị các trường và bước mà back-end thật sự hỗ trợ.
- Checkout nên dùng `supported_shipping_methods` từ `POST /api/v1/orders/preview` để render shipping option cards; nếu preview chưa có dữ liệu thì chỉ render nhãn phương thức theo enum backend và không tự bịa phí.
- Coupon selector trên checkout dùng `GET /api/v1/coupons/public` để hiển thị voucher thật, sau đó xác nhận bằng order preview; không hard-code danh sách voucher cho người mua.
- Payment status page phải dùng payment API thật, hiển thị `checkout_url` nếu backend trả về và link ngược về chi tiết đơn.
- Trang chi tiết đơn hàng phải lấy timeline từ `/orders/:id/events`, tracking từ `/orders/:id/tracking`, payment history từ `/payments/order/:orderId/history`, return eligibility từ `/orders/:id/return-eligibility`; không tự suy diễn lịch sử trạng thái nếu API có dữ liệu.
- Product discovery nên ghi event filter/result click bằng `POST /api/v1/products/analytics/search/events`; event chỉ là best-effort, không được chặn điều hướng hoặc mua hàng khi analytics lỗi.
- Nút "Mua lại" trên chi tiết đơn hàng được phép thêm lại `order.items` vào cart qua cart API hiện có; không tạo order mới trực tiếp.
- Nút wishlist trên product card/detail phải phản ánh trạng thái thật từ `/api/v1/users/wishlist`; nếu chưa đăng nhập thì yêu cầu đăng nhập, không lưu tạm như dữ liệu chính thức.
- Không thêm hiệu ứng phức tạp làm giảm khả năng đọc hoặc gây nhiễu flow mua hàng.
- Không mô tả hoặc giải thích về giao diện trong output sinh mã; chỉ tạo file và code cần thiết.

## Thành Phần Sản Phẩm Cần Ưu Tiên

- Ảnh sản phẩm.
- Tên sản phẩm.
- Giá sản phẩm.
- Mô tả ngắn.
- Nút thêm vào giỏ.
- Trạng thái loading của ảnh hoặc card.
- Trạng thái hết hàng chỉ hiển thị nếu API có dữ liệu tồn kho hoặc trạng thái sản phẩm.
- Rating/review chỉ hiển thị nếu API trả dữ liệu tương ứng.
- Review editor sau mua chỉ gọi route review thật của product-service và chỉ hiển thị trong ngữ cảnh order `delivered`.
- Badge giảm giá chỉ hiển thị nếu API trả dữ liệu giảm giá.

## State Management

- Chỉ thêm state management library khi thật sự cần.
- Với state đơn giản, ưu tiên React state, context hoặc pattern có sẵn của framework.
- Cart state phải đồng bộ với API back-end khi người dùng đã đăng nhập hoặc khi back-end có cart endpoint.
- Không lưu source of truth quan trọng chỉ ở local state nếu back-end đã có API.
- Token/session phải được xử lý an toàn theo pattern có sẵn của dự án.
- Không log token, refresh token hoặc thông tin nhạy cảm ra console.

## Styling

- Style phải được tổ chức nhất quán trong `styles/` hoặc theo convention của framework.
- Dùng design tokens cho màu, spacing, radius, shadow, typography nếu có thể.
- Không dùng CSS inline tràn lan.
- Không dùng class name mơ hồ như `box1`, `left2`, `temp`.
- Layout phải responsive cho mobile, tablet và desktop.
- Ưu tiên khoảng trắng rõ ràng, card dễ đọc, màu nhấn nhất quán.
- Không dùng quá nhiều màu hoặc animation không cần thiết.

## Chuẩn Code

- Tuân thủ ESLint.
- Tuân thủ Prettier.
- Component phải ngắn, tên rõ intent.
- Tách component khi một file quá dài hoặc chứa nhiều trách nhiệm.
- Tên biến và hàm phải theo domain: `product`, `cartItem`, `order`, `price`, `quantity`.
- Không để dead code, import thừa hoặc console log debug.
- Không comment điều hiển nhiên.
- Chỉ viết comment khi cần giải thích constraint từ back-end hoặc trade-off kỹ thuật.

## Xử Lý Thiếu Back-end

- Nếu thiếu API cho một trang, chỉ ra ngắn gọn API đang thiếu.
- Nếu API thiếu field, chỉ ra tên field cần có.
- Nếu response shape chưa rõ, không tự đoán contract.
- Nếu flow thanh toán, order, auth hoặc cart chưa đủ dữ liệu, không tự dựng flow giả.
- Không tự ý thêm route mới vào front-end như thể back-end đã hỗ trợ.

## Output Khi Sinh Mã

- Chỉ tạo hoặc sửa file cần thiết.
- Không thêm phần giải thích giao diện.
- Không tạo dữ liệu mẫu hard-code.
- Không sinh tài liệu dài kèm theo code nếu người dùng không yêu cầu.
- Nếu có giới hạn từ back-end, ghi chú ngắn gọn sau khi hoàn tất.
