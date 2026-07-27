# Labs — sandbox học tập

Thư mục này chứa các **lab chạy được thật** để học công nghệ mà repo production **cố tình không
dùng**, hoặc dùng theo cách khác.

## Nguyên tắc

- Mỗi lab là **module Go độc lập**, có `go.mod` riêng, **không** nằm trong biến `MODULES` của
  `Makefile` gốc → `make ci`, `make test`, `make vet` của repo **không** đụng tới.
- Mỗi lab có **hạ tầng riêng** (docker-compose riêng, cổng riêng) → bật/tắt không ảnh hưởng
  stack production ở `deployments/docker/`.
- Lab tồn tại để **hiểu vì sao repo chọn kiến trúc hiện tại**, không phải để đề xuất thay thế nó.
  `AGENTS.md` quy định rõ: không thêm broker/DB/framework mới vào production khi thứ đang có đã đủ.

## Danh sách lab

| Lab | Học gì | Trạng thái |
|---|---|---|
| [`redis-pubsub/`](redis-pubsub/) | Redis Pub/Sub (at-most-once, mất tin) vs Redis Streams (consumer group, at-least-once); vì sao **vẫn** cần outbox | ✅ chạy được |
| `kafka/` | Log phân tán, partition, offset, replay; so sánh sòng phẳng với RabbitMQ | 🔜 chưa làm |

## Chạy nhanh

```bash
cd docs/learning/labs/redis-pubsub
make up      # bật hạ tầng riêng của lab
make pub     # thí nghiệm đầu tiên
make down    # dọn dẹp
```

Đọc `README.md` trong từng lab để biết kịch bản thí nghiệm đầy đủ.
