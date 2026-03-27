# Feature Tracker — Roadmap nâng cấp project theo hướng Senior Backend Golang

Tệp này không phải wishlist tính năng. Đây là backlog cải tiến có chủ đích để:

- nâng chất lượng source code hiện tại
- cải thiện performance và reliability theo số liệu
- giúp người học rèn đúng năng lực của một Back-end Senior Golang

Nguyên tắc chọn việc:

- ưu tiên thay đổi có tác động thật lên codebase hiện tại
- ưu tiên thứ đang lệch giữa tài liệu và code
- ưu tiên bottleneck có thể đo được
- ưu tiên tính đúng đắn dữ liệu trước “độ ngầu” kiến trúc

Những việc đã được code làm tốt thì không đưa lại vào roadmap chỉ để đủ danh sách. Ví dụ: `product-service` đã có cursor pagination cho catalog; vì vậy roadmap không lặp lại mục đó nữa.

---

## P0 — Việc nên làm sớm nhất

### 1. [ ] Chuẩn hoá tài liệu phát triển tính năng theo đúng path và flow thật của repo

- **Vì sao cần làm:** Một phần tài liệu hiện vẫn nói theo path cũ như `internal/delivery/http` hoặc `api-gateway/main.go`, trong khi source code thực tế đang đi theo `internal/handler`, `internal/grpc`, `cmd/main.go`, `api-gateway/internal/proxy`.
- **Kết quả mong muốn:** Người mới có thể thêm feature mà không phải đoán cấu trúc hoặc sửa sai nhiều lần.
- **Giá trị học tập:** Senior không chỉ viết code; còn phải giữ tài liệu sống khớp với codebase.

### 2. [ ] Tạo transaction helper dùng lại được cho các write flow nhiều bước

- **Vì sao cần làm:** Hiện transaction xuất hiện trực tiếp ở repository write path, đặc biệt trong order flow. Khi số lượng case tăng, việc copy/paste `BeginTx/Commit/Rollback` sẽ làm code khó đọc và dễ thiếu rollback path.
- **Kết quả mong muốn:** Có helper kiểu `RunInTx(ctx, db, fn)` hoặc abstraction tương đương, đủ đơn giản, dùng được cho order/payment/coupon/audit path mà không làm service layer bị dính `*sql.Tx` lung tung.
- **Giá trị học tập:** Đây là bước nâng từ “biết transaction” sang “biết tổ chức transactional boundary sạch”.

### 3. [ ] Thêm idempotency cho `payment-service`

- **Vì sao cần làm:** Thanh toán là nơi client retry, timeout, refresh trình duyệt, webhook duplicate xảy ra thường xuyên. Không có idempotency thì rất dễ tạo duplicate payment hoặc trải nghiệm khó hiểu.
- **Kết quả mong muốn:** Hỗ trợ `X-Idempotency-Key` cho payment initiation và chuẩn hoá xử lý duplicate webhook/event.
- **Giá trị học tập:** Đây là kỹ năng thực chiến cốt lõi của backend xử lý money flow.

### 4. [ ] Áp dụng outbox pattern cho event publish quan trọng ở order/payment

- **Vì sao cần làm:** Code hiện tại có các đoạn lưu DB xong rồi mới publish RabbitMQ; nếu broker lỗi đúng lúc đó thì dữ liệu và event có thể lệch nhau.
- **Kết quả mong muốn:** Persist business data và outbox record trong cùng transaction; background publisher chịu trách nhiệm phát event và đánh dấu đã gửi.
- **Giá trị học tập:** Học cách xử lý consistency thực dụng hơn nhiều so với nhảy ngay vào Saga.

### 5. [ ] Bổ sung benchmark + pprof cho hot path chính

- **Vì sao cần làm:** Repo đã có log, metric, tracing, nhưng profiling và benchmark chưa thành thói quen. Không có số liệu thì rất dễ tối ưu sai chỗ.
- **Kết quả mong muốn:** Có benchmark tối thiểu cho product listing, order listing/filtering, payment summary path; có hướng dẫn chạy `pprof` trong local.
- **Giá trị học tập:** Senior tối ưu bằng evidence, không tối ưu theo trực giác.

---

## P1 — Performance và hiệu quả dữ liệu

### 6. [ ] Thay dần `COUNT(*) + OFFSET/LIMIT` ở các list endpoint lớn bằng chiến lược bền hơn

