# Learning Guide

File này gom toàn bộ phần learning cũ thành một guide duy nhất để dùng repo như một “sân tập” backend Golang: biết đọc source, hiểu lý do thiết kế, thấy pitfall thực tế, và biết nên cải tiến chỗ nào tiếp theo.

## Lộ trình 90 phút để hiểu repo

1. Đọc `README.md` để nắm runtime local, vai trò `client/` và `frontend/`.
2. Đọc `docs/deep-dive/README.md` để thấy boundary giữa gateway, service, DB, queue.
3. Mở `pkg/config/`, `pkg/middleware/`, `pkg/observability/` để hiểu cross-cutting concern trước.
4. Đọc `services/user-service/internal/service/user_auth.go` và `oauth_service.go` để thấy một service Go được tổ chức sạch.
5. Đọc `services/product-service/internal/service/product_review_service.go` để thấy pattern transaction, observer, factory.
6. Đọc `services/order-service/internal/service/order_pricing.go` và `order_lifecycle.go`, rồi nối sang `services/payment-service/internal/service/payment_processing.go`.
7. Kết thúc bằng caller ở `client/src/lib/api/` hoặc `frontend/src/services/api/` để ghép full flow từ UI đến backend.

## Những nguyên lý và best practice đáng học

| Nguyên lý | Vị trí nên đọc | Điều nên rút ra |
| --- | --- | --- |
| Boundary rõ giữa handler, service, repository | Toàn bộ `services/*/internal/` | Handler parse và map lỗi; service giữ nghiệp vụ; repository giữ SQL và transaction. |
| `context.Context` là tham số đầu tiên cho I/O | Hầu hết service/repository method | Hủy request, timeout, trace propagation phải đi cùng nhau. |
| Wrap lỗi bằng `%w`, map lỗi theo tầng | `services/*/internal/service/`, `internal/repository/` | Lỗi DB không leak thẳng ra API; handler chỉ trả lỗi an toàn. |
| Idempotency cho write flow quan trọng | `services/order-service/internal/repository/order_repository.go`, `services/payment-service/internal/repository/payment_repository.go` | POST bị retry vẫn phải cho cùng kết quả hoặc từ chối an toàn. |
| Transactional outbox thay vì publish “tay” sau commit | `services/order-service/internal/service/order_events.go`, `services/payment-service/internal/service/payment_events.go` | Tránh DB commit thành công nhưng RabbitMQ publish thất bại. |
| Graceful degradation cho dependency phụ | `services/product-service/internal/service/product_service.go`, `services/notification-service/cmd/main.go` | Search, media, Redis phụ có thể lỗi; core flow vẫn phải chạy có chủ đích. |
| Cursor pagination cho dữ liệu tăng nhanh | `services/order-service/internal/repository/order_repository.go::ListAllByCursor` | Tránh scan sâu và `COUNT(*)` trên admin list nóng. |
| Structured logging và tracing | `pkg/logger/`, `pkg/observability/`, các service main | Muốn debug production thì phải log có field và trace qua boundary. |

## Mẫu code rút gọn đáng học từ style của repo

Đây là mẫu rút gọn theo style đang dùng trong source, không phải copy nguyên văn.

```go
func (s *OrderService) CreateOrder(ctx context.Context, userID, email, idemKey string, req dto.CreateOrderRequest) (*model.Order, error) {
    quote, err := s.quoteOrder(ctx, req)
    if err != nil {
        return nil, fmt.Errorf("quote order: %w", err)
    }

    order := buildOrderFromQuote(userID, email, quote)
    if err := s.repo.CreateWithIdempotency(ctx, order, buildOutbox(order), buildRecord(idemKey, req)); err != nil {
        return nil, fmt.Errorf("persist order: %w", err)
    }

    return order, nil
}
```

Điểm đáng học: validate sớm, giữ `ctx`, wrap lỗi có ngữ cảnh, ghi DB và outbox cùng một boundary.

```go
func NewProductService(repo ProductRepository, opts ...ProductServiceOption) *ProductService {
    svc := &ProductService{repo: repo, tracer: otel.Tracer("product-service")}
    for _, opt := range opts {
        opt(svc)
    }
    return svc
}
```

Điểm đáng học: functional options giúp dependency optional mà vẫn giữ constructor rõ.

```go
func JWTAuth(secret string) echo.MiddlewareFunc {
    return func(next echo.HandlerFunc) echo.HandlerFunc {
        return func(c echo.Context) error {
            // parse, kiểm tra signing method, gắn claims vào context
            return next(c)
        }
    }
}
```

