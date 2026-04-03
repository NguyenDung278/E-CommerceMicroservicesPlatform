# Deep Dive

Thư mục `deep-dive/` dành cho việc hiểu repo ở mức kiến trúc và runtime. Đây là tầng nên đọc trước khi đi vào annotate hay sửa code, vì nó giúp bạn trả lời:

- service nào sở hữu domain nào
- UI nào là đường chạy chính và UI nào đang experimental
- dữ liệu nào là source of truth, dữ liệu nào chỉ là cache/tích hợp phụ trợ
- request, gRPC call và event đang chạy qua những boundary nào

## Nên đọc theo thứ tự này

1. [system-overview.md](./system-overview.md)
2. [frontend-architecture.md](./frontend-architecture.md)
3. [frontend-backend-alignment-modernization-guide.md](./frontend-backend-alignment-modernization-guide.md)
4. [technology-stack.md](./technology-stack.md)
5. [api-gateway.md](./api-gateway.md)
6. [user-service.md](./user-service.md)
7. [product-service.md](./product-service.md)
8. [cart-service.md](./cart-service.md)
9. [order-service.md](./order-service.md)
10. [payment-service.md](./payment-service.md)
11. [notification-service.md](./notification-service.md)

## Mục tiêu của tầng tài liệu này

- hiểu bức tranh runtime trước khi mở IDE đọc code
- nắm rõ ranh giới giữa frontend, gateway, service và hạ tầng
- nhìn thấy trade-off kiến trúc đang dùng thật trong repo
- phân biệt chỗ nào là feature hoàn chỉnh, chỗ nào là optional integration, chỗ nào là trạng thái chuyển tiếp sau refactor

## Cách đọc hiệu quả

Mỗi khi mở một doc trong `deep-dive/`, hãy tự trả lời:

1. Input nào đi vào module này
2. Module này phụ thuộc vào ai
3. Dữ liệu thật nằm ở đâu
4. Side effect hoặc tín hiệu nào được phát ra
5. Nếu module này lỗi, toàn hệ thống degrade như thế nào

Nếu bạn trả lời được năm câu này, việc đọc source bên dưới sẽ nhanh và chắc hơn nhiều.
