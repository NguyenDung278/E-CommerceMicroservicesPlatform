# Repo-Based Golang Career Roadmap

Tài liệu này dành cho hai mục tiêu cùng lúc:

- giúp bạn hiểu `ecommerce-platform` một cách có hệ thống, không bị ngợp bởi số lượng service và folder
- giúp bạn dùng chính repo này như một "phòng tập nghề" để phát triển sự nghiệp Golang Developer theo hướng backend production

Nếu đọc xong mà bạn chỉ nhớ một điều, hãy nhớ điều này:

> Đừng học repo bằng cách đọc tất cả file. Hãy học bằng cách lần theo một flow thật, hiểu vì sao nó chạy được, rồi mới mở rộng dần sang kiến trúc, performance, reliability và vận hành.

---

## 1. Tài liệu này giúp bạn giải quyết vấn đề gì

Người mới vào repo thường gặp 4 khó khăn:

1. Không biết nên mở file nào trước.
2. Không biết service nào quan trọng hơn service nào.
3. Không biết skill nào là "học syntax" và skill nào là "học nghề".
4. Không biết học xong thì biến nó thành năng lực nghề nghiệp như thế nào.

Tài liệu này sẽ trả lời lần lượt:

- project này đang được tổ chức ra sao
- nên đọc repo theo thứ tự nào
- một Golang Developer cần thành thạo những gì để làm tốt một hệ thống commerce như repo này
- bạn nên luyện theo chặng nào để đi từ mức junior lên mid rồi senior
- nên build feature, note, test, benchmark hay proposal nào để biến quá trình học thành portfolio có giá trị

---

## 2. Bạn đang đứng ở đâu trong hành trình học nghề

Hãy tự xác định điểm bắt đầu của mình trước khi đọc tiếp.

### Mức 1: Mới học Go hoặc mới chạm backend

Bạn thường có dấu hiệu:

- hiểu syntax Go nhưng đọc code service còn chậm
- chưa quen với `context.Context`, interface, layering, transaction
- thấy nhiều service là rối
- chưa tự tin lần một request từ frontend tới database

Nếu đang ở mức này, mục tiêu của bạn chưa phải "thiết kế kiến trúc". Mục tiêu đúng là:

- chạy được local
- đọc được một flow end-to-end
- sửa được một bug nhỏ mà không phá hệ thống

### Mức 2: Đã làm backend một thời gian nhưng muốn lên mid

Bạn thường có dấu hiệu:

- đọc được code nhưng chưa luôn nhìn ra business invariant
- viết API được nhưng chưa chắc tay về transaction, idempotency, observability
- biết debug lỗi đơn lẻ nhưng chưa quen tối ưu hệ thống bằng số liệu

Nếu đang ở mức này, mục tiêu đúng là:

- hiểu tại sao repo này chia tầng `handler -> service -> repository`
- sửa được flow quan trọng như order/payment mà vẫn giữ contract rõ ràng
- biết viết test và log đủ để người khác tin thay đổi của bạn

### Mức 3: Muốn tiến gần Senior Golang Developer

Bạn thường quan tâm:

- consistency giữa nhiều service
- trade-off sync vs async
- retry, duplicate side effect, rollback, failure mode
- query scaling, tracing, metrics, cost vận hành

Nếu đang ở mức này, mục tiêu đúng là:

- nhìn repo như một hệ thống sản phẩm thật
- ưu tiên đúng bài toán production thay vì chạy theo abstraction cho đẹp
- biến hiểu biết kỹ thuật thành quyết định kiến trúc có trách nhiệm

---

## 3. Hiểu project này theo cách ít đau đầu nhất

Thay vì cố nhớ toàn bộ repo, hãy nhớ 5 ý chính.

### 3.1. `frontend/` là điểm bắt đầu dễ hiểu nhất

Nếu bạn muốn hiểu người dùng đang làm gì, hãy bắt đầu từ:

- `frontend/src/pages/storefront/`
- `frontend/src/features/`
- `frontend/src/services/api/`

Ở đây bạn sẽ thấy:

- user đang xem catalog thế nào
- product detail lấy dữ liệu ra sao
- cart và checkout gọi API nào

Đây là cách nhanh nhất để có "cảm giác sản phẩm" trước khi đi sâu vào backend.

### 3.2. `api-gateway/` là cửa vào HTTP

