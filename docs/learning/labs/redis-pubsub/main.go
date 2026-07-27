// Lab học tập: Redis Pub/Sub vs Redis Streams.
//
// Mục tiêu: TỰ TAY chứng minh Pub/Sub là fire-and-forget (subscriber offline =
// mất tin vĩnh viễn), rồi so sánh với Streams (lưu lại, đọc lại được, có
// consumer group) — làm bậc thang để hiểu Kafka và đối chiếu với outbox/inbox
// pattern đang chạy thật trong repo.
//
// KHÔNG dùng cho production. Đây là sandbox tách rời khỏi 6 service thật.
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	pubsubChannel = "lab:events"
	streamKey     = "lab:stream"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}

	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "localhost:6380"
	}

	rdb := redis.NewClient(&redis.Options{Addr: addr})
	defer rdb.Close()

	// Ctrl+C huỷ context → mọi vòng lặp thoát sạch (buổi 2: context + channel).
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	if err := rdb.Ping(ctx).Err(); err != nil {
		fmt.Fprintf(os.Stderr, "✗ Không kết nối được Redis tại %s: %v\n", addr, err)
		fmt.Fprintln(os.Stderr, "  Chạy `make up` trong thư mục lab này trước.")
		os.Exit(1)
	}

	var err error
	switch os.Args[1] {
	case "pub":
		err = publish(ctx, rdb, argInt(2, 5))
	case "sub":
		err = subscribe(ctx, rdb)
	case "xadd":
		err = streamAdd(ctx, rdb, argInt(2, 5))
	case "xread":
		err = streamRead(ctx, rdb, argStr(2, "g1"), argStr(3, "c1"))
	case "reset":
		err = rdb.Del(ctx, streamKey).Err()
		if err == nil {
			fmt.Println("✓ Đã xoá stream, chạy lại thí nghiệm từ đầu được.")
		}
	default:
		usage()
		os.Exit(1)
	}

	// Ctrl+C là cách thoát bình thường của lab này, không phải lỗi.
	if err != nil && !errors.Is(err, context.Canceled) {
		fmt.Fprintf(os.Stderr, "✗ lỗi: %v\n", err)
		os.Exit(1)
	}
}

// publish gửi n thông điệp lên kênh Pub/Sub.
//
// ĐIỂM HỌC QUAN TRỌNG NHẤT CỦA LAB: lệnh PUBLISH của Redis trả về *số subscriber
// đã nhận được*. Nếu số đó = 0, thông điệp vừa gửi đã BIẾN MẤT VĨNH VIỄN — không
// ai lưu nó lại, không có cách nào đọc lại. Đó chính là "fire-and-forget".
func publish(ctx context.Context, rdb *redis.Client, n int) error {
	fmt.Printf("PUB → kênh %q, %d thông điệp\n\n", pubsubChannel, n)

	for i := 1; i <= n; i++ {
		msg := fmt.Sprintf("order-%d @ %s", i, time.Now().Format("15:04:05.000"))

		received, err := rdb.Publish(ctx, pubsubChannel, msg).Result()
		if err != nil {
			return fmt.Errorf("publish thất bại: %w", err)
		}

		status := fmt.Sprintf("→ %d subscriber nhận được", received)
		if received == 0 {
			status = "→ 0 subscriber ✗ THÔNG ĐIỆP ĐÃ MẤT VĨNH VIỄN"
		}
		fmt.Printf("  %-34s %s\n", msg, status)

		time.Sleep(300 * time.Millisecond)
	}
	return nil
}

// subscribe lắng nghe kênh Pub/Sub.
//
// Chỉ nhận được thông điệp phát ra TRONG LÚC đang lắng nghe. Mọi thứ phát trước
// khi tiến trình này chạy đều không lấy lại được.
func subscribe(ctx context.Context, rdb *redis.Client) error {
	sub := rdb.Subscribe(ctx, pubsubChannel)
	defer sub.Close()

	// Receive() chờ xác nhận đăng ký thành công trước khi vào vòng lặp.
	if _, err := sub.Receive(ctx); err != nil {
		return fmt.Errorf("đăng ký kênh thất bại: %w", err)
	}
	fmt.Printf("SUB ← đang nghe kênh %q (Ctrl+C để thoát)\n\n", pubsubChannel)

	ch := sub.Channel()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case m, ok := <-ch:
			if !ok {
				return nil
			}
			fmt.Printf("  RECV %s\n", m.Payload)
		}
	}
}

