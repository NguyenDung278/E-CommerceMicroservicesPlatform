# Go, SQL, Transaction, Idempotency, And Interview Feature Playbook

Tài liệu này trả lời thẳng 3 câu hỏi rất thực dụng:

1. Cần học Go gì trước khi đụng microservice?
2. Nên luyện SQL, transaction, idempotency như thế nào để lên tay thật?
3. Nên build 5 feature nào để đi phỏng vấn backend mạnh hơn?

Mục tiêu của tài liệu không phải "học cho đủ danh mục", mà là giúp bạn học đúng thứ tự, đúng mức độ, và dùng chính repo này để luyện thành kỹ năng nghề nghiệp thật.

---

## 1. Cần học Go gì trước khi đụng microservice

Nói ngắn gọn:

> Trước khi học microservice, bạn phải đủ chắc Go ở mức viết được một service đơn giản, đọc được flow cũ, xử lý lỗi rõ ràng, và không sợ transaction hay HTTP handler.

Nhiều người học microservice quá sớm nên rơi vào tình trạng:

- thuộc tên pattern nhưng không đọc nổi business flow
- tách service nhưng không giữ được invariant
- biết gọi gRPC/RabbitMQ nhưng lại yếu SQL, error handling và transaction

Trong thực tế nghề nghiệp, điều nhà tuyển dụng cần không phải là "biết buzzword microservice", mà là:

- viết service rõ ràng
- hiểu boundary
- giữ dữ liệu đúng
- debug được khi hệ thống lỗi

### 1.1. Go foundation tối thiểu phải chắc

Trước khi đụng `services/*-service/`, bạn nên vững các phần sau:

#### A. Syntax và cấu trúc chương trình

Bạn cần dùng tự nhiên:

- `struct`, method, receiver
- package, import, visibility
- `if`, `switch`, `for`, `range`
- slice, map
- function, variadic, multiple return values

Nếu phần này còn chậm, đọc microservice sẽ rất đuối vì bạn bị mất năng lượng vào syntax thay vì flow.

#### B. Pointer, value, zero value

Đây là phần cực kỳ quan trọng trong Go backend.

Bạn cần hiểu:

- khi nào truyền value, khi nào truyền pointer
- zero value giúp gì cho model/dto
- mutation xảy ra ở đâu
- nil pointer có thể làm flow gãy như thế nào

Trong repo này, điều đó ảnh hưởng trực tiếp tới:

- model/dto mapping
- service input/output
- optional field handling

#### C. Error handling

Đây là kỹ năng bắt buộc trước microservice.

Bạn phải quen:

- trả lỗi rõ ràng
- wrap lỗi với `%w`
- dùng `errors.Is` / `errors.As`
- phân biệt domain error và infrastructure error

Nếu phần này không chắc, vào hệ nhiều service bạn sẽ rất nhanh bị mù vì lỗi bị mất ngữ cảnh.

#### D. Interface và dependency

Bạn không cần lạm dụng interface, nhưng phải hiểu:

- interface dùng để làm gì
- khi nào đáng tạo interface
- fake/mock test phụ thuộc vào đâu
- vì sao interface nên đặt gần consumer

Đây là nền tảng để hiểu kiến trúc service trong repo mà không over-engineer.

#### E. `context.Context`

Trước microservice, bạn phải hiểu:

- vì sao `context` đi đầu tham số
- cancel/deadline dùng khi nào
- external call nào cần timeout
- vì sao không nên tự tạo `context.Background()` ở deep layer

Microservice mà thiếu phản xạ `context` là rất nguy hiểm.

#### F. Concurrency cơ bản

Bạn không cần lao ngay vào mô hình song song phức tạp. Chỉ cần chắc:

- goroutine là gì
- channel dùng khi nào
- race condition hình thành ra sao
- khi nào không nên spawn goroutine

Trong phần lớn nghiệp vụ commerce, transaction và DB consistency quan trọng hơn việc "goroutine cho nhanh".

#### G. HTTP server cơ bản

Trước microservice, bạn nên tự viết được:

- 1 API `GET`
- 1 API `POST`
- parse JSON request
- validate input cơ bản
- trả JSON response
- map error ra status code hợp lý

Nếu chưa tự viết nổi service nhỏ kiểu này, chưa nên vội học phân tán nhiều service.

#### H. Testing cơ bản

Bạn cần quen:

- viết unit test
- table-driven test
- chạy test theo package
- đọc failure output