Gateway không nên chứa business logic. Vai trò chính là:

- nhận request từ UI
- định tuyến về service đúng domain
- gắn middleware như tracing, logging, rate limit

Khi bạn muốn biết một API storefront đi đâu, mở:

- `api-gateway/cmd/main.go`
- `api-gateway/internal/proxy/service_proxy.go`

### 3.3. Mỗi `services/*-service/` là một domain tương đối độc lập

Bạn không cần hiểu tất cả cùng lúc. Hãy xem từng service như một câu chuyện riêng:

- `user-service`: auth, profile, thông tin người dùng
- `product-service`: catalog, media, listing, review, search
- `cart-service`: giỏ hàng Redis + product lookup
- `order-service`: preview order, tạo đơn, coupon, lifecycle
- `payment-service`: payment, refund, webhook
- `notification-service`: consume event và gửi thông báo

### 3.4. PostgreSQL là nguồn dữ liệu chính

Đây là điều cực kỳ quan trọng về mặt tư duy nghề nghiệp.

Trong repo này:

- PostgreSQL là source of truth cho các domain chính
- Redis chủ yếu hỗ trợ cart, rate limit, cache hoặc các nhu cầu tạm thời
- RabbitMQ dành cho event bất đồng bộ
- MinIO và Elasticsearch là integration có thể degrade gracefully

Nếu bạn học nghề backend production, đây là bài học lớn:

> Đừng mặc định mọi vấn đề đều cần thêm công nghệ mới. Phần lớn tính đúng đắn vẫn xoay quanh model dữ liệu, query, transaction và boundary rõ ràng.

### 3.5. Cách đọc chuẩn là đi theo flow, không đi theo folder

Ví dụ với checkout:

1. Mở `frontend/src/pages/storefront/checkout-page.tsx`
2. Xem frontend gọi API nào trong `frontend/src/services/api/`
3. Mở route tương ứng ở gateway
4. Mở handler của `order-service`
5. Mở service xử lý pricing / lifecycle
6. Mở repository và migration liên quan

Chỉ cần bạn giữ thói quen này, khả năng đọc repo sẽ tăng rất nhanh.

---

## 4. Bạn nên đọc gì trước để hiểu project

Thứ tự khuyến nghị:

1. [00-local-setup.md](./00-local-setup.md)
2. [03-source-reading-roadmap.md](./03-source-reading-roadmap.md)
3. [06-testing-and-verification.md](./06-testing-and-verification.md)
4. [10-guide-to-debugging.md](./10-guide-to-debugging.md)
5. [12-production-readiness-roadmap.md](./12-production-readiness-roadmap.md)

Sau đó mới đọc sâu:

- `docs/deep-dive/` để hiểu kiến trúc và runtime
- `docs/annotated/` để đọc source theo module cụ thể

Nếu mục tiêu của bạn là backend Go nhiều hơn frontend, hãy ưu tiên thêm:

- `docs/annotated/shared-packages.md`
- `docs/annotated/order-service.md`
- `docs/annotated/payment-service.md`
- `docs/deep-dive/system-overview.md`

---

## 5. Một Golang Developer cần học gì từ repo này

Phần này là trọng tâm của tài liệu.

Repo này không chỉ dạy bạn "viết Go". Nó dạy bạn làm backend trong một hệ thống commerce có nhiều failure mode.

### 5.1. Go fundamentals phải thật chắc

Bạn cần nắm vững:

- struct, method, interface
- pointer vs value
- error handling với `fmt.Errorf(... %w ...)`, `errors.Is`, `errors.As`
- `context.Context`
- package organization
- table-driven test

Trong repo này, bạn sẽ gặp các khái niệm đó ở hầu hết service layer và handler layer.

Nếu phần này chưa chắc, mọi chủ đề phía sau sẽ rất mệt.

### 5.2. Layering và trách nhiệm từng tầng

Đây là kỹ năng nghề rất quan trọng.

Repo đang đi theo hướng:

- `handler`: parse request, validate boundary, map response
- `service`: business logic, orchestration
- `repository`: SQL, transaction, persistence

Bạn cần học cách nhìn ra:

- logic nào nên ở handler
- logic nào phải nằm ở service
- query nào nên gom ở repository
- chỗ nào đang lẫn vai trò và cần cleanup

