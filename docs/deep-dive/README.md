# Backend Deep Dive theo từng service

Bộ tài liệu này tách phần backend thành nhiều file nhỏ để người học Golang có thể đọc theo từng domain thay vì phải nuốt toàn bộ hệ thống trong một lần.

## Cách đọc khuyến nghị

1. Đọc [api-gateway.md](./api-gateway.md) để hiểu cửa vào của hệ thống.
2. Đọc [user-service.md](./user-service.md) để nắm auth, JWT, profile.
3. Đọc [product-service.md](./product-service.md) để hiểu CRUD và repository SQL.
4. Đọc [cart-service.md](./cart-service.md) để hiểu Redis và source of truth.
5. Đọc [order-service.md](./order-service.md) để hiểu business flow phức tạp nhất.
6. Đọc [payment-service.md](./payment-service.md) để hiểu authorization cho domain nhạy cảm.
7. Đọc [notification-service.md](./notification-service.md) để hiểu event-driven worker.

## Mục tiêu của bộ tài liệu

- Giúp bạn trace một request thật từ đầu tới cuối.
- Giúp bạn hiểu vai trò của từng tầng `handler -> service -> repository`.
- Giúp bạn luyện tư duy backend Golang theo hướng nghề nghiệp thực tế.
- Khi muốn đọc sâu tới cấp độ file và block code, hãy đi tiếp sang bộ [annotated](../annotated/README.md).

## Tư duy khi đọc code

Khi mở một service, hãy luôn tự hỏi 5 câu:

1. Service này chịu trách nhiệm domain gì?
2. Request đi vào ở đâu?
3. Business logic nằm ở file nào?
4. Dữ liệu được lưu hoặc lấy ở đâu?
5. Service này đang gọi hoặc bị gọi bởi service nào khác?

Nếu bạn trả lời được 5 câu này cho từng service, bạn đã đi rất đúng hướng của một Golang Back-end Developer.
