# Annotated: Frontend Routes And Flows

Tài liệu này giải thích các route/page chính của `frontend/` theo luồng dữ liệu thật. Mục tiêu không phải diễn giải mọi JSX, mà là giúp bạn trả lời:

- page này lấy data từ đâu
- page này gọi hook/provider/API nào
- side effect chính là gì
- page nào đã nối backend thật, page nào còn partial

Lưu ý khi đọc source:

- nhiều route hiện vẫn import qua các file compatibility như `../hooks`, `../lib`, `../ui`
- implementation thật của phần lớn logic vẫn nên trace về `features/*` và `shared/*`

## 1. Nhóm auth routes

### `LoginPage.tsx`

Luồng chính:

- đọc remembered identifier nếu có
- validate form bằng helper riêng
- gọi `useAuth().login(...)`
- nếu thành công:
  - lưu remembered identifier nếu bật remember me
  - push notification
  - redirect về `location.state.from` hoặc `/profile`
- hỗ trợ `beginOAuthLogin("google")`

Vì sao code như vậy:

- page chỉ xử lý form UX, không tự quản token
- notification stack giúp UX rõ hơn alert thô
- redirect giữ context trước login tốt hơn việc luôn đẩy về home

Điểm cần nhớ:

- login flow tốt ở đây là "validate cục bộ rồi mới gọi provider"
- page không tự chạm `localStorage` token; việc đó thuộc auth layer

### `RegisterPage.tsx`

Luồng chính:

- validate fields qua `validateRegisterFields`
- tách full name thành `first_name` và `last_name`
- gọi `useAuth().register(...)`
- sau thành công redirect vào account flow

Trade-off:

- split full name ở frontend là cách thực dụng cho form đơn giản
- nhưng nếu cần profile quốc tế phức tạp hơn, naming model có thể cần thiết kế lại

### `AuthCallbackPage.tsx`

Luồng chính:

- đọc `ticket`, `error`, `message`, `next` từ URL hash
- nếu có ticket:
  - gọi `exchangeOAuthTicket`
  - dùng `readPendingOAuthRemember()` để khôi phục lựa chọn remember
  - redirect về route trước login

Điểm đáng học:

- không nhận JWT thật qua URL
- chỉ nhận short-lived login ticket
- đây là pattern bảo mật tốt hơn so với redirect trả access token lên browser URL

Lưu ý học tập:

- copy trên page vẫn nhắc "Google, Facebook", nhưng implementation provider type hiện tại là Google-only

### `VerifyEmailPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`

Đây là nhóm route bám khá sát backend contract:

- verify email: lấy `token` từ query string rồi gọi API
- forgot/reset password: form đơn giản, boundary rõ

Pattern đáng học:

- token-backed page nên càng mỏng càng tốt
- side effect chính chỉ là đọc token, gọi API, hiển thị kết quả

## 2. Nhóm storefront routes

### `HomePage.tsx`

Luồng chính:

- gọi `api.listProducts({ status: "active", limit: 24 })`
- lấy một phần product thật để dựng hero/featured/category cards
- kết hợp data thật với editorial copy và fallback image cứng

Vì sao code như vậy:

- giữ trải nghiệm editorial rõ ràng
- nhưng vẫn bám vào product data thật của backend

Trade-off:

- content marketing và data thật đang nằm chung trong một page
- phù hợp cho local storefront demo/refactor, nhưng lâu dài có thể tách content config riêng

### `CatalogPage.tsx`

Luồng chính:

- fetch catalog index đầy đủ để dựng filter options
- fetch product list theo filter hiện tại
- nếu sort là `popular`, gọi thêm popularity endpoint rồi sort lại phía client
- add to cart qua `useCart()`

Điểm đáng học:

- tách "index dùng cho filter" và "result set đang hiển thị"
- đây là cách hợp lý khi UI cần dropdown/filter option đầy đủ

Trade-off:

- có hai request logic cho cùng domain catalog
- nhưng đổi lại filter UI phong phú hơn

### `CategoryPage.tsx`

Điểm rất quan trọng:

- 4 category đặc biệt (`Shop Men`, `Shop Women`, `Footwear`, `Accessories`) trả về page editorial/static
- category còn lại mới gọi API `listProducts`

Vì sao code như vậy:

- cho phép repo cùng lúc chứa storefront có tính biên tập và catalog API-driven
- cũng phản ánh rõ hiện trạng refactor: chưa phải mọi category đều chung một pipeline

### `ProductDetailPage.tsx`