Nếu bạn chưa làm được điều này, rất khó viết code sạch trong hệ thống lớn.

### 5.3. SQL, transaction và data modeling

Một backend engineer mạnh không thể yếu SQL.

Bạn nên học từ repo này:

- cách đọc migration
- cách lần từ query tới index
- khi nào cần transaction
- khi nào cần lock hoặc invariant chặt hơn
- vì sao `COUNT(*) + OFFSET` có thể thành bottleneck

Các nơi đáng học nhất:

- `product-service` cho listing và pagination
- `order-service` cho pricing, create order, report
- `payment-service` cho payment state

### 5.4. API contract và boundary

Bạn cần học:

- request/response DTO
- status code và error mapping
- API ổn định nghĩa là gì
- frontend và backend giữ contract nhất quán ra sao

Bài học lớn ở đây là:

> Backend tốt không chỉ "xử lý đúng", mà còn phải "dễ dùng, dễ đoán, khó gọi sai".

### 5.5. Tư duy asynchronous flow

Khi đi sâu hơn, bạn sẽ thấy hệ thống không chỉ có HTTP request-response.

Repo này giúp bạn học:

- RabbitMQ event flow
- outbox / inbox pattern
- eventual consistency
- retry và duplicate message

Đây là vùng rất giá trị khi bạn muốn lên mid hoặc senior, vì nhiều ứng viên chỉ quen synchronous CRUD.

### 5.6. Observability và debugging

Bạn nên học cách trả lời các câu hỏi:

- request này đã đi qua service nào
- nó chậm ở đâu
- lỗi xảy ra ở DB, gateway hay consumer
- một event đã publish nhưng vì sao email chưa gửi

Repo đã có:

- structured logging
- Prometheus metrics
- OpenTelemetry tracing
- Jaeger/Grafana trong local stack

Nếu bạn biết tận dụng chúng, bạn đang học đúng kỹ năng production.

### 5.7. Testing và verification

Bạn cần hiểu rõ:

- khi nào viết unit test
- khi nào nên viết integration test
- verify thay đổi ở local như thế nào để không tự tin ảo

Một Golang Developer mạnh không chỉ code chạy được, mà còn biết chứng minh thay đổi của mình đáng tin.

### 5.8. Security và production thinking

Bạn không cần là security specialist để làm backend tốt, nhưng phải có phản xạ đúng:

- input đã validate chưa
- query đã parameterized chưa
- route có cần auth/authz không
- webhook có verify chưa
- log có lộ dữ liệu nhạy cảm không

Career sẽ tiến nhanh hơn rất nhiều nếu bạn có phản xạ này từ sớm.

---

## 6. Học nghề theo cấp độ: từ Junior lên Senior

### 6.1. Giai đoạn Junior

Mục tiêu chính:

- hiểu flow
- code đúng layering
- bớt sợ repo lớn

Bạn nên tập trung vào:

- đọc một flow từ frontend tới DB
- sửa bug nhỏ ở UI hoặc API
- viết test cơ bản
- làm quen migration và query đơn giản

Dấu hiệu bạn đang tiến bộ:

- không còn mở file theo kiểu đoán mò
- biết handler gọi service nào
- biết repository nào chịu trách nhiệm query nào
- có thể giải thích một flow bằng lời của mình

### 6.2. Giai đoạn Mid-level

Mục tiêu chính:

- giữ được business rule khi sửa code
- nghĩ đến edge case và failure mode
- biết verify một thay đổi nghiêm túc hơn

Bạn nên tập trung vào:

- checkout, order, coupon, payment
- transaction và idempotency
- tracing, metrics, structured logs
- test cho edge case

Dấu hiệu bạn đang tiến bộ:

- đọc code không chỉ thấy "nó làm gì" mà còn thấy "nó có thể hỏng ở đâu"
- có thể đề xuất refactor nhỏ nhưng đúng trọng tâm
- biết khi nào nên giữ giải pháp đơn giản thay vì thêm abstraction

### 6.3. Giai đoạn Senior

Mục tiêu chính:

- quyết định kiến trúc có trách nhiệm
- cân bằng correctness, complexity và cost vận hành
- nâng chất lượng toàn team, không chỉ code của riêng mình

Bạn nên tập trung vào:

- write flow nhiều bước
- async consistency
- performance tuning bằng số liệu
- observability đầy đủ
- review code theo business invariant

Dấu hiệu bạn đang tiến bộ:

- bạn nghĩ được cả happy path lẫn rollback path
- bạn nhìn ra nợ kỹ thuật đáng trả trước khi nó thành sự cố production
- bạn không thêm thành phần mới chỉ để cảm thấy "xịn hơn"

---

## 7. Lộ trình học thực chiến 30 / 60 / 90 ngày

Phần này hữu ích nếu bạn muốn học có lịch trình rõ.

### 30 ngày đầu: Hiểu hệ thống và sửa được bug nhỏ

Mục tiêu:

- chạy local ổn định
- hiểu catalog, product detail, cart, checkout ở mức cơ bản
- hoàn thành ít nhất 1 thay đổi nhỏ end-to-end

Bạn nên làm:

1. Đọc setup và source-reading docs.
2. Theo flow catalog và checkout.
3. Sửa một bug nhỏ ở frontend hoặc API.
4. Viết note riêng về kiến trúc repo.

Kết quả mong đợi:

- không còn mù đường trong repo
- đã biết gateway, service, repository liên kết ra sao

### 60 ngày: Bắt đầu làm việc như một backend engineer thực thụ

Mục tiêu:

- sửa được flow nghiệp vụ quan trọng
- hiểu transaction, coupon, payment, event
- tự tin viết test và verify

Bạn nên làm:

1. Đọc sâu `order-service` và `payment-service`.
2. Viết test cho checkout/pricing/payment edge case.
3. Theo một event từ publish tới notification.
4. Làm một PR cải thiện reliability hoặc clarity.

Kết quả mong đợi:

- bắt đầu nhìn thấy production risk
- có khả năng review code tốt hơn

### 90 ngày: Tạo ra dấu ấn portfolio có chất lượng

Mục tiêu:

- có 1 đến 2 thay đổi đáng kể
- có tài liệu, benchmark hoặc proposal chất lượng
- có câu chuyện nghề nghiệp rõ ràng khi đi phỏng vấn

Bạn nên làm:

1. Chọn một đề tài có chiều sâu.
2. Làm trọn từ phân tích, code, test, verify đến doc.
3. Viết lại bài học rút ra: trade-off, failure mode, cách verify.

Ví dụ đề tài mạnh:

- harden payment webhook bằng idempotency
- tối ưu list endpoint nóng bằng query/index
- mở rộng outbox/inbox observability
- cải thiện checkout UX nhưng vẫn giữ contract backend rõ ràng

---

## 8. Bạn nên luyện những bài tập nào trong chính repo này

Đây là phần biến việc học thành năng lực thật.

### Bài tập dễ để bắt đầu

- thêm một field response nhỏ ở product listing
- sửa một bug validation hoặc UX ở checkout
- viết test cho một service function đơn giản
- cập nhật doc khi phát hiện source và tài liệu lệch nhau

### Bài tập mức trung bình

- thêm filter hoặc sort cho catalog
- cải thiện error mapping ở order/payment
- thêm logging có ngữ cảnh cho một flow đang mờ
- viết integration test cho query quan trọng

### Bài tập mức khá mạnh cho portfolio

- bổ sung idempotency cho một payment path
- giảm `COUNT(*) + OFFSET` ở endpoint phù hợp
- thêm metric/tracing rõ hơn cho queue consumer
- refactor một flow nhiều điều kiện thành business logic dễ đọc hơn

### Bài tập dành cho tư duy senior

- viết proposal ngắn cho một vấn đề production thực tế
- chỉ ra failure mode hiện tại và cách giảm rủi ro bằng giải pháp đơn giản nhất
- benchmark trước/sau cho một hot path
- thiết kế rollback plan cho một thay đổi data model

---

## 9. Những kỹ năng quyết định sự nghiệp Golang Developer

Nếu mục tiêu của bạn là phát triển nghề nghiệp lâu dài, hãy ưu tiên theo thứ tự này.

### 9.1. Kỹ năng nền tảng

- Go cơ bản thật chắc
- SQL đủ mạnh để tự đọc và tối ưu query phổ biến
- HTTP API design
- Git workflow sạch

### 9.2. Kỹ năng giúp bạn lên Mid nhanh

