# Lab — Redis Pub/Sub vs Redis Streams

> **Sandbox học tập.** Lab này **không** thuộc kiến trúc production: nó có module Go riêng, Redis
> riêng ở cổng 6380, không nằm trong biến `MODULES` của `Makefile` gốc nên `make ci` không đụng
> tới. Bật/tắt lab không ảnh hưởng gì tới 6 service thật.
>
> **Vì sao tách ra?** `AGENTS.md` của repo quy định: *"Phản kháng đề xuất tách thêm service, thêm
> DB/broker/framework mới khi PostgreSQL + những gì repo đang có đã đủ."* Repo đã có RabbitMQ +
> outbox/inbox làm nền tin cậy. Thêm một cơ chế messaging nữa vào production sẽ **làm yếu** kiến
> trúc chứ không mạnh lên. Nên ta học ở sandbox, và **dùng chính lab để hiểu vì sao repo chọn như
> vậy**.

---

## 1. Câu hỏi lab này trả lời

> *"Redis có Pub/Sub sẵn rồi, nhẹ hơn RabbitMQ nhiều. Sao repo không dùng nó để gửi email xác
> nhận đơn hàng cho gọn?"*

Câu trả lời không nằm ở lý thuyết — bạn sẽ **tự tay chứng minh** bằng 3 thí nghiệm.

---

## 2. Chuẩn bị

```bash
cd docs/learning/labs/redis-pubsub
make up          # bật Redis riêng ở cổng 6380
```

Kiểm tra:

```bash
docker ps | grep ecommerce-redis-lab
```

> 💡 **Mẹo:** dùng `make build` rồi chạy `./redis-pubsub <lệnh>` thay vì `go run .` nếu bạn muốn
> Ctrl+C thoát dứt khoát — `go run` không phải lúc nào cũng chuyển tiếp tín hiệu cho tiến trình con.

---

## 3. Thí nghiệm 1 — Pub/Sub mất tin khi không ai nghe

**Chạy publisher khi KHÔNG mở subscriber nào:**

```bash
make pub
```

Kết quả thật:

```
PUB → kênh "lab:events", 3 thông điệp

  order-1 @ 14:11:57.994             → 0 subscriber ✗ THÔNG ĐIỆP ĐÃ MẤT VĨNH VIỄN
  order-2 @ 14:11:58.298             → 0 subscriber ✗ THÔNG ĐIỆP ĐÃ MẤT VĨNH VIỄN
  order-3 @ 14:11:58.603             → 0 subscriber ✗ THÔNG ĐIỆP ĐÃ MẤT VĨNH VIỄN
```

🎯 **Điểm mấu chốt:** lệnh `PUBLISH` của Redis trả về **số subscriber đã nhận**. Số đó bằng `0`
nghĩa là thông điệp vừa gửi **không đi đâu cả** — không hàng đợi, không lưu trữ, không cách nào
lấy lại. Redis **không báo lỗi**: với nó, "gửi cho 0 người" vẫn là thành công.

📖 **Ví von:** Pub/Sub là **đài phát thanh**. Đài cứ phát; ai không bật radio đúng lúc đó thì mất
chương trình vĩnh viễn. Đài không lưu lại, không phát lại, và không biết ai đã nghe.

---

## 4. Thí nghiệm 2 — Pub/Sub chỉ giao cho người đang nghe

**Terminal A** (mở trước):

```bash
make sub
```

**Terminal B:**

```bash
make pub
```

Terminal A nhận đủ 3 tin, và Terminal B giờ báo `→ 1 subscriber nhận được`.

**Bây giờ tắt Terminal A (Ctrl+C) rồi chạy lại `make pub`** → quay lại tình trạng mất tin của thí
nghiệm 1. Mở lại subscriber cũng **không** lấy lại được những tin đã lỡ.

🎯 Đây gọi là **at-most-once delivery**: mỗi tin được giao **tối đa một lần**, có thể là **không
lần nào**. Không có retry, không có ack, không có lịch sử.

