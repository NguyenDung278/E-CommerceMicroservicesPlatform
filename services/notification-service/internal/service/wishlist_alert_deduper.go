package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	notificationclient "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/client"
)

type WishlistAlertDeduper interface {
	Claim(ctx context.Context, delivery notificationclient.WishlistAlertDelivery) (bool, error)
}

type redisWishlistAlertDeduper struct {
	client *redis.Client
	prefix string
}

func NewRedisWishlistAlertDeduper(client *redis.Client, prefix string) WishlistAlertDeduper {
	if client == nil {
		return noopWishlistAlertDeduper{}
	}
	cleanPrefix := strings.TrimSpace(prefix)
	if cleanPrefix == "" {
		cleanPrefix = "notification-service:wishlist-alert"
	}

	return &redisWishlistAlertDeduper{
		client: client,
		prefix: cleanPrefix,
	}
}

func (d *redisWishlistAlertDeduper) Claim(
	ctx context.Context,
	delivery notificationclient.WishlistAlertDelivery,
) (bool, error) {
	key := d.key(delivery)
	ttl := d.ttl(delivery)
	if key == "" {
		return true, nil
	}

	claimed, err := d.client.SetNX(ctx, key, "1", ttl).Result()
	if err != nil {
		return false, fmt.Errorf("failed to claim wishlist alert delivery: %w", err)
	}
	return claimed, nil
}

func (d *redisWishlistAlertDeduper) key(delivery notificationclient.WishlistAlertDelivery) string {
	userID := strings.TrimSpace(delivery.UserID)
	productID := strings.TrimSpace(delivery.Alert.ProductID)
	kind := strings.TrimSpace(delivery.Alert.Kind)
	if userID == "" || productID == "" || kind == "" {
		return ""
	}

	switch kind {
	case "price_drop":
		return fmt.Sprintf(
			"%s:%s:%s:%s:%0.2f",
			d.prefix,
			kind,
			userID,
			productID,
			delivery.Alert.CurrentPrice,
		)
	default:
		return fmt.Sprintf("%s:%s:%s:%s", d.prefix, kind, userID, productID)
	}
}

func (d *redisWishlistAlertDeduper) ttl(delivery notificationclient.WishlistAlertDelivery) time.Duration {
	switch strings.TrimSpace(delivery.Alert.Kind) {
	case "price_drop":
		return 7 * 24 * time.Hour
	default:
		return 24 * time.Hour
	}
}

type noopWishlistAlertDeduper struct{}

func (noopWishlistAlertDeduper) Claim(
	_ context.Context,
	_ notificationclient.WishlistAlertDelivery,
) (bool, error) {
	return true, nil
}
