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

type wishlistAlertSource interface {
	ListDispatchableWishlistAlerts(
		ctx context.Context,
		limit int,
	) ([]notificationclient.WishlistAlertDelivery, error)
}

type WishlistAlertWorker struct {
	log          *zap.Logger
	sender       email.Sender
	source       wishlistAlertSource
	deduper      WishlistAlertDeduper
	pollInterval time.Duration
	batchLimit   int
}

func NewWishlistAlertWorker(
	log *zap.Logger,
	sender email.Sender,
	source wishlistAlertSource,
	deduper WishlistAlertDeduper,
	pollInterval time.Duration,
	batchLimit int,
) *WishlistAlertWorker {
	if log == nil {
		log = zap.NewNop()
	}
	if deduper == nil {
		deduper = noopWishlistAlertDeduper{}
	}
	if pollInterval <= 0 {
		pollInterval = 5 * time.Minute
	}
	if batchLimit <= 0 {
		batchLimit = 50
	}

	return &WishlistAlertWorker{
		log:          log,
		sender:       sender,
		source:       source,
		deduper:      deduper,
		pollInterval: pollInterval,
		batchLimit:   batchLimit,
	}
}

func (w *WishlistAlertWorker) Start(ctx context.Context) {
	if w == nil || w.source == nil || w.sender == nil {
		return
	}

	ticker := time.NewTicker(w.pollInterval)
	defer ticker.Stop()

	w.runCycle(ctx)

	for {
		select {
		case <-ctx.Done():
			w.log.Info("wishlist alert worker stopping")
			return
		case <-ticker.C:
			w.runCycle(ctx)
		}
	}
}

func (w *WishlistAlertWorker) runCycle(ctx context.Context) {
	pollCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	deliveries, err := w.source.ListDispatchableWishlistAlerts(pollCtx, w.batchLimit)
	cancel()
	if err != nil {
		w.log.Warn("failed to poll wishlist alerts", zap.Error(err))
		return
	}

	for _, delivery := range deliveries {
		if err := w.deliver(ctx, delivery); err != nil {
			w.log.Warn("failed to deliver wishlist alert",
				zap.String("user_id", delivery.UserID),
				zap.String("product_id", delivery.Alert.ProductID),
				zap.String("kind", delivery.Alert.Kind),
				zap.Error(err),
			)
		}
	}
}

func (w *WishlistAlertWorker) deliver(
	ctx context.Context,
	delivery notificationclient.WishlistAlertDelivery,
) error {
	claimed, err := w.deduper.Claim(ctx, delivery)
	if err != nil {
		return err
	}
	if !claimed {
		return nil
	}

	to := strings.TrimSpace(delivery.UserEmail)
	if to == "" {
		return nil
	}
	if _, err := mail.ParseAddress(to); err != nil {
		return nil
	}

	subject, body := wishlistAlertEmail(delivery)
	return w.sender.Send(email.Message{
		To:      []string{to},
		Subject: subject,
		Body:    body,
	})
}

func wishlistAlertEmail(delivery notificationclient.WishlistAlertDelivery) (string, string) {
	productName := strings.TrimSpace(delivery.Alert.ProductName)
	if productName == "" {
		productName = delivery.Alert.ProductID
	}

	switch strings.TrimSpace(delivery.Alert.Kind) {
	case "back_in_stock":
		return "San pham trong wishlist da co hang tro lai", fmt.Sprintf(
			"Chao ban,\n\nSan pham %s da co hang tro lai.\nTon kho hien tai: %d\n\nNeu ban van quan tam, day la luc thuan tien de quay lai checkout.",
			productName,
			delivery.Alert.CurrentStock,
		)
	case "price_drop":
		return "San pham trong wishlist vua giam gia", fmt.Sprintf(
			"Chao ban,\n\nSan pham %s vua giam gia tu %.2f xuong %.2f.\n\nBan co the quay lai gio hang hoac trang san pham de dat mua khi san pham van con san.",
			productName,
			delivery.Alert.BaselinePrice,
			delivery.Alert.CurrentPrice,
		)
	default:
		return "Cap nhat wishlist", fmt.Sprintf(
			"Chao ban,\n\nSan pham %s trong wishlist cua ban vua co mot cap nhat moi.",
			productName,
		)
	}
}