// streamAdd ghi n thông điệp vào Redis Stream.
//
// Khác Pub/Sub: XADD LƯU thông điệp lại. Không cần ai đang nghe. Tin nhắn nằm đó
// chờ được đọc — giống hệt tinh thần bảng outbox_events trong repo.
func streamAdd(ctx context.Context, rdb *redis.Client, n int) error {
	fmt.Printf("XADD → stream %q, %d thông điệp\n\n", streamKey, n)

	for i := 1; i <= n; i++ {
		id, err := rdb.XAdd(ctx, &redis.XAddArgs{
			Stream: streamKey,
			Values: map[string]interface{}{
				"body": fmt.Sprintf("order-%d", i),
				"at":   time.Now().Format(time.RFC3339Nano),
			},
		}).Result()
		if err != nil {
			return fmt.Errorf("xadd thất bại: %w", err)
		}

		fmt.Printf("  order-%-3d → id=%s  ✓ ĐÃ LƯU (không cần ai đang nghe)\n", i, id)
		time.Sleep(200 * time.Millisecond)
	}
	return nil
}

// streamRead đọc stream bằng consumer group.
//
// Consumer group cho phép nhiều tiến trình chia nhau xử lý cùng một stream mà
// không trùng việc — chính là ý tưởng đứng sau consumer group của Kafka, và song
// song với `FOR UPDATE SKIP LOCKED` mà outbox relay worker của repo dùng (buổi 6).
func streamRead(ctx context.Context, rdb *redis.Client, group, consumer string) error {
	// MkStream: tạo cả stream nếu chưa có. "0" = đọc từ đầu, nên tin nhắn ghi
	// TRƯỚC khi consumer chạy vẫn đọc được — điều Pub/Sub không làm nổi.
	err := rdb.XGroupCreateMkStream(ctx, streamKey, group, "0").Err()
	if err != nil && !strings.Contains(err.Error(), "BUSYGROUP") {
		return fmt.Errorf("tạo consumer group thất bại: %w", err)
	}

	fmt.Printf("XREADGROUP ← stream=%q group=%q consumer=%q (Ctrl+C để thoát)\n\n",
		streamKey, group, consumer)

	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		res, err := rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    group,
			Consumer: consumer,
			Streams:  []string{streamKey, ">"}, // ">" = chỉ tin chưa ai trong group nhận
			Count:    10,
			Block:    2 * time.Second,
		}).Result()

		if errors.Is(err, redis.Nil) {
			continue // hết tin trong 2s, vòng lại chờ tiếp
		}
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return fmt.Errorf("xreadgroup thất bại: %w", err)
		}

		for _, stream := range res {
			for _, m := range stream.Messages {
				fmt.Printf("  RECV id=%s body=%v\n", m.ID, m.Values["body"])

				// ACK = "tôi xử lý xong rồi". Chưa ACK thì tin vẫn nằm trong danh
				// sách pending và có thể giao lại cho consumer khác — đây là
				// at-least-once delivery, y hệt RabbitMQ trong repo (buổi 6).
				if err := rdb.XAck(ctx, streamKey, group, m.ID).Err(); err != nil {
					return fmt.Errorf("ack thất bại: %w", err)
				}
			}
		}
	}
}

func argInt(idx, fallback int) int {
	if len(os.Args) <= idx {
		return fallback
	}
	n, err := strconv.Atoi(os.Args[idx])
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}

func argStr(idx int, fallback string) string {
	if len(os.Args) <= idx {
		return fallback
	}
	return os.Args[idx]
}

func usage() {
	fmt.Fprint(os.Stderr, `Lab: Redis Pub/Sub vs Streams

  go run . pub [n]              phát n thông điệp lên Pub/Sub (mặc định 5)
  go run . sub                  lắng nghe Pub/Sub
  go run . xadd [n]             ghi n thông điệp vào Stream (mặc định 5)
  go run . xread [group] [consumer]   đọc Stream bằng consumer group
  go run . reset                xoá stream để chạy lại từ đầu

Biến môi trường: REDIS_ADDR (mặc định localhost:6380)
Xem README.md để biết kịch bản thí nghiệm.
`)
}