Vai trò chính:

- lấy product detail
- lấy review list và “my review” song song
- chọn variant mặc định còn stock nếu có
- dựng related products theo category
- add to cart / buy now

Điểm cần nhớ:

- đây là page giao giữa product API, cart provider và auth state nếu có review của tôi
- page này dùng `Promise.allSettled(...)` ở lượt tải đầu tiên để lỗi ở nhánh review không làm hỏng luôn product detail

Vì sao code như vậy:

- product detail là dữ liệu bắt buộc
- review list và my review là dữ liệu quan trọng nhưng không nên làm màn hình trắng nếu lỗi tạm thời
- related products được lấy theo category trước rồi mới fallback sang danh sách active chung để tăng cơ hội hiển thị đủ 4 item

## 3. Nhóm cart và checkout

### `CartPage.tsx`

Luồng chính:

- đọc cart từ `useCart()`
- dựng `previewItems` từ cart items
- fetch `productMap` song song để enrich hình ảnh/category/brand/sku
- preview coupon bằng `api.previewOrder(...)`
- quantity change và clear cart đều reset coupon preview

Vì sao code như vậy:

- cart item lưu shape gọn, không cố giữ toàn bộ product object
- page chỉ enrich thêm product detail khi cần render đẹp hơn
- preview coupon là một side flow tách khỏi create order thật

Điểm đáng học:

- page không tự giữ business rule cart; nó gọi provider
- page chỉ giữ state UI như coupon preview, feedback, product enrichment

### `CheckoutPage.tsx`

Luồng chính:

- nhận item từ hai nguồn:
  - `directProduct` trong `location.state`
  - hoặc cart hiện tại
- prefill form từ saved address nếu có
- enrich product detail để render summary
- submit:
  1. create order
  2. process payment
  3. nếu checkout từ cart thì clear cart
  4. điều hướng sang `OrderDetailPage`

Vì sao code như vậy:

- checkout được thiết kế như orchestration page
- page này phối hợp auth, address, order, payment, cart
- direct buy và cart checkout cùng đi qua một flow chung

Trade-off:

- page khá dày vì đang giữ nhiều orchestration
- vẫn chấp nhận được vì boundary nghiệp vụ rõ: page orchestrate, backend mới là source of truth cho total/order/payment

## 4. Nhóm account routes

### `ProfilePage.tsx`

Page này là một trong những page nhiều logic nhất:

- lấy `user` từ auth
- lấy orders/payments qua `useOrderPayments`
- lấy addresses qua `useSavedAddresses`
- đồng bộ form profile với user + default address
- kéo trạng thái phone verification
- chạy countdown OTP/resend
- submit profile update có gắn phone verification

Vì sao code như vậy:

- profile là nơi hội tụ nhiều capability backend của `user-service`
- gom vào một page giúp nhìn rõ "account center" hiện tại hoạt động ra sao

Trade-off:

- page dài và phức tạp
- giá trị học tập cao vì cho thấy khi nào một page nên được tách tiếp thành hook/use-case nhỏ hơn

Điểm rất đáng học ở page này:

- nhiều biến derived được tách riêng thay vì nhồi vào JSX
- state OTP, countdown, verification status và profile draft được giữ tương đối rõ
- cho thấy cách một page account thực tế thường phải phối nhiều nguồn dữ liệu hơn một form CRUD cơ bản

### `OrdersPage.tsx`

- dùng `useOrderPayments(token)`
- sort và lazy reveal bằng `visibleCount`
- render order card thiên về UI editorial

Điểm đáng học:

- hook tổng hợp giúp page gọn hơn rất nhiều
- page chỉ lo presentation và small interaction

### `OrderDetailPage.tsx`

- fetch order
- sau đó cố fetch payment history theo order
- enrich từng order item bằng product lookup
- render payment checkout URL nếu gateway trả về hosted checkout

Lưu ý:

- page còn có khối "Dev Only: Beta Feature" thiên về placeholder/marketing

### `PaymentHistoryPage.tsx`

- dùng `useOrderPayments`
- flatten `paymentsByOrder` thành bảng lịch sử
- tính `totalPaid`, `pendingCount`, `failedCount`
- dựng highlight theo payment method

Pattern đáng học:

- derived view model được tính trong page qua `useMemo`
- không ép backend phải có thêm endpoint chỉ để phục vụ đúng layout này

### `AddressesPage.tsx`

Hiện trạng:

- list địa chỉ saved từ hook
- chưa có dedicated address form riêng
- CTA add/edit hiện đang đẩy về `/checkout`

