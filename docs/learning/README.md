# Learning Path

`learning/` là tầng tài liệu dành cho người mới vào repo hoặc người muốn dùng chính `ecommerce-platform` như một bộ case study để học backend/full-stack thực chiến và phát triển sự nghiệp Golang Developer.

Nếu bạn đang phân vân "nên đọc gì trước để vừa hiểu project, vừa biết mình cần học gì tiếp theo", thì đây là tầng docs nên mở đầu tiên.

## Thứ tự học khuyến nghị

1. [00-local-setup.md](./00-local-setup.md)
2. [02-project-technologies-explained.md](./02-project-technologies-explained.md)
3. [03-source-reading-roadmap.md](./03-source-reading-roadmap.md)
4. [05-first-contribution-walkthrough.md](./05-first-contribution-walkthrough.md)
5. [06-testing-and-verification.md](./06-testing-and-verification.md)
6. [10-guide-to-debugging.md](./10-guide-to-debugging.md)
7. [09-how-to-add-new-feature.md](./09-how-to-add-new-feature.md)
8. [11-senior-source-code-review-guide.md](./11-senior-source-code-review-guide.md)
9. [12-production-readiness-roadmap.md](./12-production-readiness-roadmap.md)
10. [13-repo-based-career-roadmap.md](./13-repo-based-career-roadmap.md)
11. [14-go-sql-idempotency-interview-playbook.md](./14-go-sql-idempotency-interview-playbook.md)
12. [15-end-to-end-verification-checklists.md](./15-end-to-end-verification-checklists.md)
13. [16-refund-queue-operations-playbook.md](./16-refund-queue-operations-playbook.md)
14. [17-performance-feature-parity-roadmap.md](./17-performance-feature-parity-roadmap.md)
15. [18-comprehensive-source-code-understanding-development-guide.md](./18-comprehensive-source-code-understanding-development-guide.md)

## Bộ tài liệu này giúp bạn làm gì

- dựng local runtime đúng với compose hiện tại, không đoán mò theo docs cũ
- biết frontend nào là đường chính, backend nào là source of truth, dependency nào đang optional
- học cách đọc repo theo flow chứ không đọc rời từng file
- biết verify thay đổi theo đúng runtime hiện tại
- biết cách debug khi compose, env, gateway, DB hoặc frontend đang lệch nhau
- nối việc "đọc hiểu project" với "phát triển năng lực nghề nghiệp" theo hướng backend Go production

## Nếu mục tiêu của bạn là hiểu project nhanh mà vẫn chắc

Hãy ưu tiên đúng 5 tài liệu này trước:

1. [00-local-setup.md](./00-local-setup.md)
2. [03-source-reading-roadmap.md](./03-source-reading-roadmap.md)
3. [06-testing-and-verification.md](./06-testing-and-verification.md)
4. [10-guide-to-debugging.md](./10-guide-to-debugging.md)
5. [13-repo-based-career-roadmap.md](./13-repo-based-career-roadmap.md)

Lý do:

- `00` giúp bạn dựng runtime đúng
- `03` giúp bạn biết mở file nào trước
- `06` giúp bạn tránh verify hời hợt
- `10` giúp bạn không bị bí khi local/dev lệch nhau
- `13` biến việc đọc repo thành một lộ trình học nghề rõ ràng

## Khi nào chuyển sang `deep-dive/` và `annotated/`

- Khi đã chạy được local: sang `deep-dive/`
- Khi đã hiểu boundary của hệ thống: sang `annotated/`
- Nếu bạn đang sửa frontend sau refactor: đọc `deep-dive/frontend-architecture.md` rồi mới sang annotate frontend

## Tài liệu tổng hợp nên ưu tiên đọc

- [03-source-reading-roadmap.md](./03-source-reading-roadmap.md): biết phải mở file nào trước khi sửa code
- [06-testing-and-verification.md](./06-testing-and-verification.md): biết verify gì trước khi tin rằng mình đã sửa xong
- [11-senior-source-code-review-guide.md](./11-senior-source-code-review-guide.md): nhìn repo như một senior engineer thay vì chỉ như người học syntax
- [12-production-readiness-roadmap.md](./12-production-readiness-roadmap.md): nối từ hiểu source code sang biết mình cần học gì để ship một sản phẩm e-commerce production-ready
- [13-repo-based-career-roadmap.md](./13-repo-based-career-roadmap.md): bản đồ học nghề bám chính repo này, giải thích nên học gì theo từng giai đoạn từ hiểu flow tới tư duy production
- [14-go-sql-idempotency-interview-playbook.md](./14-go-sql-idempotency-interview-playbook.md): playbook cực thực dụng về nền Go trước microservice, cách luyện SQL/transaction/idempotency, và 5 đề tài mạnh để build portfolio/phỏng vấn backend
- [15-end-to-end-verification-checklists.md](./15-end-to-end-verification-checklists.md): checklist ngắn gọn nhưng sát production để verify end-to-end theo flow thay vì test rời từng API
- [16-refund-queue-operations-playbook.md](./16-refund-queue-operations-playbook.md): cách đọc refund queue health, nhận diện stale lease/retry-heavy queue, và thứ tự điều tra khi refund backlog tăng
- [17-performance-feature-parity-roadmap.md](./17-performance-feature-parity-roadmap.md): một bản đồ ngắn nhưng thực dụng để biết repo đang nghẽn hiệu năng ở đâu, FE nào chưa theo kịp backend, backend nên thêm gì tiếp, và nên đọc cụm source nào để học backend Golang chắc tay hơn
- [18-comprehensive-source-code-understanding-development-guide.md](./18-comprehensive-source-code-understanding-development-guide.md): bản đồ tổng hợp để hiểu project theo functional area, biết mở file nào khi debug/thêm feature, và nối việc đọc source với các năng lực backend Go nên luyện