- **Vì sao cần làm:** `product-service` đã đi trước với cursor pagination, nhưng `order-service` admin listing vẫn dùng `COUNT(*) + OFFSET/LIMIT`. Khi dữ liệu tăng, đây sẽ là chi phí thật.
- **Kết quả mong muốn:** Xác định endpoint nào cần giữ offset cho backoffice, endpoint nào nên chuyển sang cursor hoặc seek pagination; cập nhật API contract có chủ đích, không làm đại trà.
- **Giá trị học tập:** Học cách chọn pagination theo bối cảnh chứ không dùng một mẫu cho mọi nơi.

### 7. [ ] Đưa các phép tổng hợp payment về SQL thay vì load nhiều record rồi tính trong Go

- **Vì sao cần làm:** Payment flow hiện có xu hướng đọc danh sách payment của một order rồi tổng hợp trong memory. Với lịch sử giao dịch lớn hơn, cách này sẽ tăng latency và allocations không cần thiết.
- **Kết quả mong muốn:** Thêm repository query dạng aggregate cho `net paid`, `refundable amount`, `latest charge/refund summary`, kèm index phù hợp.
- **Giá trị học tập:** Tư duy “đưa việc nặng cho DB làm đúng chỗ” là kỹ năng quan trọng của backend senior.

### 8. [ ] Audit index và query plan cho các endpoint nóng bằng `EXPLAIN ANALYZE`

- **Vì sao cần làm:** Repo đã có một số migration thêm index đúng hướng, nhưng chưa có nhịp audit bài bản cho query mới/cũ.
- **Kết quả mong muốn:** Lập danh sách top query theo volume hoặc độ chậm, kiểm tra execution plan, thêm composite index hoặc rewrite query khi có bằng chứng.
- **Giá trị học tập:** Học cách đọc plan, cardinality, scan type, và trade-off index write/read.

### 9. [ ] Xây dựng chiến lược cache có điều kiện cho dữ liệu đọc nhiều

- **Vì sao cần làm:** Redis đã có trong hệ thống, nhưng cache chỉ nên thêm sau khi đã đo được read hotspot thật. Cache sai chỗ sẽ tạo complexity mà không tăng hiệu quả.
- **Kết quả mong muốn:** Chọn 1–2 read path đáng giá nhất, định nghĩa TTL, invalidation rule, cache key, fallback khi Redis lỗi.
- **Giá trị học tập:** Senior biết khi nào cache đáng tiền và khi nào chỉ là nợ vận hành.

### 10. [ ] Tối ưu bulk import/catalog maintenance theo batch và streaming

- **Vì sao cần làm:** Nếu project tiến tới quản trị catalog lớn, import/update số lượng lớn sẽ sớm thành bài toán thật. Làm sớm theo batch sẽ tránh phải rewrite muộn.
- **Kết quả mong muốn:** Thiết kế flow import dùng streaming parse, batch insert/update, bounded worker, backpressure rõ ràng.
- **Giá trị học tập:** Đây là bài tập rất tốt về memory profile, channel design, và throughput.

---

## P2 — Reliability, resilience, vận hành

### 11. [ ] Thêm dead-letter và retry policy chuẩn cho `notification-service`

- **Vì sao cần làm:** Notification hiện đã consume event và gửi email, nhưng retry/dead-letter cần rõ ràng hơn để tránh poison message hoặc retry vô hạn.
- **Kết quả mong muốn:** Có retry count, delay policy, dead-letter queue, log/metric cho message fail cuối cùng.
- **Giá trị học tập:** Học cách vận hành consumer thực chiến thay vì chỉ “consume được là xong”.

### 12. [ ] Chuẩn hoá graceful shutdown cho mọi service và mọi worker

- **Vì sao cần làm:** Nhiều service đã có shutdown logic, nhưng cần thống nhất handling cho HTTP, gRPC, worker, consumer, ticker, và signal như `SIGTERM`.
- **Kết quả mong muốn:** Mọi service dừng có kiểm soát, không rơi request, không bỏ dở goroutine nền, không làm mất work dễ tránh.
- **Giá trị học tập:** Đây là kỹ năng production readiness tối thiểu của backend senior.

### 13. [ ] Chuẩn hoá timeout/retry/circuit breaker cho outbound call

- **Vì sao cần làm:** Gateway đã có retry + circuit breaker cho một số flow, nhưng các outbound path khác cần cùng tiêu chuẩn về timeout, retry-safe method, logging, tracing field.
- **Kết quả mong muốn:** Có rule dùng chung cho HTTP/gRPC client: timeout mặc định, retry policy, idempotency expectation, error mapping.
- **Giá trị học tập:** Senior phải kiểm soát failure mode xuyên service, không chỉ code happy path.