Đây là ví dụ rõ của một page `Partial`: backend đã có capability address khá đủ, nhưng UI management chuyên biệt chưa tách riêng.

### `SecurityPage.tsx`

Hiện trạng:

- form đổi mật khẩu mới ở mức UI
- thực tế backend flow đang dùng reset-password/email
- 2FA toggle và backup code mang tính UI/placeholder nhiều hơn backend feature thật
- phần activity dựa vào user/orders/payments hiện có

Giá trị học tập:

- doc nên nói rõ page này partial, thay vì giả vờ feature đã hoàn tất

### `NotificationsPage.tsx`

Hiện trạng:

- preference toggle đang là local UI state
- feed được suy luận từ orders, payments, email verification
- chưa có notification center API riêng

Điểm đáng học:

- page vẫn có giá trị vì cho thấy cách dựng activity feed từ domain data sẵn có
- nhưng đây chưa phải kiến trúc notification hoàn chỉnh

## 5. `AdminPage.tsx`: powerful nhưng đang rất lớn

Page này đang gom nhiều surface admin:

- product create/update/delete
- upload ảnh sản phẩm
- coupon create/list
- admin order report/listing/cancel
- payment history theo order và refund
- user role management

Vì sao code như vậy hiện vẫn chấp nhận được:

- repo đang ưu tiên có một admin console chạy được end-to-end
- nhiều API backend đã sẵn
- gom một page giúp verify nhanh ở local

Nhược điểm:

- file dài
- state rất nhiều
- khó maintain nếu admin surface còn tiếp tục mở rộng

Điểm tốt đáng chú ý:

- đã có utility riêng `features/admin/utils/productForm.ts`
- utility này gánh phần parse tags, parse variants, normalize image URLs, validate image upload
- nhờ vậy `AdminPage` dù lớn vẫn bớt bị chìm trong string parsing và primitive validation

Khi nào nên refactor:

- khi admin actions tăng thêm
- khi muốn test từng domain admin riêng
- khi muốn tách hẳn dashboard, users, products, orders, payments, coupons thành các route con

## 6. Mẫu dependency flow nên nhớ

### Auth

`LoginPage/RegisterPage/AuthCallbackPage -> useAuth -> AuthProvider -> authApi -> gateway -> user-service`

### Catalog

`CatalogPage/CategoryPage/HomePage -> api/productApi -> normalizer -> ProductCard`

### Cart

`CatalogPage/ProductDetailPage/CartPage -> useCart -> CartProvider -> cartApi hoặc guest storage`

### Checkout

`CheckoutPage -> orderApi + paymentApi -> gateway -> order-service/payment-service`

### Account aggregation

`OrdersPage/PaymentsPage/SecurityPage/NotificationsPage/ProfilePage -> useOrderPayments/useSavedAddresses`

### Admin

`AdminPage -> api compatibility layer -> nhiều backend domain`

Nếu đang học refactor frontend scalable, đây là route rất phù hợp để luyện tách module:

- products
- coupons
- orders/payments
- users/report

## 7. Điểm cần ghi nhớ khi học

- page tốt là page orchestration hoặc presentation, không nên là nơi giữ mọi primitive logic
- route nào càng nặng về derived view model thì càng đáng cân nhắc hook riêng
- page partial không phải là "code dở"; điều quan trọng là docs ghi đúng hiện trạng để người sau không hiểu nhầm

## 8. Lỗi thường gặp

- Nhìn vào `route` rồi tưởng đó là toàn bộ logic, bỏ qua provider/hook/API layer bên dưới
- Tưởng mọi account page đều full backend-backed
- Tưởng 4 category editorial cũng đi qua product API như category thường
- Thấy admin page chạy được rồi tưởng kiến trúc đã tối ưu cho maintainability

## 9. Cách debug

1. Route lỗi: xem `App.tsx` và page file
2. Data lỗi: xem hook/provider/page gọi API nào
3. Contract lệch: xem `frontend-api-layer.md`
4. Import path khó hiểu sau refactor: xem `frontend-source-map.md`
5. UI account/admin không phản ánh backend capability: đối chiếu với gateway/service route thật

## 10. Mối liên hệ với file khác

- [frontend-source-map.md](./frontend-source-map.md)
- [frontend-app.md](./frontend-app.md)
- [frontend-auth-cart-providers.md](./frontend-auth-cart-providers.md)
- [frontend-api-layer.md](./frontend-api-layer.md)
