# Hướng Dẫn Đánh Giá Đồng Bộ Frontend/Backend Và Roadmap Hiện Đại Hóa

Ngày kiểm tra: `2026-04-03`

Phạm vi tài liệu này:

- `frontend/`
- `client/`
- `api-gateway/`
- `services/*`
- `shared/`
- `deployments/docker/`
- `.github/workflows/`

Mục tiêu của tài liệu:

- đánh giá mức độ đồng bộ thực tế giữa front-end và back-end
- chỉ ra các điểm lệch contract, lệch UX, lệch quy trình build/deploy
- đề xuất danh sách file nên xóa, nên archive, hoặc nên giữ
- đưa ra roadmap tái cấu trúc vừa an toàn vừa thực dụng
- đề xuất hướng UI/UX hiện đại như các sàn lớn nhưng vẫn bám domain hiện tại
- đề xuất phương pháp nhập dữ liệu bằng Excel/CSV/Google Sheets để đồng bộ catalog dễ hơn

## 1. Cách kiểm tra

Các bước đã làm:

1. Đọc `README.md`, `LOGIC_FLOW.md`, cấu trúc thư mục và route của gateway/service.
2. Đối chiếu toàn bộ endpoint được gọi từ `frontend/` và `client/` với route thực tế ở gateway và service.
3. Kiểm tra các vùng code bị nhân đôi giữa hai app UI.
4. Kiểm tra các file artefact hoặc scaffold không còn giá trị lâu dài.
5. Chạy build/test quan trọng để tránh đánh giá thuần cảm tính.

Các lệnh verify đã chạy:

```bash
(cd pkg && go test ./...)
(cd api-gateway && go test ./...)
(cd proto && go test ./...)
(cd services/user-service && go test ./...)
(cd services/product-service && go test ./...)
(cd services/cart-service && go test ./...)
(cd services/order-service && go test ./...)
(cd services/payment-service && go test ./...)
(cd services/notification-service && go test ./...)
(cd frontend && npm run build)
(cd client && npm run lint)
(cd client && npm run build)
```

Kết quả:

- toàn bộ Go module đã pass `go test ./...`
- `frontend/` build pass
- `client/` lint và build pass

### 1.1. Các nguồn bằng chứng chính

Những kết luận quan trọng nhất trong tài liệu này chủ yếu dựa trên các file sau:

- `api-gateway/internal/handler/order_handler.go`
- `services/order-service/internal/handler/order_handler.go`
- `frontend/src/shared/api/modules/orderApi.ts`
- `client/src/lib/api/order.ts`
- `frontend/src/shared/api/modules/cartApi.ts`
- `frontend/src/shared/api/modules/paymentApi.ts`
- `services/product-service/internal/handler/product_handler.go`
- `api-gateway/internal/handler/product_handler.go`
- `.github/workflows/ci.yml`
- `.github/workflows/docker-publish.yml`
- `frontend/package.json`
- `client/package.json`

Giới hạn của đợt đánh giá này:

- chưa chạy browser E2E test
- chưa dựng full Docker Compose rồi click-flow thủ công
- chưa benchmark runtime thật của search, checkout, payment webhook

### 1.2. Điều phiên bản đầu của tài liệu này còn chưa tốt

Phiên bản đầu của file này có ba điểm yếu chính:

- nhiều nhận định đúng về mặt source code, nhưng chưa nói rõ đâu là phần đã verify bằng build/test và đâu là phần mới chỉ suy luận từ source
- có khuyến nghị mang tính đúng hướng nhưng chưa bám hoàn toàn vào convention route đang dùng thật trong repo, đặc biệt ở nhánh `product-service`
- chưa nói rõ việc chọn `client/` làm UI chính chỉ hợp với storefront/account, còn admin hiện vẫn đang nằm ở `frontend/`

Trong lần cập nhật này, các điểm đó đã được sửa bằng cách:

- thêm mục nguồn bằng chứng chính
- chỉnh lại khuyến nghị import để bám convention route hiện tại
- bổ sung caveat rõ ràng về phạm vi của `client/` so với admin UI

## 2. Kết luận nhanh

Đánh giá ngắn gọn:

- Backend hiện tại có nền khá tốt: layering rõ, test tốt hơn mặt bằng trung bình, tài liệu bám source, và nhiều feature quan trọng đã có transaction/outbox/inbox/observability.
- Front-end và back-end đồng bộ tốt ở các luồng lõi như auth, profile, address, catalog cơ bản, review, cart cơ bản, order, payment history.
- Tuy nhiên đồng bộ tổng thể chưa cao vì repo đang ở trạng thái "hai storefront song song"; một số lệch contract cụ thể đã được sửa, nhưng drift kiến trúc UI và runtime vẫn còn rõ.

