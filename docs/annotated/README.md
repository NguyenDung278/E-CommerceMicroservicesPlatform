# Backend Annotated Reading

Đây là bộ tài liệu "mentor annotate" cho những file backend quan trọng nhất trong project.

Mục tiêu của bộ này không phải là tóm tắt source code. Mục tiêu là:

- giúp bạn đọc file lớn mà không bị ngợp,
- chỉ ra line nào là trọng tâm,
- giải thích vì sao đoạn code được viết theo cách đó,
- và biến việc đọc source thành một quá trình học Golang backend có phương pháp.

## Cách đọc khuyến nghị

1. Mở file markdown annotate tương ứng.
2. Mở source code thật song song.
3. Đọc theo từng block line number.
4. Sau mỗi block, dừng lại và tự trả lời:
   - đoạn này đang giải quyết bài toán gì?
   - nếu bỏ đoạn này đi thì hệ thống hỏng ở đâu?
   - đoạn này thuộc layer nào: middleware, handler, service, repository, infra?
5. Sau khi đọc xong, thử tự giải thích lại file đó bằng lời của chính bạn.

## Thứ tự đọc nên bắt đầu

1. [api-gateway-main.md](./api-gateway-main.md)
2. [auth-go.md](./auth-go.md)
3. [user-service.md](./user-service.md)
4. [order-service.md](./order-service.md)
5. [payment-service.md](./payment-service.md)

## Bộ file hiện có

- [api-gateway-main.md](./api-gateway-main.md)
- [auth-go.md](./auth-go.md)
- [user-service.md](./user-service.md)
- [order-service.md](./order-service.md)
- [payment-service.md](./payment-service.md)
- [order-repository.md](./order-repository.md)
- [payment-repository.md](./payment-repository.md)

## Bộ line-by-line sâu hơn

Nếu bạn muốn học sát từng cụm dòng quan trọng, đọc tiếp bộ này sau khi đã xem bản annotate thường:

- [line-by-line-auth-go.md](./line-by-line-auth-go.md)
- [line-by-line-order-service.md](./line-by-line-order-service.md)
- [line-by-line-payment-service.md](./line-by-line-payment-service.md)

## Thứ tự đọc persistence mình khuyên

Sau khi đọc:

- [line-by-line-order-service.md](./line-by-line-order-service.md)

hãy đọc tiếp:

- [order-repository.md](./order-repository.md)

Sau khi đọc:

- [line-by-line-payment-service.md](./line-by-line-payment-service.md)

hãy đọc tiếp:

- [payment-repository.md](./payment-repository.md)

## Cách dùng bộ annotate để học giỏi hơn

Nếu bạn muốn học thật sâu, hãy lặp chu kỳ này:

1. Đọc annotate file.
2. Đọc line-by-line file tương ứng nếu file đó là lõi của hệ thống.
3. Đọc source thật.
4. Tự vẽ lại flow bằng text hoặc Mermaid.
5. Tự viết pseudo-code cho file đó.
6. Trả lời các câu hỏi "vì sao" trong đầu.
7. Tự sửa nhỏ hoặc viết lại một phần tương tự.

Đây là cách rất tốt để tăng khả năng đọc source và dần tiến tới khả năng tự thiết kế backend bằng Go.