Người học microservice mà chưa quen test sẽ rất dễ rơi vào kiểu sửa mò.

---

## 2. Thứ tự học Go hợp lý trước microservice

Thay vì học tản mạn, hãy đi theo trình tự này.

### Giai đoạn 1: Viết một service nhỏ dạng monolith trong Go

Mục tiêu:

- hiểu handler, service, repository
- hiểu HTTP request/response
- hiểu query đơn giản với DB

Bạn nên tự viết được:

- user CRUD nhỏ
- product CRUD nhỏ
- list API có filter cơ bản

### Giai đoạn 2: Thêm database thật và transaction

Mục tiêu:

- không chỉ "API chạy được", mà dữ liệu phải đúng

Bạn nên luyện:

- insert/update/select bằng SQL
- rollback khi lỗi
- uniqueness, foreign key, index
- migration

### Giai đoạn 3: Thêm auth, validation, logging, config

Mục tiêu:

- service bắt đầu giống sản phẩm thật hơn

Bạn nên luyện:

- middleware
- config bằng env
- structured log
- validation boundary

### Giai đoạn 4: Chỉ sau đó mới đọc microservice

Lúc này bạn mới chuyển sang:

- gateway
- inter-service communication
- event
- retry/idempotency

Lý do:

- nếu nền Go và SQL chưa vững, microservice chỉ làm bạn rối hơn chứ không giỏi hơn

---

## 3. Học Go trong repo này theo đường nào

Nếu dùng chính `ecommerce-platform` để học, hãy đi theo thứ tự:

1. `docs/learning/01-go-backend-foundations.md`
2. `docs/learning/03-source-reading-roadmap.md`
3. `docs/annotated/shared-packages.md`
4. `services/product-service/internal/handler/`
5. `services/product-service/internal/service/`
6. `services/product-service/internal/repository/`
7. `services/order-service/internal/service/`
8. `services/payment-service/internal/service/`

Vì sao nên đi như vậy:

- `product-service` dễ đọc hơn order/payment
- order/payment chứa nghiệp vụ phức tạp hơn, thích hợp sau khi bạn đã quen layering

---

## 4. Nên luyện SQL như thế nào để lên tay thật

SQL là kỹ năng tạo khác biệt rất lớn ở backend interview.

### 4.1. Học theo 4 tầng

#### Tầng 1: Query căn bản

Phải chắc:

- `SELECT`, `INSERT`, `UPDATE`, `DELETE`
- `WHERE`, `ORDER BY`, `LIMIT`
- `JOIN`
- aggregate như `COUNT`, `SUM`

Nếu chưa chắc tầng này, chưa nên nghĩ tới tối ưu sâu.

#### Tầng 2: Data modeling

Phải hiểu:

- primary key
- foreign key
- unique constraint
- nullable vs not null
- one-to-many / many-to-many

Đây là phần giúp bạn không thiết kế schema ngây thơ.

#### Tầng 3: Performance

Phải học:

- index hoạt động ra sao
- tại sao query chậm
- `EXPLAIN ANALYZE`
- offset pagination vs cursor pagination
- query shape ảnh hưởng thế nào tới scan cost

#### Tầng 4: Consistency

Phải hiểu:

- transaction là gì
- atomicity thực tế nghĩa là gì
- isolation ở mức đủ dùng
- lock/contended write là gì
- duplicate side effect xuất hiện khi nào

### 4.2. Cách luyện SQL trong repo này

Đi theo các bước:

1. Đọc migration trước.
2. Đọc repository sau.
3. Ghi ra query nào là read path, query nào là write path.
4. Với write path, hỏi thêm: invariant nào đang được bảo vệ?
5. Với list path, hỏi thêm: query này scale ra sao khi dữ liệu lớn lên?

Các vùng rất đáng luyện:

- `services/product-service/internal/repository/`
- `services/order-service/internal/repository/`
- `services/payment-service/internal/repository/`

### 4.3. Bài tập SQL nên làm

Theo mức độ:

#### Mức cơ bản

- thêm 1 filter cho catalog
- thêm sort đơn giản
- thêm field trả về ở list endpoint

#### Mức khá

- tối ưu một query chậm
- thêm index cho query vừa thêm
- viết integration test cho repository

#### Mức mạnh

- thay một endpoint nặng `OFFSET/LIMIT` bằng chiến lược tốt hơn
- giảm query count trong flow quan trọng
- viết note giải thích vì sao chọn query/index đó

---

## 5. Nên luyện transaction như thế nào