- transaction và data consistency
- testing strategy
- debug qua logs/traces
- hiểu queue, event, retry
- biết đọc code cũ và sửa mà không phá hành vi

### 9.3. Kỹ năng giúp bạn tiến gần Senior

- architectural judgement
- performance tuning bằng dữ liệu
- reliability và incident thinking
- security review cơ bản
- viết tài liệu giúp cả team làm việc tốt hơn

Điều quan trọng:

> Senior không phải là người dùng nhiều pattern nhất. Senior là người chọn giải pháp đủ tốt, đủ rõ, đủ an toàn và đủ rẻ để vận hành.

---

## 10. Cách biến repo này thành portfolio nghề nghiệp

Nhiều người học rất nhiều nhưng không biết kể câu chuyện nghề nghiệp của mình. Hãy dùng repo này để tạo bằng chứng rõ ràng.

### Bạn nên lưu lại các đầu ra sau

- diagram flow bạn tự vẽ
- note phân tích kiến trúc
- test bạn đã viết
- benchmark hoặc profiling note
- doc bạn đã cập nhật để làm rõ hệ thống
- PR hoặc patch giải quyết một vấn đề thật

### Khi đi phỏng vấn, bạn có thể kể theo mẫu này

1. Vấn đề là gì.
2. Vì sao nó quan trọng với người dùng hoặc vận hành.
3. Bạn đã đọc flow ra sao.
4. Bạn chọn giải pháp nào và vì sao không chọn giải pháp phức tạp hơn.
5. Bạn verify bằng cách nào.
6. Bạn học được gì về production thinking.

Nếu bạn kể được theo cấu trúc này, hồ sơ của bạn sẽ thuyết phục hơn rất nhiều so với kiểu "em có làm project e-commerce".

---

## 11. Checklist tự đánh giá sau khi học

Bạn có thể tự chấm mình bằng cách xem đã làm được bao nhiêu điều sau.

### Hiểu project

- giải thích được vai trò của từng service chính
- lần được một flow storefront từ UI đến DB
- biết PostgreSQL, Redis, RabbitMQ đang được dùng cho mục đích gì
- biết nơi nào là source of truth

### Kỹ năng coding

- viết code bám đúng layering
- xử lý error rõ ràng, không nuốt lỗi
- viết test cho business rule quan trọng
- đọc và sửa query mà không sợ

### Tư duy production

- nghĩ tới timeout, retry, idempotency
- biết log gì để debug sau này
- nhận ra nơi nào có thể thành bottleneck
- không vội thêm công nghệ khi PostgreSQL và refactor tốt đã đủ

### Tư duy nghề nghiệp

- hiểu mình đang thiếu gì
- có kế hoạch học tiếp rõ ràng
- có ít nhất một thay đổi trong repo mà bạn tự tin giải thích trước senior engineer

---

## 12. Nếu chỉ có thời gian ngắn, hãy ưu tiên gì

Nếu bạn chỉ có vài ngày, đừng cố đọc hết.

Hãy ưu tiên:

1. setup local
2. đọc flow catalog hoặc checkout
3. hiểu `handler -> service -> repository`
4. làm một thay đổi nhỏ nhưng verify đàng hoàng
5. đọc thêm production-readiness roadmap

Làm tốt 5 bước này có giá trị hơn rất nhiều so với việc đọc rải rác 30 file mà không nắm được flow nào hoàn chỉnh.

---

## 13. Kết luận

`ecommerce-platform` là một repo rất tốt để học nghề nếu bạn dùng nó đúng cách.

Giá trị lớn nhất của repo này không nằm ở chỗ nó có nhiều service, mà ở chỗ nó cho bạn luyện:

- đọc flow thật
- giữ business rule rõ ràng
- làm việc với SQL, transaction, event, observability
- suy nghĩ như một backend engineer có trách nhiệm với production

Nếu mục tiêu của bạn là phát triển sự nghiệp Golang Developer, hãy học theo hướng:

- hiểu hệ thống trước
- sửa thay đổi nhỏ trước
- tăng dần độ khó bằng checkout, payment, event
- luôn để lại bằng chứng học tập dưới dạng test, note, doc, benchmark hoặc PR

Đi theo hướng này, bạn không chỉ "biết Go", mà sẽ dần trở thành người có thể xây, sửa và vận hành một sản phẩm backend thực tế.
