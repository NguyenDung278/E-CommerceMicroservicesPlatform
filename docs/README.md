# Project Documentation Map

Thư mục `docs/` được tổ chức như một handbook nội bộ để đọc và học từ chính source code hiện có của `ecommerce-platform`. Bộ tài liệu này không chỉ trả lời "code làm gì", mà còn cố gắng giải thích:

- vì sao module đó tồn tại
- dữ liệu đi qua các layer như thế nào
- pattern nào đáng học và vì sao nó giúp code dễ đọc, dễ sửa, dễ mở rộng hơn
- những chỗ nào đang ở trạng thái chuyển tiếp hoặc còn nợ refactor

Ba lớp tài liệu chính:

- `learning/`: onboarding, setup, cách đọc repo, cách verify và debug
- `deep-dive/`: kiến trúc, runtime, boundary giữa service và vai trò của từng khối lớn
- `annotated/`: đọc source theo file/module/flow cụ thể, thiên về tư duy đọc code

## Đọc từ đâu nếu bạn mới vào repo

### Lộ trình ngắn nhất để hiểu runtime toàn hệ thống

1. [learning/00-local-setup.md](./learning/00-local-setup.md)
2. [deep-dive/system-overview.md](./deep-dive/system-overview.md)
3. [deep-dive/frontend-architecture.md](./deep-dive/frontend-architecture.md)
4. [learning/03-source-reading-roadmap.md](./learning/03-source-reading-roadmap.md)
5. [annotated/README.md](./annotated/README.md)

### Lộ trình nếu mục tiêu của bạn là vừa hiểu project vừa phát triển sự nghiệp Golang Developer

1. [learning/00-local-setup.md](./learning/00-local-setup.md)
2. [learning/03-source-reading-roadmap.md](./learning/03-source-reading-roadmap.md)
3. [learning/06-testing-and-verification.md](./learning/06-testing-and-verification.md)
4. [learning/10-guide-to-debugging.md](./learning/10-guide-to-debugging.md)
5. [learning/12-production-readiness-roadmap.md](./learning/12-production-readiness-roadmap.md)
6. [learning/13-repo-based-career-roadmap.md](./learning/13-repo-based-career-roadmap.md)
7. [learning/14-go-sql-idempotency-interview-playbook.md](./learning/14-go-sql-idempotency-interview-playbook.md)
8. [learning/17-performance-feature-parity-roadmap.md](./learning/17-performance-feature-parity-roadmap.md)

Lộ trình này phù hợp nếu bạn không chỉ muốn "đọc cho biết", mà muốn dùng repo này để luyện tư duy backend Go thực chiến, hiểu production risk, và xây một nền tảng nghề nghiệp rõ ràng hơn.

### Lộ trình nếu bạn đang sửa frontend React + Vite

1. [deep-dive/frontend-architecture.md](./deep-dive/frontend-architecture.md)
2. [deep-dive/frontend-refactor-status.md](./deep-dive/frontend-refactor-status.md)
3. [annotated/frontend-source-map.md](./annotated/frontend-source-map.md)
4. [annotated/frontend-app.md](./annotated/frontend-app.md)

### Lộ trình nếu bạn đang sửa backend Go

1. [annotated/shared-packages.md](./annotated/shared-packages.md)
2. [annotated/api-gateway-main.md](./annotated/api-gateway-main.md)
3. Chọn một domain service trong `annotated/`
4. Đọc thêm phần tương ứng trong `deep-dive/`
5. Quay lại [learning/09-how-to-add-new-feature.md](./learning/09-how-to-add-new-feature.md) trước khi code

## Mục lục chi tiết

### `learning/`

- [README.md](./learning/README.md): bản đồ học tập của tầng `learning`
- [00-local-setup.md](./learning/00-local-setup.md): setup local theo trạng thái Docker/Compose hiện tại
- [03-source-reading-roadmap.md](./learning/03-source-reading-roadmap.md): cách đọc repo theo thứ tự để không bị ngợp
- [05-first-contribution-walkthrough.md](./learning/05-first-contribution-walkthrough.md): walkthrough cho contributor mới
- [06-testing-and-verification.md](./learning/06-testing-and-verification.md): cách verify thay đổi theo đúng runtime hiện tại
- [09-how-to-add-new-feature.md](./learning/09-how-to-add-new-feature.md): thêm feature mới theo path và layering thật của repo
- [10-guide-to-debugging.md](./learning/10-guide-to-debugging.md): debug Docker, gateway, service, trace và DB
- [11-senior-source-code-review-guide.md](./learning/11-senior-source-code-review-guide.md): review toàn repo theo góc nhìn senior
- [12-production-readiness-roadmap.md](./learning/12-production-readiness-roadmap.md): lộ trình học để biến hiểu biết repo thành năng lực xây sản phẩm commerce thực chiến
- [13-repo-based-career-roadmap.md](./learning/13-repo-based-career-roadmap.md): tài liệu chi tiết để hiểu project theo flow thật và chuyển kiến thức đó thành năng lực nghề nghiệp Golang Developer
- [14-go-sql-idempotency-interview-playbook.md](./learning/14-go-sql-idempotency-interview-playbook.md): hướng dẫn thực dụng về Go foundation trước microservice, cách luyện SQL/transaction/idempotency, và các feature nên build để đi phỏng vấn backend mạnh hơn
- [15-end-to-end-verification-checklists.md](./learning/15-end-to-end-verification-checklists.md): checklist verify theo flow thật cho catalog, checkout, payment, returns, và admin
- [16-refund-queue-operations-playbook.md](./learning/16-refund-queue-operations-playbook.md): playbook vận hành khi `refund_pending` backlog, retry nhiều, hoặc có dấu hiệu stale worker lease
- [17-performance-feature-parity-roadmap.md](./learning/17-performance-feature-parity-roadmap.md): audit hiệu năng, khoảng trống BE/FE hiện tại, feature backend nên thêm tiếp, và các cụm source code nên đọc nếu mục tiêu là phát triển sự nghiệp backend Golang

