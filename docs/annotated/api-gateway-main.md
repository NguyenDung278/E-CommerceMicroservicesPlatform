# Annotated: `api-gateway/cmd/main.go`

Source gốc: `api-gateway/cmd/main.go`

## 1. File này quan trọng vì sao?

Nếu bạn muốn hiểu một service Go backend được khởi động như thế nào, `main.go` là nơi đầu tiên phải đọc.

File này dạy bạn:

- cách boot một ứng dụng Go,
- cách load config,
- cách wiring dependency,
- cách gắn middleware,
- cách start server,
- cách shutdown an toàn.

Đây là tư duy nền cho hầu hết backend Go production.

## 2. Bức tranh lớn

`api-gateway` là cửa vào của toàn hệ thống. Nó không chứa business logic chính. Việc của nó là:

- nhận request từ frontend,
- áp middleware dùng chung,
- route request tới handler phù hợp,
- và proxy sang các backend service phía sau.

## 3. Annotate theo block dòng

### Dòng 1-26: package và import

Ý nghĩa:

- `package main` nói rằng đây là executable entrypoint.
- nhóm import chia rất rõ:
  - thư viện chuẩn của Go: `context`, `fmt`, `net/http`, `os`, `os/signal`, `time`
  - framework HTTP: Echo
  - logger: zap
  - package nội bộ của project: handler, proxy, config, logger, middleware

Điều nên học:

- Một file `main.go` tốt thường chỉ làm nhiệm vụ bootstrapping.
- Nếu `main.go` chứa business logic dài, đó thường là dấu hiệu code chưa sạch.

### Dòng 28-34: load config

```go
cfg, err := config.Load("api-gateway")
if err != nil {
    fmt.Fprintf(os.Stderr, "failed to load config: %v\n", err)
    os.Exit(1)
}
```

Đây là bước fail fast.

Tư duy ở đây là:

- nếu config sai thì process không nên chạy tiếp,
- vì chạy tiếp sẽ tạo lỗi ngầm còn khó debug hơn.

Điều nên học:

- Backend production thường chết sớm nếu config sai.
- "Chạy nửa sống nửa chết" là trạng thái rất nguy hiểm.

### Dòng 36-47: khởi tạo logger

```go
log := logger.New("api-gateway")
defer log.Sync()
```

Ở đây service tạo structured logger ngay từ đầu để mọi bước sau đều có log thống nhất.

Tại sao `defer log.Sync()` quan trọng?

- một số logger buffer log trong memory,
- `Sync()` giúp flush log trước khi process kết thúc.

Dòng `log.Info(...)` phía dưới in ra các dependency quan trọng như port và URL service.

Điều nên học:

- Log startup cực kỳ hữu ích khi debug môi trường.
- Structured logging tốt hơn `fmt.Println` vì dễ filter, query và đưa vào observability stack.

### Dòng 49-54: tạo proxy cho từng service

```go
userProxy := proxy.NewServiceProxy(cfg.Services.UserService, log)
productProxy := proxy.NewServiceProxy(cfg.Services.ProductService, log)
...
```

Gateway không tự xử lý user, product, cart, order, payment. Nó tạo các proxy object để forward request.

Ý nghĩa kiến trúc:

- Gateway là thin layer. Nó hoạt động như một "Reverse Proxy".
- Business logic vẫn nằm trong service chuyên trách.

**Thực tiễn (Practical insight):**
Nếu không chia Proxy như vầy, Gateway sẽ phải import và parse từng struct Request/Response của các dịch vụ con. Điều này dẫn tới Gateway biến thành một "Cục tạ" (Monolith Gateway) dễ xảy ra rủi ro mỗi lần service con đổi Model. Nhưng bằng cách Forward raw Request (copy header + body), Gateway gần như "mù" về data (Agnostic), giúp nó độc lập và ít bugs. Đặc biệt, để hệ thống hỗ trợ **Upload File (Multipart Streaming)**, Proxy phải copy cả thuộc tính `ContentLength` và func `GetBody` của Request gốc sang `backendReq` để tránh làm gián đoạn luồng stream dữ liệu nhị phân.

Điều nên học:

- Một gateway tốt nên "mỏng".
- Nếu gateway bắt đầu ôm logic business lớn, bạn sẽ có thêm một service khó vận hành.

### Dòng 56-61: tạo handler

```go
userHandler := handler.NewUserHandler(userProxy)
...
```

Đây là dependency injection thủ công.

Handler nhận dependency nó cần thông qua constructor. Cách này đơn giản, rõ ràng và rất phổ biến trong Go.

Điều nên học:

- Go thường không cần DI framework phức tạp.
- Constructor đơn giản + interface hợp lý là đủ cho rất nhiều project.

### Dòng 63-72: tạo Echo và gắn middleware

Đây là block rất giàu kiến thức:

- `echo.New()` tạo app HTTP.
- `e.HideBanner = true` chỉ là tinh chỉnh gọn output.
- `Recover()` bắt panic để process không chết ngay vì một request.
- `FrontendCORS()` kiểm soát origin frontend được phép gọi.
- `Secure()` thêm một số HTTP security headers cơ bản.
- `NewRateLimiter(...)` chặn spam request.
- `RequestLogger(log)` gắn logging cho từng request.
- `echoprometheus.NewMiddleware("api_gateway")` tạo metrics cho Prometheus.

Điều nên học:

- Middleware là một trong những khái niệm cực quan trọng của backend Go.
- Thứ tự middleware có ý nghĩa. Mỗi middleware bọc request trước khi handler thật được gọi.

### Dòng 72: route `/metrics`

```go
e.GET("/metrics", echoprometheus.NewHandler())
```

Đây là điểm kết nối với Prometheus.

Tư duy production:

- hệ thống chạy không chỉ cần "đúng",
- mà còn cần "quan sát được".

Metrics cho phép bạn thấy:

- request count,
- latency,
- error rate.

### Dòng 74-80: health check

```go
e.GET("/health", func(c echo.Context) error {
    return c.JSON(http.StatusOK, map[string]string{
        "status":  "healthy",
        "service": "api-gateway",
    })
})
```

Health endpoint cực kỳ phổ biến trong backend.

Vai trò:

- Docker/Kubernetes/proxy dùng nó để biết service còn sống không.
- Monitoring cũng thường ping endpoint này.

Điều nên học:

- Health check là "operational contract", không chỉ là route cho vui.

### Dòng 82-89: đăng ký route

```go
userHandler.RegisterRoutes(e, cfg.JWT.Secret)
...
```

File `main.go` không tự viết hết routes ở đây, mà giao cho từng handler đăng ký route của domain nó.

Tại sao cách này tốt?

- giữ `main.go` gọn,
- route của domain nào nằm gần handler domain đó,
- dễ mở rộng hơn khi số lượng route tăng.

### Dòng 91-104: start server

Thay vì `e.Start(...)` ngắn gọn, code tạo `http.Server` thủ công:

- `Addr`
- `Handler`
- `ReadTimeout`
- `WriteTimeout`
- `IdleTimeout`

Đây là dấu hiệu tốt.

Tư duy ở đây:

- backend production cần kiểm soát timeout,
- tránh request treo quá lâu,
- giảm nguy cơ resource bị giữ vô hạn.

### Dòng 106-116: graceful shutdown

```go
quit := make(chan os.Signal, 1)
signal.Notify(quit, os.Interrupt)
<-quit
...
e.Shutdown(ctx)
```

Đây là đoạn cực đáng học.

Nó cho phép process:

- Nhận tín hiệu dừng từ Hệ Điều Hành (SIGINT, SIGTERM) bằng `channel` (size 1 để tránh block signal nếu app chưa kịp đọc).
- Dừng `e.Start` ngay lập tức.
- Nhưng `e.Shutdown(ctx)` (hàm built-in của Echo) sẽ chờ các in-flight requests đang phục vụ chạy xong hoặc bị timeout (qua `context.WithTimeout(10s)`).

Điều nên học:

- Graceful shutdown là một đặc trưng rất thực tế của backend Go tốt.
- Nó cũng phối hợp hoàn hảo với Kubernetes `SIGTERM`. Kubernetes hay cho app vài giây dọn dẹp (termination grace period) trước khi gửi ngắt điện `SIGKILL`. Graceful shutdown giúp user trên web đang thanh toán không bị `502 Bad Gateway` đột ngột gây hoang mang.

## 4. Tư duy backend rút ra từ file này

- `main.go` nên là nơi wiring, không phải nơi business logic.
- Config, logger, middleware, routing, shutdown là 5 trụ cột bootstrapping cơ bản.
- Observability là một phần của kiến trúc, không phải tính năng phụ.

## 5. Câu hỏi tự kiểm tra

1. Vì sao `main.go` không nên chứa business logic?
2. Vì sao middleware lại đặt ở gateway?
3. Nếu bỏ timeout ở `http.Server`, hệ thống có thể gặp vấn đề gì?
4. `graceful shutdown` khác gì với việc tắt process ngay?
5. Vì sao route `/metrics` và `/health` rất quan trọng trong production?
