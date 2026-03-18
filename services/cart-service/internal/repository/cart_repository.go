package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/model"
)

// CartRepository defines the interface for cart data access.
type CartRepository interface {
	Get(ctx context.Context, userID string) (*model.Cart, error)
	Save(ctx context.Context, cart *model.Cart) error
	Delete(ctx context.Context, userID string) error
}

// redisCartRepository implements CartRepository using Redis.
//
// WHY REDIS FOR CARTS:
//   - Sub-millisecond reads/writes (critical for cart UX)
//   - Built-in TTL — carts auto-expire after 7 days of inactivity
//   - Low infrastructure cost — carts don't need ACID guarantees
//   - Easy horizontal scaling with Redis Cluster
//
// STORAGE FORMAT: Each cart is stored as a JSON string at key "cart:{userID}".
// An alternative approach uses Redis Hash per cart item, but JSON is simpler
// and the cart payload is small enough that serialization overhead is negligible.
type redisCartRepository struct {
	client *redis.Client
	ttl    time.Duration
}

// NewCartRepository creates a new Redis-backed cart repository.
func NewCartRepository(client *redis.Client) CartRepository {
	return &redisCartRepository{
		client: client,
		ttl:    7 * 24 * time.Hour, // Cart expires after 7 days
	}
}

func (r *redisCartRepository) cartKey(userID string) string {
	return fmt.Sprintf("cart:%s", userID)
}

// Get retrieves a user's cart from Redis.
// Returns an empty cart if the key doesn't exist (not an error).
func (r *redisCartRepository) Get(ctx context.Context, userID string) (*model.Cart, error) {
	data, err := r.client.Get(ctx, r.cartKey(userID)).Bytes()
	if err == redis.Nil {
		// No cart exists — return an empty cart.
		return &model.Cart{
			UserID: userID,
			Items:  []model.CartItem{},
			Total:  0,
		}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get cart: %w", err)
	}

	var cart model.Cart
	if err := json.Unmarshal(data, &cart); err != nil {
		return nil, fmt.Errorf("failed to unmarshal cart: %w", err)
	}
	return &cart, nil
}

// Save persists a cart to Redis with TTL.
// Every save refreshes the TTL — the cart only expires after 7 days of inactivity.
func (r *redisCartRepository) Save(ctx context.Context, cart *model.Cart) error {
	data, err := json.Marshal(cart)
	if err != nil {
		return fmt.Errorf("failed to marshal cart: %w", err)
	}

	if err := r.client.Set(ctx, r.cartKey(cart.UserID), data, r.ttl).Err(); err != nil {
		return fmt.Errorf("failed to save cart: %w", err)
	}
	return nil
}

// Delete removes a cart from Redis (e.g., after checkout).
func (r *redisCartRepository) Delete(ctx context.Context, userID string) error {
	if err := r.client.Del(ctx, r.cartKey(userID)).Err(); err != nil {
		return fmt.Errorf("failed to delete cart: %w", err)
	}
	return nil
}