### `deep-dive/`

- [README.md](./deep-dive/README.md): bản đồ của tầng kiến trúc
- [system-overview.md](./deep-dive/system-overview.md): flow HTTP, gRPC, RabbitMQ, source of truth và runtime Compose
- [frontend-architecture.md](./deep-dive/frontend-architecture.md): kiến trúc frontend hiện tại, dependency flow và lớp UI đang chạy thật
- [frontend-refactor-status.md](./deep-dive/frontend-refactor-status.md): phần đã làm, phần còn lại và checklist verify cho frontend
- [frontend-backend-alignment-modernization-guide.md](./deep-dive/frontend-backend-alignment-modernization-guide.md): đánh giá đồng bộ FE/BE, cleanup plan, roadmap UI/UX và hướng import Excel/CSV
- [api-gateway.md](./deep-dive/api-gateway.md): gateway và logic proxy
- [user-service.md](./deep-dive/user-service.md): auth, email flow, Google OAuth, phone verification, address
- [product-service.md](./deep-dive/product-service.md): catalog, media, search, gRPC
- [cart-service.md](./deep-dive/cart-service.md): Redis cart và product lookup
- [order-service.md](./deep-dive/order-service.md): order flow, event, coupon, report
- [payment-service.md](./deep-dive/payment-service.md): payment lifecycle và webhook
- [notification-service.md](./deep-dive/notification-service.md): worker consume event và gửi email

### `annotated/`

- [README.md](./annotated/README.md): lộ trình đọc source theo module
- [frontend-source-map.md](./annotated/frontend-source-map.md): bản đồ thư mục frontend, API boundary, provider flow và nơi nên mở source đầu tiên
- [frontend-app.md](./annotated/frontend-app.md): entrypoint, providers, route shell, AppLayout, ProtectedRoute
- [client-experimental.md](./annotated/client-experimental.md): nhánh Next.js experimental và cách nó liên hệ với frontend chính
- [shared-packages.md](./annotated/shared-packages.md): `pkg/` và nền tảng backend dùng chung
- [api-gateway-main.md](./annotated/api-gateway-main.md): entrypoint gateway
- Các doc service/repository/line-by-line còn lại trong `annotated/` giữ vai trò đọc sâu backend

## Điều cần nhớ khi dùng bộ docs này

- Nếu tài liệu và source mâu thuẫn, hãy tin source thật ở `cmd/main.go`, `internal/handler`, `internal/service`, `internal/repository`, `frontend/src/`, `deployments/docker/`.
- Frontend hiện ở trạng thái refactor chuyển tiếp, nhưng source of truth bây giờ là `app/`, `pages/`, `features/`, `services/`, `components/`, `styles/`. Bộ docs mới gom lại để tránh tài liệu frontend chồng chéo.
- `frontend/` là UI local chính; `client/` là nhánh Next.js experimental, có giá trị học tập nhưng chưa phải runtime mặc định.
- Không phải mọi doc cũ đều sai, nhưng các doc frontend và local runtime đã được nâng cấp mạnh để bám hơn với source hiện tại.

## Nếu muốn hiểu repo ở mức senior

Đọc theo cụm sau:

1. [learning/11-senior-source-code-review-guide.md](./learning/11-senior-source-code-review-guide.md)
2. [deep-dive/system-overview.md](./deep-dive/system-overview.md)
3. [deep-dive/frontend-architecture.md](./deep-dive/frontend-architecture.md)
4. [annotated/shared-packages.md](./annotated/shared-packages.md)
5. [annotated/frontend-source-map.md](./annotated/frontend-source-map.md)
6. [annotated/order-service.md](./annotated/order-service.md)
7. [annotated/payment-service.md](./annotated/payment-service.md)

## Nếu bạn muốn dùng repo này như một "trường học nghề"

Hãy đọc theo cụm sau:

1. [learning/03-source-reading-roadmap.md](./learning/03-source-reading-roadmap.md)
2. [learning/06-testing-and-verification.md](./learning/06-testing-and-verification.md)
3. [learning/10-guide-to-debugging.md](./learning/10-guide-to-debugging.md)
4. [learning/12-production-readiness-roadmap.md](./learning/12-production-readiness-roadmap.md)
5. [learning/13-repo-based-career-roadmap.md](./learning/13-repo-based-career-roadmap.md)
6. [learning/14-go-sql-idempotency-interview-playbook.md](./learning/14-go-sql-idempotency-interview-playbook.md)

Nhóm tài liệu này phù hợp khi mục tiêu của bạn không chỉ là sửa một task trước mắt, mà là hiểu vì sao hệ thống được tổ chức như hiện tại, biết mình cần học gì tiếp theo, và xây nền tảng để phát triển theo hướng Golang backend production.
