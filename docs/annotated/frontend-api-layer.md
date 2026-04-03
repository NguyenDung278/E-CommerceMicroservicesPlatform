# Annotated: Frontend API Layer

Tài liệu này giải thích lớp trung gian giữa UI và backend của frontend React + Vite.

File nên mở song song:

- `frontend/src/shared/api/http-client.ts`
- `frontend/src/shared/api/error-handler.ts`
- `frontend/src/shared/api/normalizers.ts`
- `frontend/src/shared/api/index.ts`
- `frontend/src/shared/api/modules/*.ts`
- `frontend/src/shared/http/client.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/http/client.ts`
- `frontend/src/shared/types/api.ts`

## 1. Tầng này tồn tại để làm gì

Nó giải quyết bốn việc:

1. gửi request HTTP một cách nhất quán
2. parse envelope backend tại một chỗ
3. normalize dữ liệu thô thành shape UI dùng được
4. gom API call theo domain thay vì để page tự `fetch`

Nếu thiếu tầng này:

- mỗi page sẽ parse response theo cách riêng
- auth header và error mapping dễ bị lệch
- UI dễ phụ thuộc trực tiếp vào shape JSON backend

## 2. `http-client.ts`: cổng raw nhất với network

### Trách nhiệm chính

- quyết định `API_BASE_URL`
- dựng headers
- thêm `Authorization` khi có token
- thêm `X-CSRF-Token` nếu meta/cookie tồn tại
- xử lý JSON body hoặc `FormData`
- parse envelope
- ném `HttpError` typed

### Vì sao code như vậy

Một app có nhiều request nên có “cổng HTTP chung” để:

- auth header nhất quán
- error handling nhất quán
- policy network thay đổi ở một nơi là đủ

### Điểm đáng nhớ

`API_BASE_URL` mặc định là chuỗi rỗng. Điều đó có nghĩa:

- frontend ưu tiên gọi cùng origin như `/api/...`
- hợp với runtime qua reverse proxy hoặc gateway cùng host

Đây là lựa chọn thực dụng hơn việc hardcode `http://localhost:8080` vào từng module.

## 3. `error-handler.ts`: dịch lỗi kỹ thuật sang thông điệp có ích

### Nó đang làm gì

- nhận diện `HttpError`
- map HTTP status và detail sang message dễ hiểu hơn
- phân biệt network error, timeout, unauthorized, validation error
- có helper `logError` và `createErrorHandler`

### Vì sao đây là pattern tốt

UI không nên hiển thị lỗi kỹ thuật thô cho người dùng.

Khi gom error translation vào một file:

- wording nhất quán hơn
- page code gọn hơn
- muốn cải thiện UX thì sửa tập trung được

## 4. `shared/types/api.ts`: contract type ở phía UI

Đây là file type canonical của frontend.

Các nhóm type đáng chú ý:

- `ApiEnvelope`, `ApiMeta`
- `UserProfile`, `AuthPayload`
- `Product`, `ProductVariant`, `ProductReview*`
- `Cart`, `CartItem`, `Address`, `ShippingAddress`
- `Order`, `OrderItem`, `OrderEvent`, `OrderPreview`
- `Payment`, `Coupon`, `AdminOrderReport`

### Vì sao nên có một file type trung tâm

- route, component, hook và normalizer nói cùng một ngôn ngữ
- người mới muốn biết object shape chỉ cần mở một chỗ
- dễ phát hiện contract drift với backend

## 5. `normalizers.ts`: lớp phòng thủ rất đáng học

`normalizers.ts` là file lớn, nhưng có giá trị thực tế cao.

### Nó đang làm gì

- nhận `unknown` data
- ép field về string/number/boolean với fallback
- normalize list/object theo domain
- tính thêm một số giá trị tiện cho UI

### Vì sao code như vậy

Trong app thật, response backend có thể:

- thiếu field
- trả `null`
- lệch type
- trả shape chưa hoàn toàn ổn định trong giai đoạn refactor

Nếu UI dùng dữ liệu thô:

- `undefined.map(...)` hoặc `null.property` sẽ xuất hiện rất nhanh
- guard null sẽ lặp khắp component

Normalizer dời phần “phòng thủ” ra đúng boundary.

### Trade-off

- file sẽ lớn dần
- cần kỷ luật khi thêm endpoint mới

Khi domain lớn thêm, nên tách theo cụm như `product.normalizers.ts`, `order.normalizers.ts`, `payment.normalizers.ts`.

## 6. `shared/api/index.ts`: cây cầu giữa kiến trúc mới và import cũ

File này làm hai việc:

- re-export module mới
- cung cấp object `api` kiểu cũ để giữ compatibility

### Vì sao strategy này tốt

Repo tránh “big bang rewrite”. Thay vào đó:

- module mới đã có
- route/page cũ chưa cần đổi toàn bộ cùng lúc

Đây là một cách refactor thực chiến rất nên học.

### Điều cần nhớ

`api` unified object là lớp compatibility, không phải dấu hiệu kiến trúc module hóa thất bại.

## 7. Các API module theo domain

### `authApi`

- register, login, refresh
- verify email, forgot/reset password
- get/update profile
- phone verification
- resend verification email
- build OAuth start URL

### `userApi`

- list/create address
- list users
- update role

### `productApi`

- list/get product
- reviews
- popularity
- create/update/delete product
- upload images

### `cartApi`

- get/add/update/remove/clear cart

### `orderApi`

- create, preview, list, detail, events, cancel
- admin report helper

### `paymentApi`

- process payment
- history/detail/by order

### `adminApi`

- admin orders
- coupons
- payment refund/history by order

## 8. Compatibility layer trong cây import

Ngoài `shared/api/index.ts`, repo còn có thêm các bridge:

- `shared/http/client.ts` -> `shared/api/http-client.ts`
- `lib/api.ts` -> `shared/api`
- `lib/http/client.ts` -> `shared/http/client.ts`
- `lib/normalizers/index.ts` -> `shared/api/normalizers.ts`
- `features/*/lib/api.ts` -> `shared/api`
- `features/*/types/api.ts` -> `shared/types/api.ts`

### Ý nghĩa khi học source

Nếu thấy một module import từ `../http/client` hoặc `../../types/api`, đừng vội kết luận repo đang sai cấu trúc. Hãy kiểm tra xem file đó có đang đi qua lớp compatibility hay không.

## 9. Những điểm lệch contract đáng ghi chú

Đây là phần có giá trị học tập cao vì nó cho thấy ranh giới giữa “kiến trúc mong muốn” và “contract backend hiện có”.

### Lệch contract backend

- merge guest cart vẫn được xử lý ở provider thay vì qua một endpoint `/api/v1/cart/merge`
- `orderApi.cancelOrder` đã được đồng bộ về `PUT /api/v1/orders/:id/cancel`
- các helper compatibility từng trỏ tới contract không tồn tại như `mergeCart` và `verifyPaymentSignature` đã được loại bỏ khỏi API layer

### Điều nên học từ các điểm lệch này

- frontend helper tồn tại không đồng nghĩa backend đã sẵn route thật
- khi backend chưa có contract thật, xóa helper giả là tốt hơn giữ API surface gây hiểu lầm
- docs tốt phải nêu đúng hiện trạng, không giả định mọi helper đều production-ready
- compatibility layer giúp refactor an toàn, nhưng cũng có thể che bớt technical debt nếu không đọc kỹ

## 10. Khi nào nên dùng mẫu kiến trúc này

Dùng tốt khi:

- app gọi nhiều endpoint
- backend có envelope chuẩn
- muốn tách rõ UI và network boundary
- cần refactor dần mà không phá tất cả import cũ

Không cần quá nặng nếu:

- app rất nhỏ
- chỉ có vài request đơn giản
- chưa có nhu cầu tái sử dụng logic request

## 11. Mẹo nhớ nhanh

- `http-client.ts`: gửi request
- `error-handler.ts`: dịch lỗi
- `types/api.ts`: hợp đồng dữ liệu phía UI
- `normalizers.ts`: chống dữ liệu bẩn làm vỡ UI
- `modules/*.ts`: map domain sang endpoint
- `index.ts`: cầu nối compatibility

## 12. Lỗi thường gặp

- thêm endpoint mới nhưng quên normalizer
- dùng response thô ở page thay vì type đã normalize
- sửa API module mà quên object `api` compatibility
- assume helper có trong frontend nghĩa là backend chắc chắn đã có route tương ứng

## 13. Cách debug

1. Request fail: bắt đầu ở `http-client.ts`
2. Message người dùng lạ: xem `error-handler.ts`
3. UI nhận object thiếu field: xem `normalizers.ts`
4. Route gọi nhầm endpoint: xem module domain tương ứng
5. Import path trông cũ: trace tiếp qua lớp compatibility

## 14. Mối liên hệ với file khác

- [frontend-source-map.md](./frontend-source-map.md)
- [frontend-auth-cart-providers.md](./frontend-auth-cart-providers.md)
- [frontend-routes-and-flows.md](./frontend-routes-and-flows.md)