Nếu cần chấm mức độ đồng bộ theo góc nhìn kỹ thuật, đây là đánh giá định tính:

- Đồng bộ domain backend: cao
- Đồng bộ API contract giữa UI và gateway/service: trung bình, đã cải thiện sau khi sửa route hủy đơn và dọn dead helper
- Đồng bộ design system và chiến lược UI: thấp đến trung bình
- Đồng bộ CI/deploy/runtime giữa hai app giao diện: trung bình, vì CI đã bao phủ `client/` nhưng deploy/runtime chính vẫn chưa theo kịp

Nói ngắn gọn: hệ thống đang "chạy được và có nền tốt", nhưng chưa nên xem là đã đồng bộ hoàn toàn giữa front-end và back-end.

## 3. Những gì repo đang làm tốt

### 3.1. Backend có cấu trúc tương đối sạch

Điểm tốt rõ ràng:

- phân tầng `handler -> service -> repository` khá nhất quán
- Go service dùng raw SQL và transaction rõ ràng, ít abstraction thừa
- `pkg/` đã gom được config, middleware, logger, observability, response, validation
- `product-service`, `order-service`, `payment-service` đã có nhiều tín hiệu của production thinking

### 3.2. Shared types đã có nền móng

`frontend/` và `client/` cùng dùng type chung từ `shared/types/api.ts`, đây là một quyết định đúng hướng vì giúp giảm lệch shape dữ liệu ở tầng TypeScript.

### 3.3. Test và build health tốt

Việc toàn bộ Go test pass, cùng với việc cả hai UI build được, cho thấy repo chưa ở trạng thái "nát đồng loạt". Đây là nền rất tốt để tái cấu trúc theo lát cắt nhỏ thay vì đập đi làm lại.

### 3.4. Docs khá sát source

Phần lớn docs hiện phản ánh repo khá trung thực, đặc biệt là `LOGIC_FLOW.md` và các ghi chú deep-dive. Tuy vậy, `README.md` hiện đã chậm một nhịp ở phần mô tả `client/` trong CI, nên vẫn cần một lượt đồng bộ tiếp theo.

## 4. Các vấn đề đồng bộ cần xử lý ngay

### 4.1. Gateway đã được đồng bộ route hủy đơn của user, nhưng parity test còn mỏng

Evidence:

- `order-service` có route `PUT /api/v1/orders/:id/cancel` tại `services/order-service/internal/handler/order_handler.go`
- `api-gateway` hiện đã forward đúng route này tại `api-gateway/internal/handler/order_handler.go`
- `api-gateway/internal/handler/order_handler_test.go` đã khóa lại hành vi `PUT /api/v1/orders/:id/cancel` và chặn `POST`

Tác động:

- lỗi hủy đơn qua gateway đã được xử lý
- nhưng risk drift route ở gateway vẫn còn nếu các endpoint khác chưa có parity test tương tự

Việc nên làm:

1. Mở rộng test parity cho route matrix auth, cart, order, payment ở gateway.
2. Ưu tiên table-driven test để mỗi route critical có method đúng và method sai tương ứng.

### 4.2. `frontend/` đã dùng đúng HTTP method cho hủy đơn, nhưng chưa có smoke test UI route critical

Evidence:

- `frontend/src/shared/api/modules/orderApi.ts` hiện gọi `PUT /api/v1/orders/:id/cancel`
- backend dùng `PUT /api/v1/orders/:id/cancel`
- `client/src/lib/api/order.ts` cũng đang dùng `PUT`, tức là hai UI đã đồng bộ ở flow này

Tác động:

- một điểm lệch contract gây lỗi thật đã được gỡ bỏ
- nhưng nếu không có smoke test nhỏ ở tầng UI/API layer, lỗi cùng loại vẫn có thể quay lại ở feature khác

Việc nên làm:

1. Bổ sung test đơn giản cho API client hoặc smoke test route critical.
2. Gộp checklist method/route critical vào definition of done cho các feature order/payment.

### 4.3. `frontend/` đã dọn dead helper, nhưng quyết định kiến trúc cho guest cart merge vẫn còn mở

Hai điểm từng rõ nhất:

- `frontend/src/shared/api/modules/cartApi.ts` trước đây có `POST /api/v1/cart/merge`
- `frontend/src/shared/api/modules/paymentApi.ts` trước đây có `GET /api/v1/payments/:id/verify`

