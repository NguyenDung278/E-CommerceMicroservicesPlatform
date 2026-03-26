# 04. Bộ Prompt Học Tập (Active Learning Prompts)

Tài liệu này cung cấp bộ "Prompt" để biến AI (ChatGPT, Claude, Gemini, v.v.) thành một **Mentor (Người hướng dẫn) thực thụ**, giúp bạn đào sâu source code dự án E-Commerce Platform và thăng tiến trong sự nghiệp Backend Golang.

Học thụ động bằng cách đọc lướt sẽ rất nhanh quên. Hãy dùng các prompt này để "ép" AI kiểm tra bạn, hoặc giảng giải source code theo tiêu chuẩn của một Senior.

---

## 🚀 Bước 1: Khởi tạo "Mentor Persona" cho AI (Rất Quan Trọng)

Trước khi gửi bất kỳ câu hỏi nào về source code dự án, hãy mở một luồng chat mới với AI và dán đoạn **System Prompt** dưới đây. Nó sẽ giúp AI định hình phong cách trả lời chuyên nghiệp, tập trung vào xây dựng kỹ năng nghề nghiệp cho bạn:

```text
You are an expert Go (Golang) developer and technical mentor. Your task is to analyze Go source code and system architecture to provide comprehensive educational guidance, helping advance my Go programming career.

When answering my questions or analyzing the provided Go source code, please:

1. **Code Analysis & Explanation:**
   - Break down the code structure and explain each major component.
   - Identify and explain key Go concepts, patterns, and idioms used.
   - Highlight any advanced Go features or best practices demonstrated.
   - Point out potential improvements or alternative approaches.

2. **Educational Insights:**
   - Explain the business logic and purpose of the code.
   - Identify learning opportunities and key takeaways.
   - Connect the code examples to real-world Go development scenarios.

3. **Career Development Guidance:**
   - Assess the complexity level and suggest what skill level this represents.
   - Recommend next steps for skill progression based on the code.
   - Identify industry-relevant patterns or practices shown.

4. **Practical Recommendations:**
   - Provide specific suggestions for improving or extending the code.
   - Recommend relevant Go tools, libraries, or frameworks to explore.
   - Suggest hands-on exercises or projects to reinforce learning.

Please provide your analysis in Vietnamese, using clear explanations suitable for someone looking to advance their Go programming career. Include code snippets with explanations where helpful.
```

---

## 🚀 Bước 2: Bộ Prompt Chuyên Sâu (Sử dụng sau Bước 1)

Sau khi AI đã nhận vai trò Mentor, bạn hãy lần lượt dùng các prompt dưới đây. Lưu ý: **Với các prompt liên quan đến file code, hãy copy nội dung file code đó dán kèm vào cùng với prompt**.

### Phần 1: Phân tích Kiến trúc & Foundation
**Prompt 1 (Tổng quan Hệ thống):**
> "Hãy giải thích kiến trúc backend của project này như đang dạy cho một lập trình viên Go mới vào team. Dựa trên mô hình Microservices, hãy mô tả vai trò của api-gateway, user-service, product-service, cart-service, order-service, payment-service, notification-service và cách chúng giao tiếp (Sync vs Async)."

**Prompt 2 (Go Foundations):**
> "Dùng project này làm ví dụ để giải thích cho tôi các khái niệm Backend Go thực chiến: context propagation, database transaction, dependency injection qua constructor pattern, error wrapping, và HTTP middleware. Hãy cung cấp code snippet minh hoạ."

### Phần 2: Đọc hiểu Service Code (Line-by-Line)
*(Lưu ý: Bạn cần dán source code tương ứng vào cùng prompt dưới đây)*

**Prompt 3 (Auth & Middleware):**
> "Dưới đây là nội dung file `pkg/middleware/auth.go`. Hãy giải thích line-by-line cách JWT chặn request không hợp lệ. Chỉ rõ nguyên tắc bảo mật backend nào đang được áp dụng."

**Prompt 4 (Cart & Caching):**
> "Dưới đây là một phần mã nguồn của `cart-service`. Hãy deep dive cách nó tương tác với Redis. Trọng tâm của tôi là hiểu tại sao backend không nên tin tưởng giá trị `price` gửi lên từ frontend và cách gRPC gọi sang Product Service."

**Prompt 5 (Transaction & Orchestration):**
> "Dưới đây là hàm CreateOrder trong `order-service`. Hãy giải thích chi tiết: Đâu là validation, đâu là orchestration (gọi gRPC), đâu là persistence (ghi DB), và đâu là event publishing (RabbitMQ). Đánh giá mức độ phức tạp của luồng này."

**Prompt 6 (Message Broker Worker):**
> "Dưới đây là Worker tiêu thụ message của `notification-service`. Hãy giải thích mô hình Exchange, Queue, Routing key, khái niệm Ack/Nack, và phong cách viết thư viện Consumer bằng Go."

### Phần 3: Truy vết Flow End-to-End (System Trace)
**Prompt 7 (Checkout Flow):**
> "Hãy trace luồng thanh toán Checkout end-to-end trong một hệ thống Microservices chuẩn. Bắt đầu từ lúc User ấn 'Thanh toán'. Chỉ rõ nơi nào kiểm tra tồn kho (stock), nơi mở DB transaction, khái niệm Trust Boundary và khi nào thì phát sự kiện `payment.completed`."

**Prompt 8 (Refactoring & System Design):**
> "Nếu tôi muốn chuyển project Microservices này thành một Modular Monolith để giảm thiểu chi phí Server, tôi nên gom các module lại như thế nào? Chỗ nào nên giữ chung DB, chỗ nào phải gộp lại? Dựa trên tư duy thiết kế hệ thống, hãy đề xuất 1 phương án."

### Phần 4: Luyện Tập & Thực Hành (Pair Programming)
**Prompt 9 (Thử thách viết code):**
> "Tôi muốn thực hành code thêm tính năng 'Huỷ Đơn Hàng' (Order Cancellation) cho project này. Hãy đóng vai Mentor: Đưa ra yêu cầu cụ thể, gợi ý mình cần sửa những file `proto`, `repository`, `service` nào, nhưng dắt tôi đi từng bước một chứ đừng đưa ra code ngay."

**Prompt 10 (Review Code):**
> "Tôi vừa viết thử một đoạn code Go cho tính năng ABCD của dự án. Hãy review code của tôi dưới góc độ của một Senior Go Developer. Tập trung bắt lỗi: Bug tiềm ẩn, lỗ hổng bảo mật, vi phạm kiến trúc (Clean Architecture), và tính Go Idiomatic (viết Go sao cho 'chuẩn' Go)."

## 💡 Lời khuyên
Để lên trình độ Mid/Senior Backend Go, đừng để AI viết code thay bạn. Hãy yêu cầu AI **review**, **đặt câu hỏi ngược lại**, và **bóc tách (breakdown) kiến trúc** như các prompt ở phần 4. Chúc bạn mau chóng giỏi Go!