---

## 5. Thí nghiệm 3 — Streams thì khác hẳn

Redis còn một kiểu dữ liệu khác: **Stream** (`XADD`/`XREADGROUP`). Nó là một **nhật ký được lưu
lại** (append-only log) — chính là mô hình của Kafka.

**Ghi tin khi KHÔNG có consumer nào:**

```bash
make xadd
```

```
XADD → stream "lab:stream", 3 thông điệp

  order-1   → id=1785136332554-0  ✓ ĐÃ LƯU (không cần ai đang nghe)
  order-2   → id=1785136332760-0  ✓ ĐÃ LƯU (không cần ai đang nghe)
  order-3   → id=1785136332963-0  ✓ ĐÃ LƯU (không cần ai đang nghe)
```

**Giờ mới bật consumer:**

```bash
make xread
```

```
XREADGROUP ← stream="lab:stream" group="g1" consumer="c1"

  RECV id=1785136332554-0 body=order-1
  RECV id=1785136332760-0 body=order-2
  RECV id=1785136332963-0 body=order-3
```

🎯 **Consumer chạy SAU vẫn đọc được đủ 3 tin.** Đó là khác biệt căn bản: Pub/Sub **truyền đi**,
Stream **lưu lại**.

### 5.1. Consumer group độc lập nhau

Chạy với group khác:

```bash
make xread G=g2
```

→ Group `g2` nhận lại **toàn bộ 3 tin từ đầu**, dù group `g1` đã xử lý xong. Mỗi consumer group
có con trỏ đọc riêng.

📖 Đây chính là mô hình Kafka: nhiều hệ thống hạ nguồn (gửi email, cập nhật analytics, đồng bộ
kho) mỗi cái một consumer group, cùng đọc một luồng sự kiện mà không giẫm chân nhau.

### 5.2. Nhiều consumer trong CÙNG group thì chia việc

Mở 2 terminal:

```bash
make xread G=g3 C=c1     # terminal A
make xread G=g3 C=c2     # terminal B
```

Rồi `make xadd N=10` → 10 tin được **chia nhau** giữa c1 và c2, không ai xử lý trùng.

📖 Đây là **cùng một ý tưởng** với `FOR UPDATE SKIP LOCKED` mà outbox relay worker của repo dùng
(buổi 6): nhiều bản sao worker cùng chạy, mỗi tin chỉ một worker lấy.

### 5.3. ACK và at-least-once

Trong `main.go`, sau khi xử lý xong mỗi tin ta gọi `XAck`. Chưa ACK thì tin nằm trong danh sách
**pending** và có thể được giao lại cho consumer khác nếu consumer hiện tại chết.

🎯 Đó là **at-least-once delivery**: tin **ít nhất một lần**, có thể **nhiều hơn một lần** → nên
consumer **bắt buộc phải idempotent**. Đây đúng là lý do `notification-service` trong repo cần
inbox + Redis dedupe (buổi 5–6).

---

## 6. Bảng so sánh — và vì sao repo chọn RabbitMQ + outbox

| Tiêu chí | Redis Pub/Sub | Redis Streams | RabbitMQ + outbox (repo) |
|---|---|---|---|
| Lưu tin lại | ❌ không | ✅ có | ✅ có (cả trong PostgreSQL) |
| Consumer offline | ❌ **mất vĩnh viễn** | ✅ đọc lại được | ✅ đọc lại được |
| Delivery guarantee | at-most-once | at-least-once | at-least-once |
| ACK / retry | ❌ không | ✅ có | ✅ có + DLQ |
| Đọc lại lịch sử | ❌ không | ✅ có | ✅ (bảng outbox + inbox) |
| Chia việc nhiều worker | ❌ mọi subscriber nhận bản sao | ✅ consumer group | ✅ competing consumers |
| **Nguyên tử với DB** | ❌ không | ❌ không | ✅ **outbox nằm trong cùng transaction** |

