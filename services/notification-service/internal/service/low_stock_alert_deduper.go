package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	notificationclient "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/client"
)

// lowStockDedupeTTL giới hạn mỗi món tối đa một email mỗi ngày ở cùng một mức
// khẩn cấp. Worker quét lại sau mỗi chu kỳ và món hàng vẫn nằm dưới ngưỡng cho
// tới khi có người nhập kho, nên không khử trùng lặp thì mỗi ngày ops sẽ nhận
// hàng chục bản sao của cùng một cảnh báo rồi ngừng đọc chúng.
const lowStockDedupeTTL = 24 * time.Hour

type LowStockAlertDeduper interface {
	Claim(ctx context.Context, entry notificationclient.LowStockEntry) (bool, error)

	// Release trả lại quyền cảnh báo khi email không gửi được.
	//
	// Worker gom nhiều entry vào một digest và phải claim TRƯỚC khi gửi, nên nếu
	// SMTP lỗi mà cứ giữ claim thì toàn bộ cảnh báo trong chu kỳ đó im lặng
	// nguyên 24h — đúng kiểu hỏng âm thầm mà cảnh báo tồn kho không được phép có.
	Release(ctx context.Context, entry notificationclient.LowStockEntry) error
}

type redisLowStockAlertDeduper struct {
	client *redis.Client
	prefix string
}

func NewRedisLowStockAlertDeduper(client *redis.Client, prefix string) LowStockAlertDeduper {
	if client == nil {
		return noopLowStockAlertDeduper{}
	}
	cleanPrefix := strings.TrimSpace(prefix)
	if cleanPrefix == "" {
		cleanPrefix = "notification-service:low-stock-alert"
	}

	return &redisLowStockAlertDeduper{
		client: client,
		prefix: cleanPrefix,
	}
}

func (d *redisLowStockAlertDeduper) Claim(
	ctx context.Context,
	entry notificationclient.LowStockEntry,
) (bool, error) {
	key := d.key(entry)
	if key == "" {
		return true, nil
	}

	claimed, err := d.client.SetNX(ctx, key, "1", lowStockDedupeTTL).Result()
	if err != nil {
		return false, fmt.Errorf("failed to claim low stock alert: %w", err)
	}
	return claimed, nil
}

func (d *redisLowStockAlertDeduper) Release(
	ctx context.Context,
	entry notificationclient.LowStockEntry,
) error {
	key := d.key(entry)
	if key == "" {
		return nil
	}

	if err := d.client.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("failed to release low stock alert claim: %w", err)
	}
	return nil
}

// key gắn mức khẩn cấp vào khoá thay vì gắn số tồn kho.
//
// Gắn số tồn: bán thêm một cái là đổi khoá, thành ra spam lại.
// Không gắn gì: món tụt từ "còn 3" xuống "hết sạch" cũng im lặng suốt 24h, đúng
// lúc đáng báo nhất thì lại không báo.
// Nên chỉ tách hai bậc low/out — hết hàng được phá khoá để báo lại một lần.
func (d *redisLowStockAlertDeduper) key(entry notificationclient.LowStockEntry) string {
	productID := strings.TrimSpace(entry.ProductID)
	if productID == "" {
		return ""
	}

	severity := "low"
	if entry.IsOutOfStock() {
		severity = "out"
	}

	sku := strings.TrimSpace(entry.SKU)
	if sku == "" {
		sku = "-"
	}

	return fmt.Sprintf("%s:%s:%s:%s", d.prefix, severity, productID, sku)
}

type noopLowStockAlertDeduper struct{}

func (noopLowStockAlertDeduper) Claim(
	_ context.Context,
	_ notificationclient.LowStockEntry,
) (bool, error) {
	return true, nil
}

func (noopLowStockAlertDeduper) Release(
	_ context.Context,
	_ notificationclient.LowStockEntry,
) error {
	return nil
}
