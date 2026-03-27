# AGENTS.md

## Mục đích (Purpose)

Repository này là một nền tảng thương mại điện tử hiện đang được tổ chức theo hệ thống Go microservices với frontend React + Vite và môi trường local chạy bằng Docker.

Khi bạn (AI Agent) làm việc trong repo này, hãy tối ưu hoá cho sự đơn giản, sự rõ ràng trong vận hành (operational clarity), và sự ổn định trên môi trường production. **Không được** thêm sự phức tạp chỉ vì kiến trúc hiện tại có khả năng hỗ trợ nó.

## Quy tắc cốt lõi (Core Rule)

Nếu bạn được yêu cầu đề xuất, sửa đổi, hoặc mở rộng kiến trúc hoặc công nghệ (stack), bạn phải chủ động bác bỏ/thách thức những ý tưởng mặc định hướng tới việc thêm service mới, thêm hạ tầng mới, thêm framework, và thêm nhiều thành phần chuyển động phức tạp.

Nhiệm vụ của bạn là đề xuất một stack **đơn giản nhất** nhưng vẫn đảm bảo sự ổn định (robust) cho các yêu cầu được đưa ra.

Điều đó có nghĩa là:

- Ưu tiên ít các thành phần cần deploy (deployables) hơn
- Ưu tiên ít database hơn
- Ưu tiên ít các dependency lúc runtime hơn
- Ưu tiên các công cụ có phần "nhàm chán" nhưng được hỗ trợ tốt (boring, well-supported tools)
- Ưu tiên các pattern mà team có thể vận hành với ít tải trọng nhận thức (low cognitive load)
- Ưu tiên các giải pháp dễ dàng test ở local với workflow `Makefile` và Docker hiện có

## Khuynh hướng Kiến trúc Mặc định (Default Architectural Bias)

Trừ khi yêu cầu đòi hỏi rõ ràng điều ngược lại, hãy ưu tiên:

- Cấu trúc Modular monolith thay cho việc đẻ thêm microservices
- Giao tiếp HTTP đồng bộ (synchronous) trong một khối deployable duy nhất thay cho việc phải nhảy qua mạng nội bộ (network hops)
- Dùng PostgreSQL làm nguồn dữ liệu thật sinh duy nhất (primary source of truth)
- Chỉ dùng Redis khi có nhu cầu thực tế và cụ thể về caching, session, rate-limit, hoặc queue
- Chỉ dùng RabbitMQ hoặc message bất đồng bộ (async messaging) khi có yêu cầu thực tế về tính tin cậy (reliability) hoặc cần tách rời (decoupling)
- Chỉ dùng một ứng dụng frontend thay vì thiết kế nhiều frontend
- Một chu trình (path) deploy duy nhất cho cả môi trường local và production, với độ sai lệch (drift) tối thiểu

**Không tự động đề xuất** Kubernetes, service meshes, event-driven choreography, CQRS, hoặc các hạ tầng bổ sung theo mặc định. Những thứ này phải được lý giải sự cần thiết một cách rõ ràng, tuyệt đối không được tự giả định.

## Cách Đánh giá Một Stack Được Đề xuất

Đối với bất kỳ đề xuất stack nào có ý nghĩa, hãy đánh giá các lựa chọn theo thứ tự sau:

1. Kiến trúc nào là đơn giản nhất thoả mãn được các ràng buộc về quy mô, độ tin cậy, bảo mật và nguồn lực team?
2. Có thể loại bỏ đi thành phần nào mà không làm yếu đi kết quả chung hay không?
3. Gánh nặng vận hành (operational burden) mà mỗi thành phần thêm vào sẽ tạo ra là gì?
4. Những kiểu lỗi (failure modes) nào sẽ bị tạo ra bởi thành phần bổ sung này?
5. Mục tiêu này có thể đạt được chỉ bằng việc sử dụng cái nền tảng Go + PostgreSQL + React hiện tại hay không?

Nếu bác bỏ một giải pháp hiển nhiên đơn giản hơn, hãy giải thích lý do tại sao.

## Tiêu chuẩn Đề xuất (Recommendation Standard)

Khi đi đến việc đề xuất một stack, bắt buộc phải bao gồm:

- Stack dự tính đề xuất
- Tại sao đây là lựa chọn đơn giản và ổn định nhất
- Các lựa chọn thay thế nào đã được xem xét nhưng bị bác bỏ
- Yêu cầu cụ thể nào đã biện minh cho sự xuất hiện của từng thành phần phức tạp đó
- Lộ trình di chuyển (migration path) từ repo hiện tại, trong trường hợp đề xuất của bạn khác với kiến trúc hiện thời

## Khi Nào Cần Phản Kháng (When To Push Back)

Hãy phản kháng rõ ràng khi các yêu cầu mang lại sự phức tạp mà không chứng minh được nhu cầu thực tế, đặc biệt là:

- Bóc tách thêm các service mới ra khỏi monorepo
- Thêm database mới chỉ để phục vụ một vài tính năng bị cô lập (isolated features)
- Đưa vào message broker cho những luồng (flows) có thể giải quyết dứt điểm bằng transaction (xử lý giao dịch đồng bộ)
- Thêm Kubernetes cho một team quy mô nhỏ hoặc đang ở môi trường phát triển giai đoạn đầu
- Thêm nhiều framework backend hoặc các service dùng ngôn ngữ lập trình khác nhau trộn lẫn mà không có lý do thực sự mạnh mẽ

## Hướng dẫn Nhận Thức Repo (Repo-Aware Guidance)

Repo này đã bao gồm sẵn:

- Go services
- React + Vite frontend (legacy)
- Next.js 16.2.1 frontend (new)
- Môi trường chạy local bằng Docker Compose
- PostgreSQL
- Redis
- RabbitMQ
- Prometheus, Grafana, và Jaeger

Hãy coi những món này như các ràng buộc đã có sẵn, chứ không phải là sự ủng hộ bắt buộc (mandatory endorsements) cho các thiết kế tính năng trong tương lai. Nếu được hỏi nên xây dựng cái gì tiếp theo hoặc làm thế nào để đơn giản hóa, bạn có thể đề xuất hợp nhất và gom gọn lại thành ít thành phần hơn nếu lý do đủ thuyết phục.

## Hướng dẫn Thực thi (Execution Guidance)

Khi các yêu cầu còn mơ hồ và sự mơ hồ đó có ảnh hưởng vật lý đến kiến trúc, hãy đặt các câu hỏi làm rõ thật súc tích trước khi đưa ra đề xuất stack.

Khi các yêu cầu đã đủ rõ ràng, hãy xắn tay thực hiện và đưa ra luôn lời khuyên trực tiếp. Ưu tiên những hướng dẫn mang tính quyết đoán, lập luận tốt thay vì ném cho người dùng một danh sách tùy chọn dài dằng dặc.
