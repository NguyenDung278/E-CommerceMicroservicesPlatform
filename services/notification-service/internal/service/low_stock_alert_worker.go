package service

import (
	"context"
	"fmt"
	"net/mail"
	"strings"
	"time"

	"go.uber.org/zap"

	notificationclient "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/client"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/email"
)

type lowStockSource interface {
	ListLowStock(ctx context.Context, threshold int, limit int) ([]notificationclient.LowStockEntry, error)
}

// LowStockAlertWorker quét tồn kho chạm ngưỡng theo chu kỳ và gửi digest cho
// nhóm vận hành.
//
// Gửi MỘT email gộp mỗi chu kỳ chứ không phải mỗi món một email: khi kho cạn
// diện rộng (sau một đợt sale) thì cách sau tạo ra hàng chục email rời rạc,
// vừa dễ bị đánh spam vừa che mất bức tranh "cần nhập những gì".
type LowStockAlertWorker struct {
	log          *zap.Logger
	sender       email.Sender
	source       lowStockSource
	deduper      LowStockAlertDeduper
	recipients   []string
	pollInterval time.Duration
	threshold    int
	batchLimit   int
}

func NewLowStockAlertWorker(
	log *zap.Logger,
	sender email.Sender,
	source lowStockSource,
	deduper LowStockAlertDeduper,
	recipients []string,
	pollInterval time.Duration,
	threshold int,
	batchLimit int,
) *LowStockAlertWorker {
	if log == nil {
		log = zap.NewNop()
	}
	if deduper == nil {
		deduper = noopLowStockAlertDeduper{}
	}
	if pollInterval <= 0 {
		pollInterval = 15 * time.Minute
	}
	if threshold < 0 {
		threshold = 0
	}
	if batchLimit <= 0 {
		batchLimit = 50
	}

	return &LowStockAlertWorker{
		log:          log,
		sender:       sender,
		source:       source,
		deduper:      deduper,
		recipients:   normalizeRecipients(recipients),
		pollInterval: pollInterval,
		threshold:    threshold,
		batchLimit:   batchLimit,
	}
}

// normalizeRecipients lọc bỏ địa chỉ rỗng/sai định dạng ngay lúc khởi tạo để
// worker không đi tới bước gửi rồi mới chết vì một dấu phẩy thừa trong config.
func normalizeRecipients(recipients []string) []string {
	cleaned := make([]string, 0, len(recipients))
	seen := make(map[string]struct{}, len(recipients))

	for _, recipient := range recipients {
		address := strings.TrimSpace(recipient)
		if address == "" {
			continue
		}
		if _, err := mail.ParseAddress(address); err != nil {
			continue
		}
		if _, duplicate := seen[address]; duplicate {
			continue
		}
		seen[address] = struct{}{}
		cleaned = append(cleaned, address)
	}

	return cleaned
}

// Start chạy vòng lặp quét cho tới khi ctx bị huỷ.
//
// Thiếu người nhận thì worker không chạy: cảnh báo không có nơi để tới, quét
// tiếp chỉ tốn query. Đây cũng là mặc định local — chưa cấu hình recipients thì
// service vẫn khởi động bình thường, giống cách MinIO/Elasticsearch degrade.
func (w *LowStockAlertWorker) Start(ctx context.Context) {
	if w == nil || w.source == nil || w.sender == nil {
		return
	}
	if len(w.recipients) == 0 {
		w.log.Info("low stock alert worker disabled: no recipients configured")
		return
	}

	w.log.Info("low stock alert worker started",
		zap.Int("threshold", w.threshold),
		zap.Duration("poll_interval", w.pollInterval),
		zap.Int("recipients", len(w.recipients)),
	)

	ticker := time.NewTicker(w.pollInterval)
	defer ticker.Stop()

	w.runCycle(ctx)

	for {
		select {
		case <-ctx.Done():
			w.log.Info("low stock alert worker stopping")
			return
		case <-ticker.C:
			w.runCycle(ctx)
		}
	}
}

func (w *LowStockAlertWorker) runCycle(ctx context.Context) {
	pollCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	entries, err := w.source.ListLowStock(pollCtx, w.threshold, w.batchLimit)
	cancel()
	if err != nil {
		w.log.Warn("failed to poll low stock products", zap.Error(err))
		return
	}
	if len(entries) == 0 {
		return
	}

	claimed := make([]notificationclient.LowStockEntry, 0, len(entries))
	for _, entry := range entries {
		ok, err := w.deduper.Claim(ctx, entry)
		if err != nil {
			w.log.Warn("failed to claim low stock alert",
				zap.String("product_id", entry.ProductID),
				zap.String("sku", entry.SKU),
				zap.Error(err),
			)
			continue
		}
		if ok {
			claimed = append(claimed, entry)
		}
	}

	if len(claimed) == 0 {
		return
	}

	subject, body := lowStockDigestEmail(claimed, w.threshold)
	if err := w.sender.Send(email.Message{
		To:      w.recipients,
		Subject: subject,
		Body:    body,
	}); err != nil {
		w.log.Warn("failed to send low stock digest",
			zap.Int("entries", len(claimed)),
			zap.Error(err),
		)
		w.releaseClaims(ctx, claimed)
		return
	}

	w.log.Info("low stock digest sent",
		zap.Int("entries", len(claimed)),
		zap.Int("threshold", w.threshold),
	)
}

// releaseClaims nhả lại toàn bộ claim của chu kỳ gửi hỏng để chu kỳ sau báo lại.
func (w *LowStockAlertWorker) releaseClaims(
	ctx context.Context,
	entries []notificationclient.LowStockEntry,
) {
	for _, entry := range entries {
		if err := w.deduper.Release(ctx, entry); err != nil {
			w.log.Warn("failed to release low stock alert claim",
				zap.String("product_id", entry.ProductID),
				zap.String("sku", entry.SKU),
				zap.Error(err),
			)
		}
	}
}

func lowStockDigestEmail(entries []notificationclient.LowStockEntry, threshold int) (string, string) {
	outOfStock := make([]notificationclient.LowStockEntry, 0, len(entries))
	running := make([]notificationclient.LowStockEntry, 0, len(entries))
	for _, entry := range entries {
		if entry.IsOutOfStock() {
			outOfStock = append(outOfStock, entry)
			continue
		}
		running = append(running, entry)
	}

	subject := fmt.Sprintf("Canh bao ton kho thap: %d muc hang", len(entries))
	if len(outOfStock) > 0 {
		subject = fmt.Sprintf("Canh bao ton kho: %d muc het hang, %d muc sap het",
			len(outOfStock), len(running))
	}

	var body strings.Builder
	body.WriteString(fmt.Sprintf(
		"Nguong canh bao hien tai: %d.\n\n",
		threshold,
	))

	if len(outOfStock) > 0 {
		body.WriteString("DA HET HANG:\n")
		for _, entry := range outOfStock {
			body.WriteString(fmt.Sprintf("  - %s\n", entry.DisplayName()))
		}
		body.WriteString("\n")
	}

	if len(running) > 0 {
		body.WriteString("SAP HET HANG:\n")
		for _, entry := range running {
			body.WriteString(fmt.Sprintf("  - %s: con %d\n", entry.DisplayName(), entry.Stock))
		}
		body.WriteString("\n")
	}

	body.WriteString(
		"Muc co ten variant la ton kho theo size/mau cu the, khong phai tong ton kho cua san pham.\n",
	)

	return subject, body.String()
}