Điểm đáng học: auth cross-cutting nên để ở middleware chung, không lặp lại trong từng handler.

## Checklist khi đọc hoặc sửa source

- Xác định request đi vào từ route nào, handler nào.
- Tìm service method giữ business rule thật.
- Tìm repository nào đang quyết định transaction, lock, pagination, idempotency.
- So caller ở `client/` hoặc `frontend/` để biết contract nào đang dùng thật.
- Kiểm tra log, trace, timeout, authz trước khi kết luận flow đã “xong”.

## Pitfall thực tế đã thấy trong source hiện tại

| Vấn đề | Nguyên nhân | Chỗ nên soi |
| --- | --- | --- |
| `UpdateItem` của cart không hỏi lại product domain | Hàm chỉ sửa quantity trên snapshot đang có trong Redis, không re-check stock hoặc price | `services/cart-service/internal/service/cart_mutations.go::UpdateItem` |
| Invariant “chỉ một default address” chưa được bọc transaction | `ClearDefault` và `Create/Update` đang là nhiều call rời | `services/user-service/internal/service/address_service.go::{CreateAddress,UpdateAddress,SetDefault}` |
| Admin orders vẫn có nhánh `COUNT(*) + OFFSET/LIMIT` | Handler chỉ dùng cursor nếu query có `cursor` | `services/order-service/internal/handler/order_handler.go::ListAdminOrders`, `services/order-service/internal/repository/order_repository.go::ListAll` |
| Review listing vẫn theo `page/limit/offset` | Query đã normalize offset, chưa chuyển sang cursor | `services/product-service/internal/service/product_review_service.go::ListReviews`, `internal/repository/product_review_repository.go` |
| Notification degrade khi Redis chết làm mất duplicate protection | Service vẫn chạy nhưng inbox/history và dedupe bị vô hiệu | `services/notification-service/cmd/main.go` |
| Gateway forward header khá rộng | Proxy clone request headers trước khi gửi backend, cần cẩn trọng với header tin cậy nội bộ | `api-gateway/internal/proxy/service_proxy_request.go` |

## Đề xuất phát triển tiếp theo

### 1. Re-check stock và giá khi `UpdateItem`

- Lý do: tránh cart giữ snapshot cũ quá lâu rồi checkout lệch kỳ vọng.
- Tập trung sửa: `services/cart-service/internal/service/cart_mutations.go`, client gRPC product lookup liên quan.

### 2. Bọc default-address flow vào transaction coordinator

- Lý do: `ClearDefault` rồi `Create/Update` đang có cửa sổ inconsistency.
- Tập trung sửa: `services/user-service/internal/service/address_service.go`, `services/user-service/internal/repository/`, tận dụng hướng `ProfileTxManager` đã có trong `user_service.go`.

### 3. Đẩy cursor pagination thành mặc định cho admin orders và review list lớn

- Lý do: giảm chi phí `COUNT(*)`, scan sâu, và response chậm khi dữ liệu tăng.
- Tập trung sửa: `services/order-service/internal/handler/order_handler.go`, `services/order-service/internal/repository/order_repository.go`, `services/product-service/internal/service/product_review_service.go`.

### 4. Tăng độ cứng cho notification reliability khi Redis không sẵn sàng

- Lý do: hiện service degrade được nhưng mất duplicate protection và audit depth.
- Tập trung sửa: `services/notification-service/cmd/main.go`, `services/notification-service/internal/inbox/`, metric/log cảnh báo liên quan.

### 5. Mở rộng benchmark và test cho hot path

- Lý do: repo đã có benchmark đầu tiên ở review service; nên mở rộng sang order quote, payment processing, cart mutation trước khi tối ưu cảm tính.
- Tập trung sửa: `services/order-service/internal/service/*_test.go`, `services/payment-service/internal/service/*_test.go`, `services/cart-service/internal/service/*_test.go`.

## Chính sách tài liệu mới

- Chỉ giữ ba file tổng hợp: `docs/learning/README.md`, `docs/deep-dive/README.md`, `docs/annotated/README.md`.
- Nếu thay flow hoặc path thật trong source, cập nhật một trong ba file này ngay trong cùng thay đổi.
- Nếu docs và code lệch nhau, tin `cmd/main.go`, `internal/handler`, `internal/service`, `internal/repository`, `deployments/docker/`.