Hiện trạng:

- không có route tương ứng ở gateway
- không có route tương ứng ở service
- cả hai helper đã được xóa khỏi `frontend` compatibility layer để tránh gây hiểu lầm
- merge guest cart thật vẫn đang nằm trong `CartProvider` bằng cách replay `addToCart`

Kết luận:

- dead API surface đã được dọn
- nhưng merge cart vẫn đang là business glue một phần ở UI thay vì có contract backend rõ ràng

Việc nên làm:

- nếu guest cart merge là capability dài hạn: thiết kế endpoint/backend flow thật, có idempotency và test rõ ràng
- nếu vẫn giữ merge ở provider trong 1-2 sprint tới: ghi rõ đây là quyết định có chủ đích và bổ sung test cho flow login-merge

### 4.4. Repo đang duy trì hai app UI với hai stack khác nhau

Evidence:

- `README.md` xác nhận `frontend/` là UI local chính, `client/` là Next.js App Router đang chạy song song
- `frontend/package.json` dùng React 18 + Vite + CSS thủ công
- `client/package.json` dùng React 19 + Next 16 + Tailwind 4 + Framer Motion

Tác động:

- trùng logic API client
- trùng normalizer
- trùng auth/cart/account flows
- rất dễ drift UX, route, validation và behavior

Đây là vấn đề kiến trúc UI lớn nhất của repo hiện tại.

### 4.5. `client/` đã vào CI và có Compose profile riêng, nhưng chưa là citizen hạng nhất trong publish/runtime chính

Evidence:

- `.github/workflows/ci.yml` hiện đã có `client-checks` bên cạnh `frontend-checks`
- `deployments/docker/docker-compose.yml` hiện đã có profile `client` để smoke test runtime khi cần
- `.github/workflows/docker-publish.yml` chỉ publish image `frontend`, không có `client`
- Compose mặc định vẫn chỉ dùng `frontend` làm đường UI chính

Tác động:

- drift build đã giảm đáng kể vì `client/` đã được lint/build trong CI
- team đã có đường chạy containerized cho `client/` mà không làm mơ hồ entrypoint mặc định
- production strategy của UI trở nên mơ hồ
- dễ rơi vào trạng thái storefront chạy theo `client/` nhưng admin vẫn chỉ sống ở `frontend/`, làm rollout thiếu một kế hoạch cắt lớp rõ ràng

Điểm đã được chốt trong docs/runtime:

- `README.md` đã được cập nhật theo trạng thái CI mới của `client`
- `client` đã có profile Compose riêng cho smoke test
- `client` vẫn được giữ ngoài docker publish pipeline cho đến khi storefront source of truth được chốt

### 4.6. `client/` chưa có admin surface hoàn chỉnh như `frontend/`

Evidence:

- `frontend/` có `AdminPage` và route `/admin`
- `client/` hiện có một số admin API helper, nhưng chưa có page admin hoàn chỉnh tương đương

Tác động:

- không thể thay `frontend/` bằng `client/` theo kiểu "chuyển toàn bộ UI" ngay lập tức
- nếu quyết định lấy `client/` làm UI chính, team vẫn phải giữ một kế hoạch riêng cho admin

### 4.7. Category/editorial pages còn dùng data cứng

Evidence:

- `frontend/src/routes/CategoryPage.tsx` render các page riêng cho `Shop Men`, `Shop Women`, `Footwear`, `Accessories`
- `frontend/src/features/shop-men/shopMenData.ts` chứa sản phẩm/filter cứng trong file
- `client/src/app/editorial/[categoryName]/page.tsx` đọc config tĩnh từ `client/src/components/atelier-page-data.ts`

Điều này không sai nếu mục tiêu là art direction hoặc brand storytelling, nhưng nó không phải nguồn dữ liệu thật của catalog.

Tác động:

- người dùng có thể thấy hình ảnh/giá/tên không khớp backend
- team design sửa nhanh nhưng backend không biết gì
- nhập liệu catalog bằng Excel cũng không thể đồng bộ các màn editorial này nếu content vẫn hardcode

### 4.8. Repo đang giữ một số file sinh ra hoặc scaffold không cần thiết

Nhóm nên xem xét dọn ngay:

- `.vite/deps/_metadata.json`
- `.vite/deps/package.json`
- `frontend/tsconfig.app.tsbuildinfo`
- `frontend/tsconfig.node.tsbuildinfo`
- `frontend/vite.config.js`
- `frontend/vite.config.d.ts`

Nhóm scaffold mặc định của Next hiện chưa thấy được dùng:

