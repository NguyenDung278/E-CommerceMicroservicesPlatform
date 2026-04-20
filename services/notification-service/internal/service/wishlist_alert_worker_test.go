package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"go.uber.org/zap"

	notificationclient "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/client"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/email"
)

type fakeWishlistAlertSource struct {
	deliveries []notificationclient.WishlistAlertDelivery
	err        error
}

type fakeWishlistAlertDeduper struct {
	results map[string]bool
	err     error
}

type fakeEmailSender struct {
	messages []email.Message
	err      error
}

func (s *fakeWishlistAlertSource) ListDispatchableWishlistAlerts(
	_ context.Context,
	_ int,
) ([]notificationclient.WishlistAlertDelivery, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.deliveries, nil
}

func (d *fakeWishlistAlertDeduper) Claim(
	_ context.Context,
	delivery notificationclient.WishlistAlertDelivery,
) (bool, error) {
	if d.err != nil {
		return false, d.err
	}
	if d.results == nil {
		return true, nil
	}
	value, ok := d.results[delivery.Alert.ProductID]
	if !ok {
		return true, nil
	}
	return value, nil
}

func (s *fakeEmailSender) Send(message email.Message) error {
	s.messages = append(s.messages, message)
	return s.err
}

func TestWishlistAlertWorkerRunCycleSendsOnlyClaimedAlerts(t *testing.T) {
	sender := &fakeEmailSender{}
	worker := NewWishlistAlertWorker(
		zap.NewNop(),
		sender,
		&fakeWishlistAlertSource{
			deliveries: []notificationclient.WishlistAlertDelivery{
				{
					UserID:    "user-1",
					UserEmail: "alice@example.com",
					Topic:     "wishlist_price_drop",
					Alert: notificationclient.WishlistAlert{
						ProductID:     "product-1",
						ProductName:   "Archive Coat",
						Kind:          "price_drop",
						BaselinePrice: 150,
						CurrentPrice:  99,
					},
				},
				{
					UserID:    "user-1",
					UserEmail: "alice@example.com",
					Topic:     "wishlist_back_in_stock",
					Alert: notificationclient.WishlistAlert{
						ProductID:    "product-2",
						ProductName:  "Field Trousers",
						Kind:         "back_in_stock",
						CurrentStock: 8,
					},
				},
			},
		},
		&fakeWishlistAlertDeduper{
			results: map[string]bool{
				"product-1": true,
				"product-2": false,
			},
		},
		time.Minute,
		10,
	)

	worker.runCycle(context.Background())

	if len(sender.messages) != 1 {
		t.Fatalf("expected only one claimed alert to be sent, got %d", len(sender.messages))
	}
	if sender.messages[0].Subject == "" {
		t.Fatal("expected wishlist alert email subject to be set")
	}
}

func TestWishlistAlertWorkerRunCycleContinuesAfterSourceError(t *testing.T) {
	sender := &fakeEmailSender{}
	worker := NewWishlistAlertWorker(
		zap.NewNop(),
		sender,
		&fakeWishlistAlertSource{err: errors.New("unavailable")},
		noopWishlistAlertDeduper{},
		time.Minute,
		10,
	)

	worker.runCycle(context.Background())

	if len(sender.messages) != 0 {
		t.Fatalf("expected no wishlist alert emails when source fails, got %d", len(sender.messages))
	}
}