### 6.1. Cột cuối cùng mới là lý do quyết định

Ngay cả Redis Streams — vốn khá mạnh — vẫn **không giải được bài toán dual-write** của buổi 4:

```
❌ Với bất kỳ broker nào (kể cả Streams):
   1. COMMIT transaction tạo đơn ở PostgreSQL   ✓
   2. XADD / publish sự kiện                     ✗ (crash / mất mạng đúng đây)
   → Đơn có thật nhưng email xác nhận KHÔNG BAO GIỜ được gửi.
```

```
✅ Outbox pattern (repo đang dùng):
   Transaction { ghi đơn + ghi outbox_events }  → commit CÙNG LÚC, nguyên tử
                          │
                          ▼
   Relay worker đọc outbox_events → publish RabbitMQ → đánh dấu đã gửi
   (publish lỗi → tin vẫn nằm trong bảng → thử lại → KHÔNG BAO GIỜ MẤT)
```

🎯 **Kết luận quan trọng nhất của lab:** vấn đề không phải "broker nào xịn hơn", mà là **sự kiện
có được ghi nguyên tử cùng dữ liệu nghiệp vụ hay không**. Chừng nào event store còn nằm ngoài
transaction của PostgreSQL, bạn vẫn cần outbox. Đổi RabbitMQ sang Kafka **không** làm bài toán này
biến mất.

### 6.2. Vậy Pub/Sub dùng được vào việc gì?

Không phải nó vô dụng — nó hợp với những việc **mất tin cũng không sao**:

- đẩy thông báo realtime lên UI (mất thì lần sau refresh là có)
- invalidate cache trên nhiều instance (mất thì TTL vẫn dọn — xem buổi 8)
- tín hiệu "cấu hình vừa đổi, hãy reload"
- presence / typing indicator trong chat

⚠️ **Không bao giờ** dùng Pub/Sub cho: xác nhận đơn hàng, biến động số dư, trừ kho, gửi email
giao dịch — bất cứ thứ gì mà mất một tin là mất tiền hoặc mất niềm tin.

---

## 7. Dọn dẹp

```bash
make down        # tắt + xoá container và volume của lab
```

---

## 8. Bài tập

1. Chạy `make sub` ở 2 terminal rồi `make pub` — cả hai đều nhận được cùng tin. Giải thích vì sao
   Pub/Sub **không** chia việc được, còn consumer group thì có.
2. Sửa `streamRead` để **bỏ `XAck`**, chạy consumer rồi Ctrl+C giữa chừng. Dùng
   `docker exec -it ecommerce-redis-lab redis-cli XPENDING lab:stream g1` xem tin còn treo. Điều
   này tương ứng với cơ chế nào trong `notification-service`?
3. Thêm lệnh `xrange` in toàn bộ lịch sử stream. So sánh với việc **không thể** làm điều tương tự
   với Pub/Sub.
4. (Khó) Viết lại thí nghiệm 3 sao cho mô phỏng được **dual-write bug**: ghi vào một map trong bộ
   nhớ (giả làm DB) rồi `XADD`, và cố tình `panic` giữa hai bước. Chứng minh vì sao outbox cần
   nằm trong cùng transaction.

---

## 9. Liên hệ tài liệu chính

| Chủ đề | Đọc ở |
|---|---|
| Outbox pattern, dual-write | [Buổi 4](../../clean-architecture-go-tong-hop-vi.md#buổi-4--createorder-và-transaction-bundle) |
| Inbox, dedupe, webhook replay | [Buổi 5](../../clean-architecture-go-tong-hop-vi.md#buổi-5--webhook-và-inbox-pattern) |
| Relay worker, `SKIP LOCKED`, at-least-once | [Buổi 6](../../clean-architecture-go-tong-hop-vi.md#buổi-6--outbox-relay-worker) |
| Redis làm cache (vai trò khác của Redis) | [Buổi 8](../../clean-architecture-go-tong-hop-vi.md#buổi-8--redis-caching) |