- `client/public/file.svg`
- `client/public/globe.svg`
- `client/public/next.svg`
- `client/public/vercel.svg`
- `client/public/window.svg`

Nhóm file khả năng không còn cần:

- `client/src/components/shop-men-page.tsx`

## 5. Danh sách khuyến nghị xóa, archive, giữ lại

### 5.1. Xóa ngay

Các file dưới đây nên xóa khỏi git để repo gọn và tránh sửa nhầm artefact:

- `.vite/deps/_metadata.json`
- `.vite/deps/package.json`
- `frontend/tsconfig.app.tsbuildinfo`
- `frontend/tsconfig.node.tsbuildinfo`
- `frontend/vite.config.js`
- `frontend/vite.config.d.ts`
- `client/public/file.svg`
- `client/public/globe.svg`
- `client/public/next.svg`
- `client/public/vercel.svg`
- `client/public/window.svg`
- `client/src/components/shop-men-page.tsx`

Lý do:

- không phải source of truth
- không tăng giá trị học tập hay runtime
- làm người đọc dễ nhầm đâu là file nên sửa thật

### 5.2. Không xóa, nhưng nên chuyển chỗ hoặc archive

Các file nên giữ vì còn giá trị tham chiếu, nhưng không nên để lẫn như thể chúng là source runtime:

- toàn bộ `frontend/ui-reference/`

Khuyến nghị:

- giữ lại để design/dev đối chiếu
- cân nhắc chuyển sang `docs/ui-reference/` hoặc giữ nguyên nhưng ghi rõ đây là reference-only assets
- nếu repo phình to, cân nhắc Git LFS cho PNG lớn

### 5.3. Chưa xóa ngay, nhưng phải quyết định

- `frontend/` và `client/` không nên cùng đóng vai trò storefront chính quá lâu

Khuyến nghị mặc định:

- lấy `client/` làm hướng storefront/account chính trong trung hạn
- giữ `frontend/` như bridge tạm thời cho flow đang chạy và cho phần admin cho đến khi có admin surface tương đương ở `client/` hoặc một admin app riêng
- sau khi parity đủ tốt, deprecate dần `frontend/` thay vì nuôi hai app vô thời hạn

## 6. Roadmap tái cấu trúc đề xuất

### 6.1. Giai đoạn 0: sửa lệch contract trước

Mục tiêu:

- dừng chảy máu drift giữa UI, gateway và service

Việc làm:

1. [x] Thêm route user cancel order vào gateway.
2. [x] Sửa `frontend` dùng `PUT` cho cancel order.
3. [x] Xóa `mergeCart` và `verifyPaymentSignature` khỏi frontend compatibility layer nếu chưa có kế hoạch implement backend tương ứng.
4. [~] Đã thêm test gateway parity cho route hủy đơn; chưa mở rộng thành suite cho auth, cart, order, payment.

Lý do:

- đây là các lỗi nhỏ nhưng tạo cảm giác hệ thống "không đáng tin"
- sửa sớm giúp mọi refactor phía sau ít rủi ro hơn

Trạng thái hiện tại:

- 3 việc đầu đã hoàn tất
- việc còn thiếu là mở rộng coverage parity test thay vì chỉ khóa một route

### 6.2. Giai đoạn 1: chọn một app UI làm nguồn sự thật

Khuyến nghị mặc định:

- chọn `client/` làm storefront/account chính

Lý do:

- stack hiện đại hơn
- hỗ trợ SSR tốt hơn cho storefront
- đã có lint và standalone build
- phù hợp hơn với mục tiêu UI hiện đại, motion, layout linh hoạt

Nhưng không nên migrate kiểu big bang.

Lưu ý rất quan trọng:

- khuyến nghị này chỉ hợp với storefront/account trong trung hạn
- admin hiện vẫn đang có implementation rõ nhất ở `frontend/`
- vì vậy quyết định đúng không phải là "xóa frontend", mà là "tách quyết định storefront khỏi quyết định admin"

Cách làm an toàn:

1. Chốt scope parity tối thiểu giữa `client/` và `frontend`:
   - auth
   - catalog
   - product detail
   - cart
   - checkout
   - order detail
   - payment history
2. [x] Thêm `client` vào CI.
3. [x] Thêm `client` vào Compose dưới dạng profile riêng cho smoke test.
4. Chỉ khi parity đủ, mới đổi entrypoint chính.

Trạng thái hiện tại:

- bước 2 và 3 đã hoàn tất
- bước 1 và 4 vẫn còn mở và quyết định roadmap UI trong trung hạn

