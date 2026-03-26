# Project Documentation Map

Chào mừng bạn đến với tài liệu kỹ thuật của dự án E-Commerce Platform. Thư mục `docs/` được tổ chức cực kỳ cẩn thận để phục vụ những nhu cầu từ **học hỏi nguyên lý cơ bản**, **đọc hiểu source code**, cho đến **tự tay phát triển tính năng mới**.

Cấu trúc gồm ba phần chính:
- `learning/`: Onboarding, setup, tutorial, học cách tự build tính năng và kỹ năng debug.
- `deep-dive/`: Hiểu kiến trúc, runtime flow, công nghệ lõi và thiết kế database.
- `annotated/`: Đọc source code theo từng block quan trọng (giải thích từng dòng code).

---

## 🗺️ Lộ trình dành cho Developer Mới

Nếu bạn vừa clone repository này về, hãy đi theo đúng thứ tự sau để không bị ngợp:

1. **Khởi động**: Bắt đầu ở [learning/00-local-setup.md](./learning/00-local-setup.md) để biết cách chạy project.
2. **Kiến trúc**: Đọc [deep-dive/system-overview.md](./deep-dive/system-overview.md) để nhìn thấy bức tranh tổng thể (Microservices, gRPC, RabbitMQ).
3. **Thử nghiệm**: Xem [learning/05-first-contribution-walkthrough.md](./learning/05-first-contribution-walkthrough.md) để biết cách đóng góp cơ bản.
4. **Đọc hiểu Code**: Chuyển sang [annotated/README.md](./annotated/README.md) để bắt đầu đọc code có hướng dẫn chi tiết. Đừng lướt qua [annotated/shared-packages.md](./annotated/shared-packages.md).
5. **Thực hành Code**: Hãy thử sức với [learning/09-how-to-add-new-feature.md](./learning/09-how-to-add-new-feature.md) để tự tay viết 1 API xuyên suốt hệ thống.
6. **Gỡ lỗi**: Đọc [learning/10-guide-to-debugging.md](./learning/10-guide-to-debugging.md) để biết cách xem log và trace lỗi 500.

---

## 📚 Mục lục Chi tiết

### 1. Thư mục `learning/` (Học tập & Thực hành)
Nơi lý tưởng để bắt đầu.
- [00-local-setup.md](./learning/00-local-setup.md): Hướng dẫn setup và chạy Docker.
- [01-go-backend-foundations.md](./learning/01-go-backend-foundations.md): Nền tảng Go.
- [02-project-technologies-explained.md](./learning/02-project-technologies-explained.md): Giải thích các công nghệ dùng trong dự án.
- [05-first-contribution-walkthrough.md](./learning/05-first-contribution-walkthrough.md): Tutorial commit đầu tiên.
- [08-career-path-golang-backend.md](./learning/08-career-path-golang-backend.md): **Lộ trình phát triển sự nghiệp Backend Golang (Rất hay).**
- [09-how-to-add-new-feature.md](./learning/09-how-to-add-new-feature.md): **[MỚI]** Hướng dẫn thêm API mới (Flow chi tiết).
- [10-guide-to-debugging.md](./learning/10-guide-to-debugging.md): **[MỚI]** Kỹ năng Debug và đọc log.

### 2. Thư mục `deep-dive/` (Kiến trúc & Hệ thống)
Dành cho khi bạn cần hiểu cách hệ thống giao tiếp.
- [system-overview.md](./deep-dive/system-overview.md): Luồng request, event, dependency runtime.
- [technology-stack.md](./deep-dive/technology-stack.md): Phân tích công nghệ.
- [database-schema.md](./deep-dive/database-schema.md): Tổng quan kiến trúc Database-per-service và schema.
- [shared-libraries.md](./deep-dive/shared-libraries.md): Phân tích tập thư viện dùng chung `pkg/`.
- Phân tích Domain: `api-gateway.md`, `user-service.md`, `product-service.md`, `order-service.md`, `payment-service.md`, v.v.

### 3. Thư mục `annotated/` (Đọc Source Code)
Cầm tay chỉ việc đọc code.
- [README.md](./annotated/README.md): Hướng dẫn đọc phân hoá.
- [shared-packages.md](./annotated/shared-packages.md): Lõi của hệ thống (Auth, config, database).
- [frontend-app.md](./annotated/frontend-app.md): Đọc code Frontend React + Vite.
- Các file giải thích logic phức tạp: `line-by-line-order-service.md`, `auth-go.md`...

---
*Chúc bạn có hành trình khám phá source code và học tập thú vị cùng dự án E-Commerce này!*
