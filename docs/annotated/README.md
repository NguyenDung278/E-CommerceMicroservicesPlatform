# Annotated Source Reading

Thư mục `annotated/` dành cho việc đọc source code có hướng dẫn. Trọng tâm của tầng này là:

- chỉ ra module nào giữ trách nhiệm gì
- giải thích vì sao cách tổ chức hiện tại có ích cho readability và maintainability
- mô tả luồng dữ liệu theo từng file quan trọng
- ghi rõ trade-off hoặc nợ refactor nếu source hiện tại đang ở trạng thái chuyển tiếp

## Cách đọc hiệu quả

1. Mở doc annotate tương ứng.
2. Mở source thật song song trong IDE.
3. Đọc theo luồng `input -> xử lý -> side effect -> output`.
4. Tự trace dependency: route/page -> provider/hook -> api -> gateway/service hoặc handler -> service -> repository.
5. Nếu cần bức tranh kiến trúc trước, đọc [../deep-dive/README.md](../deep-dive/README.md) trước khi xuống từng file.

## Thứ tự đọc khuyến nghị

### Nếu bạn muốn hiểu frontend hiện tại

1. [frontend-source-map.md](./frontend-source-map.md)
2. [frontend-app.md](./frontend-app.md)
3. [frontend-auth-cart-providers.md](./frontend-auth-cart-providers.md)
4. [frontend-api-layer.md](./frontend-api-layer.md)
5. [frontend-routes-and-flows.md](./frontend-routes-and-flows.md)
6. [client-experimental.md](./client-experimental.md)

### Nếu bạn muốn hiểu backend Go

1. [shared-packages.md](./shared-packages.md)
2. [api-gateway-main.md](./api-gateway-main.md)
3. [auth-go.md](./auth-go.md)
4. [user-service.md](./user-service.md)
5. [product-service.md](./product-service.md)
6. [cart-service.md](./cart-service.md)
7. [order-service.md](./order-service.md)
8. [payment-service.md](./payment-service.md)
9. [notification-service.md](./notification-service.md)

## Bộ annotate theo module

### Frontend

- [frontend-source-map.md](./frontend-source-map.md)
- [frontend-app.md](./frontend-app.md)
- [frontend-auth-cart-providers.md](./frontend-auth-cart-providers.md)
- [frontend-api-layer.md](./frontend-api-layer.md)
- [frontend-routes-and-flows.md](./frontend-routes-and-flows.md)
- [client-experimental.md](./client-experimental.md)

### Backend và shared packages

- [shared-packages.md](./shared-packages.md)
- [api-gateway-main.md](./api-gateway-main.md)
- [auth-go.md](./auth-go.md)
- [user-service.md](./user-service.md)
- [product-service.md](./product-service.md)
- [cart-service.md](./cart-service.md)
- [order-service.md](./order-service.md)
- [payment-service.md](./payment-service.md)
- [notification-service.md](./notification-service.md)
- [order-repository.md](./order-repository.md)
- [payment-repository.md](./payment-repository.md)

## File line-by-line backend sâu hơn

- [line-by-line-auth-go.md](./line-by-line-auth-go.md)
- [line-by-line-order-service.md](./line-by-line-order-service.md)
- [line-by-line-payment-service.md](./line-by-line-payment-service.md)

## Khi nào nên đọc annotate nào

- Sửa router, provider tree hoặc layout của React app: đọc `frontend-app.md`
- Sửa auth bootstrap, token, OAuth, session nhớ đăng nhập: đọc `frontend-auth-cart-providers.md`
- Sửa guest cart, cart merge hoặc local storage flow: đọc `frontend-auth-cart-providers.md` và `cart-service.md`
- Sửa API module, normalizer, type hoặc mapping lỗi: đọc `frontend-api-layer.md`
- Sửa page/storefront/account/admin: đọc `frontend-routes-and-flows.md`
- Sửa gateway hoặc wiring service: đọc `api-gateway-main.md`
- Sửa auth, role, JWT, verify/reset password: bắt đầu từ `shared-packages.md`, `auth-go.md`, `user-service.md`
- Sửa order/payment: đọc `order-service.md`, `payment-service.md`, `notification-service.md`

## Điều cần ghi nhớ

- Bộ docs frontend mới không che đi refactor dở dang. Nếu route vẫn import `../hooks` hay `../lib/api`, hãy tra `frontend-source-map.md` để biết implementation thực nằm ở đâu trong `features/` và `shared/`.
- Annotated docs không thay thế source thật. Chúng giúp bạn đặt câu hỏi đúng và đọc đúng layer.
- Mỗi khi gặp một file dài, đừng cố nhớ từng dòng; hãy nhớ boundary, dependency và side effect của file đó.