Nếu chưa muốn chọn `client` ngay:

- vẫn phải hợp nhất API layer và design tokens trước
- nếu không, drift sẽ tiếp tục tăng dù giữ app nào

### 6.3. Giai đoạn 2: gom API client thành một shared web SDK

Hiện trạng:

- hai app đang có HTTP client, normalizer và API modules gần giống nhau
- tổng số dòng ở nhóm file API/normalizer của hai app là rất lớn và duy trì song song

Khuyến nghị:

- tạo một package dùng chung, ví dụ `shared/web-sdk/`

Nội dung nên đưa vào:

- `http-client.ts`
- `normalizers.ts`
- `modules/auth.ts`
- `modules/user.ts`
- `modules/product.ts`
- `modules/cart.ts`
- `modules/order.ts`
- `modules/payment.ts`
- `modules/admin.ts`

Nguyên tắc:

- app chỉ giữ lại phần environment-specific như storage, SSR fetch wrapper, redirect handling
- mọi route/path/normalizer nên có một nguồn sự thật

Lý do:

- giảm drift giữa `frontend/` và `client/`
- giảm chi phí sửa bug API
- khi backend đổi field hoặc route, chỉ sửa một chỗ

### 6.4. Giai đoạn 3: hợp nhất design system

Hiện trạng:

- `frontend/` nghiêng về CSS file thủ công
- `client/` nghiêng về Tailwind 4 + component utility
- visual language và typography chưa thống nhất hoàn toàn

Khuyến nghị:

- chốt một design system duy nhất ở tầng token trước khi làm lại nhiều màn

Những gì cần chuẩn hóa:

- color tokens
- typography scale
- spacing scale
- border radius
- shadow/elevation
- trạng thái button/input/tag/card
- motion presets

Không cần thêm framework mới.

Cách thực dụng:

1. Định nghĩa token trong một file dùng chung.
2. Map token đó vào cả CSS variables và utility classes.
3. Refactor component nền trước:
   - button
   - input
   - select
   - badge
   - card
   - section header
   - product tile

### 6.5. Giai đoạn 4: đưa content/editorial ra khỏi code

Category/editorial page hiện đang rất đẹp để demo, nhưng data còn nằm trong file TS.

Khuyến nghị theo thứ tự từ đơn giản đến mạnh:

1. Ngắn hạn:
   - chuyển data cứng sang `shared/content/*.json`
   - tách rõ "editorial content" khỏi component tree
2. Trung hạn:
   - thêm bảng PostgreSQL hoặc config API cho collections/editorial sections
   - quản trị qua admin UI
3. Dài hạn:
   - nếu thực sự cần đội content độc lập, mới tính đến CMS

Lý do:

- content marketing, category hero, campaign rail là dữ liệu thay đổi thường xuyên
- để trong code làm mất lợi thế của import tooling và admin tooling

### 6.6. Giai đoạn 5: siết các điểm production-critical ở backend

Những hạng mục nên ưu tiên đúng với thực trạng repo:

1. inventory reservation hoặc stock deduction transaction-safe khi tạo đơn
2. idempotency cho payment và webhook
3. mở rộng outbox/inbox cho event quan trọng còn lại
4. giảm `COUNT(*) + OFFSET/LIMIT` ở list admin lớn
5. benchmark/pprof cho hot path thay vì tối ưu cảm tính

Lý do:

- đây là các cải tiến đem lại giá trị vận hành thật
- phù hợp với định hướng đã nêu trong `AGENTS.md`

## 7. Gợi ý mở rộng hệ thống theo giá trị thực tế

### 7.1. Product import center

Giá trị:

- giải quyết bài toán nhập liệu catalog nhanh
- giúp đồng bộ front-end với back-end tốt hơn
- giảm phụ thuộc vào việc sửa code cho từng campaign

### 7.2. Inventory reservation

Giá trị:

- tránh oversell
- làm checkout đáng tin hơn
- là bước cần thiết trước khi scale traffic

### 7.3. Payment/webhook idempotency

Giá trị:

- tránh duplicate payment/refund side effects
- rất quan trọng với retry từ client hoặc gateway ngoài

### 7.4. Wishlist và recently viewed

Giá trị:

- tăng chuyển đổi mà không cần thêm service mới
- có thể bắt đầu bằng PostgreSQL/Redis tùy scope

### 7.5. Search suggestion và merchandising rail

Giá trị:

- tận dụng được catalog và popularity endpoint đã có
- cải thiện UX lớn ở home, catalog và product detail

### 7.6. Notification center đồng bộ hơn