Nhiều người "biết transaction" ở mức gọi `BEGIN/COMMIT`, nhưng chưa hiểu khi nào thực sự cần transaction.

### 5.1. Transaction để bảo vệ điều gì

Hãy nhớ:

> Transaction không tồn tại để code trông chuyên nghiệp hơn. Nó tồn tại để giữ invariant khi có nhiều bước phải cùng đúng.

Ví dụ:

- tạo order + lưu items
- trừ coupon usage + tạo order
- cập nhật payment status + ghi payment event

Nếu một bước thành công, bước khác thất bại, dữ liệu có thể rơi vào trạng thái sai.

### 5.2. Cách luyện transaction đúng

Mỗi khi đọc một write flow, hãy tự hỏi:

1. Business invariant là gì?
2. Có bao nhiêu bước ghi dữ liệu?
3. Nếu fail ở giữa thì chuyện gì xảy ra?
4. Nếu request bị retry thì có nhân đôi side effect không?

Nếu bạn tập hỏi 4 câu này thường xuyên, transaction sense sẽ tăng rất nhanh.

### 5.3. Flow đáng học trong repo

- preview/create order ở `order-service`
- update payment và publish event ở `payment-service`
- review flow hoặc các write flow có transaction helper ở `product-service`

### 5.4. Bài tập transaction nên làm

- viết test rollback cho một flow nhiều bước
- tìm chỗ chưa có transaction nhưng đáng có
- refactor write flow để invariant rõ hơn
- thêm logging đủ để nhìn thấy transaction failure

---

## 6. Nên luyện idempotency như thế nào

Idempotency là một trong những chủ đề rất mạnh khi đi phỏng vấn backend.

Nó cho thấy bạn không chỉ biết code, mà còn hiểu hệ thống thực tế sẽ bị retry, duplicate, timeout và race.

### 6.1. Idempotency là gì theo nghĩa dễ dùng

Nếu cùng một yêu cầu được gửi lại nhiều lần, hệ thống vẫn cho ra kết quả an toàn, không tạo side effect ngoài ý muốn.

Ví dụ:

- client bấm thanh toán 2 lần
- gateway timeout rồi client retry
- payment provider gửi webhook lặp
- message broker deliver lại event

### 6.2. Bạn nên nghĩ idempotency theo 3 lớp

#### Lớp 1: API layer

Ví dụ:

- idempotency key từ client
- detect duplicate request
- trả lại kết quả đã xử lý trước đó

#### Lớp 2: Persistence layer

Ví dụ:

- unique key
- state transition guard
- dedupe table hoặc processed-event store

#### Lớp 3: Event/Webhook layer

Ví dụ:

- inbox pattern
- processed message id
- replay-safe consumer

### 6.3. Cách luyện idempotency trong repo này

Hãy chọn một flow và phân tích:

1. Request nào có thể bị retry?
2. Event nào có thể bị deliver lại?
3. Side effect nguy hiểm nhất là gì?
4. Dùng key, constraint, state machine, hay inbox/outbox để chặn?

Flow đáng luyện nhất:

- payment create / webhook
- order create
- notification consume event

### 6.4. Bài tập idempotency nên làm

- thêm guard cho duplicate payment attempt
- thêm processed-event tracking cho một consumer path
- thêm test mô phỏng webhook gửi lại
- viết proposal ngắn về idempotency strategy cho checkout/payment

---

## 7. Cách luyện 3 kỹ năng này cùng nhau

Đây là cách học hiệu quả nhất:

### Bước 1: Chọn một flow write thật

Ví dụ:

- create order
- update payment
- consume payment event

### Bước 2: Vẽ ra data path

Ghi ra:

- input vào là gì
- query nào chạy
- bảng nào bị ghi
- event nào được phát
- chỗ nào có thể duplicate

### Bước 3: Viết 3 danh sách

- SQL cần tối ưu gì
- transaction cần giữ invariant gì
- idempotency cần chặn duplicate gì

### Bước 4: Biến nó thành patch nhỏ

Ví dụ:

- thêm unique constraint
- thêm transaction wrapper rõ ràng hơn
- thêm duplicate-check ở webhook
- thêm integration test

Đây là kiểu học tạo ra năng lực thật, không chỉ là đọc lý thuyết.

---

## 8. Nên build 5 feature nào để đi phỏng vấn backend mạnh hơn

Dưới đây là 5 feature có giá trị rất cao vì chúng chạm đúng các kỹ năng nhà tuyển dụng thích: correctness, SQL, reliability, idempotency, observability, production thinking.