### 14. [ ] Nâng cấp observability cho background job và async flow

- **Vì sao cần làm:** HTTP request thường đã có log/trace khá ổn, nhưng cron, queue consumer, sync job, low-stock monitor cần signal quan sát rõ hơn.
- **Kết quả mong muốn:** Có metric cho throughput/failure/retry, trace hoặc correlation field hợp lý, dashboard tối thiểu cho async path.
- **Giá trị học tập:** Năng lực debug distributed flow đến từ observability tốt, không đến từ đoán mò.

---

## P3 — Chất lượng code, security, CI/CD, tư duy thiết kế

### 15. [ ] Mở rộng test coverage theo vùng rủi ro thay vì chạy theo phần trăm

- **Vì sao cần làm:** Repo đã có khá nhiều unit/integration test, nhưng chưa đồng đều ở các flow dễ hỏng như webhook, transaction rollback, authz, duplicate side effect.
- **Kết quả mong muốn:** Ưu tiên test vào payment, order status transition, repository query quan trọng, gateway proxy edge case, permission path.
- **Giá trị học tập:** Senior biết nơi nào đáng test nhất để giảm rủi ro thực tế.

### 16. [ ] Đưa `go test`, race test, lint, migration verification vào CI bắt buộc

- **Vì sao cần làm:** Chất lượng không nên phụ thuộc vào việc reviewer nhớ chạy tay.
- **Kết quả mong muốn:** Pipeline tối thiểu gồm unit test, integration test quan trọng, `-race` cho phần phù hợp, static checks, và verify migration/app startup cơ bản.
- **Giá trị học tập:** Đây là bước biến codebase từ “project học tập” thành “repo có kỷ luật kỹ thuật”.

### 17. [ ] Rà soát bảo mật theo checklist backend thực dụng

- **Vì sao cần làm:** Project đã có auth, OAuth, webhook, upload, proxy, email flow. Bề mặt tấn công không còn nhỏ.
- **Kết quả mong muốn:** Có checklist định kỳ cho secret/config, authz, validation, file upload, redirect handling, logging PII, signature verification, rate-limit.
- **Giá trị học tập:** Senior backend phải nhìn thấy risk trước khi incident xảy ra.

### 18. [ ] Viết design note ngắn cho các quyết định khó thay vì thêm abstraction vô tội vạ

- **Vì sao cần làm:** Khi repo lớn dần, những chỗ như transaction boundary, outbox, cache policy, pagination strategy, event contract cần được giải thích bằng decision log ngắn gọn.
- **Kết quả mong muốn:** Mỗi thay đổi kiến trúc đáng kể có 1 note ngắn: bối cảnh, lựa chọn, trade-off, failure mode, migration path.
- **Giá trị học tập:** Đây là phần rất quan trọng để bước từ level “code tốt” sang “design tốt”.

### 19. [ ] Chỉ xem Saga hoặc choreography là bước sau, không phải ưu tiên mặc định

- **Vì sao cần làm:** Repo có RabbitMQ và microservices, nhưng điều đó không có nghĩa mọi bài toán consistency đều phải leo thẳng lên Saga. Outbox, idempotency, compensation cục bộ và transaction boundary tốt thường mang lại giá trị sớm hơn.
- **Kết quả mong muốn:** Chỉ nghiên cứu/triển khai Saga sau khi đã làm xong những nền tảng reliability cơ bản ở trên và có use case thật chứng minh cần thiết.
- **Giá trị học tập:** Senior biết phản kháng với độ phức tạp không cần thiết.

---

## Cách dùng roadmap này

1. Luôn làm từ trên xuống theo ưu tiên, trừ khi có incident hoặc requirement gấp.
2. Mỗi lần chỉ kéo 1 mục lớn hoặc 1 lát cắt nhỏ của mục lớn.
3. Trước khi code, viết rõ:
   - vấn đề hiện tại
   - số liệu hoặc dấu hiệu đang có
   - tiêu chí hoàn thành
4. Sau khi xong, cập nhật:
   - thay đổi chính
   - benchmark/metric nếu có
   - lesson learned

Nếu hoàn thành tốt phần P0 và P1, bạn đã đi rất gần tới tư duy của một Backend Senior Go: ưu tiên tính đúng đắn dữ liệu, hiệu năng đo được, observability, và độ đơn giản có chủ đích.