Giá trị:

- tận dụng event hiện có từ order/payment
- giúp account area giống trải nghiệm của các sàn lớn hơn

## 8. Định hướng UI/UX hiện đại theo tinh thần Tiki, Shopee, Lazada

Không nên copy visual identity của các sàn lớn. Điều nên học là pattern UX:

- giá và ưu đãi rất rõ
- CTA mua hàng luôn gần mắt
- mật độ thông tin cao nhưng vẫn có thứ bậc
- trust signal xuất hiện đúng lúc
- checkout ít friction
- đơn hàng và trạng thái sau mua rất rõ

## 8.1. Trang chủ

Nên có:

- hero ngắn, không chiếm quá nhiều chiều cao
- rail danh mục nổi bật
- rail "best sellers", "new arrivals", "deal hôm nay"
- trust strip: giao nhanh, đổi trả, bảo hành, thanh toán an toàn
- section editorial nhỏ, không lấn át sản phẩm

Lý do:

- sàn lớn tối ưu cho khám phá và chuyển đổi, không tối ưu cho hero quá nghệ thuật

Cách áp dụng:

- tận dụng `catalog/popularity`
- thêm section data-driven ở home trước khi tăng thêm animation

## 8.2. Catalog

Nên có:

- filter sticky desktop
- filter drawer mobile
- chips cho filter đang active
- sort rõ ràng
- card sản phẩm nhất quán về ảnh, giá, badge, rating
- trạng thái loading/skeleton và empty state tốt

Lý do:

- catalog là màn ảnh hưởng trực tiếp tới conversion

Cách áp dụng:

- giữ backend cursor pagination hiện có
- ưu tiên "load more" hoặc infinite scroll có kiểm soát

## 8.3. Product detail

Nên có:

- gallery ảnh tốt hơn
- buy box sticky trên desktop
- variant matrix rõ size/mau sac/stock
- section giao hàng dự kiến
- trust block: hoàn tiền, đổi trả, bảo hành
- review summary nổi bật hơn
- rail "mua kèm", "gợi ý tương tự"

Lý do:

- đây là màn quyết định add-to-cart

## 8.4. Cart và checkout

Nên có:

- sticky summary panel
- address prefill rõ ràng
- coupon preview trước khi submit
- payment method card rõ icon/trạng thái
- progress stepper: cart -> checkout -> payment -> confirmation
- inline validation thay vì lỗi dồn cuối form

Lý do:

- checkout cần giảm lo lắng, không cần thêm nghệ thuật

## 8.5. Account và admin

Nên có:

- order cards với timeline trực quan
- payment history gắn thẳng với order
- notification center có filter
- admin dashboard tập trung vào vận hành:
  - order exceptions
  - low stock
  - payment failures
  - import jobs

Lý do:

- app bán hàng lớn luôn tối ưu cả pre-purchase lẫn post-purchase

## 8.6. Motion và hình ảnh

Khuyến nghị:

- dùng motion vừa đủ: page reveal, stagger list, sticky CTA transition
- tránh micro-animation rải khắp nơi
- ưu tiên tốc độ perceived performance và feedback nhanh

## 9. Đề xuất nhập dữ liệu bằng Excel hoặc công cụ tương tự

Đây là hạng mục có giá trị rất cao cho repo này.

Khuyến nghị mặc định:

- không import thẳng bằng cách để front-end gọi `POST /products` hàng trăm lần
- nên có luồng import chính thức ở `product-service`

## 9.1. Mục tiêu của luồng import

Luồng import tốt cần đáp ứng:

- người vận hành upload được `xlsx` hoặc `csv`
- hệ thống validate trước khi ghi dữ liệu thật
- có preview lỗi theo từng dòng
- có thể commit/retry
- có log và trạng thái job
- có thể reindex search sau khi import thành công

## 9.2. Thiết kế khuyến nghị

### UI

Một màn `Import Center` nên có:

- download template
- drag-and-drop upload
- preview mapping cột
- bảng lỗi theo từng dòng
- summary:
  - số dòng hợp lệ
  - số dòng lỗi
  - số SKU mới
  - số SKU update
- nút `Validate`
- nút `Commit`
- lịch sử import job

### Backend

Đặt trong `product-service`, không cần tạo service mới.

Các thành phần nên thêm:

- `services/product-service/internal/handler/product_import_handler.go`
- `services/product-service/internal/service/product_import_service.go`
- `services/product-service/internal/repository/product_import_repository.go`
- `services/product-service/internal/model/product_import.go`
- migration tạo bảng `product_import_jobs` và `product_import_rows`