### Feature 1: Payment Webhook Idempotency Hardening

Mô tả:

- làm webhook payment retry-safe
- chặn duplicate update
- bảo vệ state transition

Bạn sẽ học được:

- idempotency key hoặc processed webhook id
- unique constraint
- transaction + state machine
- error mapping

Vì sao mạnh khi đi phỏng vấn:

- đây là bài toán production rất thật
- thể hiện tư duy reliability rõ ràng

### Feature 2: Inventory Reservation Cho Checkout

Mô tả:

- giữ hàng trong thời gian ngắn khi user bắt đầu checkout hoặc trước payment
- tránh oversell

Bạn sẽ học được:

- transaction và concurrency
- state expiration
- inventory invariant
- rollback hoặc release flow

Vì sao mạnh:

- chạm đúng bài toán commerce thực tế
- thể hiện bạn hiểu race condition hơn mức CRUD

### Feature 3: Cursor Pagination Hoặc Query Optimization Cho List Endpoint Nóng

Mô tả:

- tối ưu list endpoint đang có nguy cơ bottleneck
- thêm index hoặc đổi chiến lược phân trang

Bạn sẽ học được:

- query plan
- index
- data access pattern
- benchmark/measurement mindset

Vì sao mạnh:

- thể hiện bạn hiểu SQL thật
- dễ kể thành một câu chuyện performance interview

### Feature 4: Outbox/Inbox Observability Upgrade

Mô tả:

- thêm metrics, log context, retry visibility cho event publish/consume

Bạn sẽ học được:

- async flow
- observability
- debugging distributed system
- failure isolation

Vì sao mạnh:

- nhiều ứng viên biết queue nhưng ít người biết làm nó observable

### Feature 5: Order Audit Trail Hoặc Admin Timeline Rõ Hơn

Mô tả:

- lưu và hiển thị rõ các bước thay đổi trạng thái order/payment
- làm cho việc debug và support dễ hơn

Bạn sẽ học được:

- event modeling
- append-only thinking
- admin/reporting query
- hệ quả sản phẩm của backend design

Vì sao mạnh:

- thể hiện bạn nghĩ tới vận hành và support, không chỉ happy path user

---

## 9. Nếu muốn đi phỏng vấn mạnh hơn, nên trình bày các feature đó thế nào

Khi kể về một feature backend, đừng kể kiểu:

- em thêm API
- em thêm bảng
- em sửa bug

Hãy kể theo khung này:

1. Vấn đề thực tế là gì.
2. Failure mode hoặc business risk là gì.
3. Source of truth nằm ở đâu.
4. Bạn chọn invariant nào để bảo vệ.
5. Bạn dùng transaction / constraint / idempotency thế nào.
6. Bạn verify bằng test, logs, metrics hoặc benchmark ra sao.
7. Trade-off là gì.

Nếu bạn kể được theo khung này, bạn sẽ được nhìn như người làm backend production chứ không chỉ là người code task.

---

## 10. Thứ tự khuyến nghị để bắt đầu ngay

Nếu hôm nay bạn muốn bắt đầu thật, hãy làm theo thứ tự này:

1. Chắc lại Go foundation: error, context, interface, testing.
2. Đọc `product-service` để quen layering.
3. Chuyển sang `order-service` để học transaction.
4. Đọc `payment-service` và `notification-service` để học idempotency + async flow.
5. Chọn 1 trong 5 feature ở trên và làm tới nơi tới chốn.

Nếu cần chọn một feature đầu tiên, mình khuyên ưu tiên:

1. `Payment Webhook Idempotency Hardening`
2. `Cursor Pagination / Query Optimization`
3. `Inventory Reservation`

Đây là 3 đề tài vừa mạnh để học, vừa mạnh để kể khi phỏng vấn.

---

## 11. Kết luận

Trước khi đụng microservice, hãy học Go đủ chắc để:

- đọc code không bị vấp syntax
- giữ được layering
- xử lý error và context đúng
- viết test cơ bản
- hiểu SQL và transaction ở mức làm việc được

Sau đó, hãy luyện SQL, transaction và idempotency trên các flow thật trong repo này.

Nếu bạn làm tốt 1 đến 2 feature sâu trong danh sách ở trên, kèm test, doc, và câu chuyện giải thích trade-off rõ ràng, bạn sẽ có nền tảng rất tốt để đi theo hướng Golang backend engineer mạnh hơn hẳn kiểu chỉ học lý thuyết microservice.