Endpoint đề xuất:

- `POST /api/v1/products/imports`
- `GET /api/v1/products/imports/:id`
- `POST /api/v1/products/imports/:id/validate`
- `POST /api/v1/products/imports/:id/commit`
- `GET /api/v1/products/imports/:id/errors`
- `GET /api/v1/products/import-template`

Ghi chú:

- route trên bám theo convention hiện tại của `product-service`, nơi các route quản trị sản phẩm vẫn đang nằm dưới `/api/v1/products` với `JWTAuth + RequireRole`
- nếu team muốn chuẩn hóa toàn bộ admin route sang `/api/v1/admin/...`, nên làm thành một refactor riêng thay vì đổi route import đơn lẻ

## 9.3. Format file nên hỗ trợ

Khuyến nghị thực dụng:

- hỗ trợ `csv` trước
- hỗ trợ `xlsx` ngay sau đó nếu team vận hành thật sự cần Excel nhiều sheet

Với Excel, nên dùng cấu trúc 2-3 sheet:

### Sheet `products`

Cột đề xuất:

- `sku`
- `name`
- `description`
- `category`
- `brand`
- `status`
- `price`
- `stock`
- `tags`
- `image_url`
- `image_urls`

### Sheet `variants`

Cột đề xuất:

- `parent_sku`
- `sku`
- `label`
- `size`
- `color`
- `price`
- `stock`

### Sheet `editorial` hoặc `collections`

Chỉ thêm nếu muốn đồng bộ luôn content front-end:

- `collection_code`
- `title`
- `subtitle`
- `hero_image_url`
- `cta_label`
- `cta_target`
- `sort_order`
- `active`

## 9.4. Luồng xử lý nên đi như sau

1. Người dùng upload file từ admin UI.
2. Backend lưu job + file metadata.
3. Backend parse file vào staging rows.
4. Backend validate theo schema hiện có của `CreateProductRequest` và variant schema.
5. UI hiển thị preview lỗi.
6. Người dùng bấm commit.
7. Backend chạy batch upsert trong transaction phù hợp.
8. Sau commit, trigger reindex Elasticsearch theo batch.
9. Trả về báo cáo thành công/thất bại và cho tải file lỗi.

## 9.5. Vì sao không nên để front-end tự nhập hết logic

Nếu parse và submit toàn bộ ở front-end:

- khó đảm bảo transaction
- khó retry
- khó log/audit
- partial failure rất khó giải thích
- reindex search và đồng bộ media càng rối

Front-end nên làm:

- preview
- mapping cột
- trình bày lỗi
- theo dõi tiến độ job

Back-end nên làm:

- parse chuẩn
- validate chuẩn
- commit chuẩn
- audit chuẩn

## 9.6. Công cụ cụ thể nên cân nhắc

Theo mức độ ưu tiên:

1. `CSV + encoding/csv` của Go:
   - đơn giản nhất
   - ít dependency nhất
   - phù hợp giai đoạn đầu
2. `XLSX + excelize` ở Go:
   - hợp lý nếu team vận hành dùng Excel thật
   - vẫn đủ phổ biến và dễ bảo trì
3. Google Sheets sync:
   - chỉ nên làm sau khi import center ổn định
   - không nên nhảy vào quá sớm vì thêm auth, quota và failure mode mới

## 10. Thứ tự triển khai được khuyến nghị

### Sprint 1

- [x] fix route parity cho flow hủy đơn
- [ ] xóa artefact/scaffold thừa
- [x] thêm `client` vào CI
- [x] thêm `client` vào Compose profile riêng
- [x] dọn dead API surface

### Sprint 2

- [ ] gom shared web SDK
- [ ] chốt app UI chính
- [ ] bắt đầu chuẩn hóa design tokens

### Sprint 3

- refactor home/catalog/product detail/checkout theo design system mới
- giữ logic API hiện có, chưa thêm service mới

### Sprint 4

- làm import center bản `csv`
- thêm import job history
- reindex search sau import

### Sprint 5

- nâng import lên `xlsx`
- đưa editorial content ra khỏi code
- làm inventory reservation và idempotency path

## 11. Cách áp dụng trực tiếp vào repo này

### 11.1. Các file nên sửa đầu tiên

- [x] `api-gateway/internal/handler/order_handler.go`
- [x] `frontend/src/shared/api/modules/orderApi.ts`
- [x] `frontend/src/shared/api/modules/cartApi.ts`
- [x] `frontend/src/shared/api/modules/paymentApi.ts`
- [x] `.github/workflows/ci.yml`
- [ ] `README.md`
- [ ] `.github/workflows/docker-publish.yml`
- [ ] `deployments/docker/docker-compose.yml`

### 11.2. Các thư mục nên tạo nếu đi theo roadmap khuyến nghị

- `shared/web-sdk/`
- `services/product-service/internal/handler/product_import_handler.go`
- `services/product-service/internal/service/product_import_service.go`
- `services/product-service/internal/repository/product_import_repository.go`

### 11.3. Nguyên tắc khi thực hiện

- không xóa hai UI cùng lúc
- không thêm service mới chỉ để giải quyết bài toán import hoặc content
- ưu tiên sửa contract và cleanup trước khi làm visual redesign lớn
- mọi redesign phải bám đúng capability backend đang có

## 12. Tôi đã làm gì đến thời điểm hiện tại

Trong lần chỉnh file này và các thay đổi code đi kèm gần nhất, tôi đã làm các việc sau:

1. giữ lại kết luận chính nhưng làm rõ phạm vi verify
2. thêm mục "các nguồn bằng chứng chính" để người đọc biết nên mở file nào trước
3. bổ sung phần chỉ ra chính điểm yếu của phiên bản đầu của tài liệu
4. sửa khuyến nghị import endpoint để bám route convention thật của `product-service`
5. bổ sung caveat rõ ràng rằng `client/` hiện phù hợp cho storefront/account hơn là thay toàn bộ `frontend/` ngay lập tức
6. fix parity route hủy đơn giữa `frontend`, `api-gateway` và `order-service`
7. thêm test gateway để khóa `PUT /api/v1/orders/:id/cancel` và chặn `POST`
8. xóa `mergeCart` và `verifyPaymentSignature` khỏi frontend compatibility layer vì backend chưa có contract thật tương ứng
9. thêm `client-checks` vào CI để `client/` được lint/build trên mọi PR
10. thêm `client` vào Docker Compose dưới dạng profile riêng cho smoke test runtime
11. chốt quyết định tạm thời rằng `client` chưa vào docker-publish cho đến khi storefront entrypoint được quyết định dứt điểm
12. cập nhật lại các phần trong tài liệu này để phân biệt rõ mục nào đã xong, mục nào mới xong một phần, và mục nào còn nợ
13. cập nhật `README.md` để phản ánh đúng việc `client` đã vào CI, có Compose profile riêng, và chưa vào docker publish pipeline theo chủ đích

## 13. Nên làm gì tiếp theo ngay sau file này

Thứ tự nên làm tiếp theo:

1. mở rộng parity test nhỏ nhưng giá trị cao:
   - auth route matrix ở gateway
   - cart route matrix ở gateway
   - order/payment route critical còn lại
   - smoke test nhỏ cho UI API layer ở các method dễ lệch
2. quyết định kiến trúc UI ở mức phạm vi:
   - storefront/account đi theo `client/` hay chưa
   - admin tiếp tục ở `frontend/` hay tách riêng
3. đồng bộ tài liệu và runtime theo trạng thái mới:
   - giữ `client` ngoài docker publish pipeline cho đến khi storefront source of truth được chốt
   - làm rõ phạm vi `client` cho storefront/account và kế hoạch admin
4. chỉ sau khi ba việc trên xong mới bắt đầu redesign lớn hoặc import center

Nếu muốn làm tiếp ngay trong repo theo hướng ít rủi ro nhất, thứ tự commit nên là:

- commit 1: mở rộng gateway parity/smoke tests cho route critical
- commit 2: cập nhật README + chốt runtime strategy cho `client`
- commit 3: dọn artefact/scaffold khỏi git
- commit 4: tách shared web SDK

## 14. Kết luận

Repo này có nền backend tốt hơn nhiều dự án demo thông thường, nhưng phần front-end đang ở trạng thái chuyển tiếp nên đồng bộ tổng thể chưa cao.

Ba việc mang lại hiệu quả lớn nhất theo đúng hiện trạng source là:

1. chốt một storefront chính và gom API layer dùng chung
2. tiếp tục khóa các route critical bằng parity test thay vì chỉ sửa lỗi từng điểm
3. làm import center cho catalog để biến dữ liệu front-end từ "code cứng" sang "dữ liệu quản trị được"

Nếu làm đúng thứ tự trên, hệ thống sẽ:

- đồng bộ hơn giữa front-end và back-end
- dễ mở rộng hơn mà không cần thêm service mới
- có UI hiện đại hơn nhưng vẫn thực dụng
- giảm đáng kể nợ kỹ thuật vô ích trong repo
