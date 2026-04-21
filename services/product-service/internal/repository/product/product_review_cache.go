package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

type RedisProductReviewCache struct {
	client *redis.Client
	ttl    time.Duration
}

func NewRedisProductReviewCache(client *redis.Client, ttl time.Duration) *RedisProductReviewCache {
	return &RedisProductReviewCache{
		client: client,
		ttl:    ttl,
	}
}

func (c *RedisProductReviewCache) GetSummary(ctx context.Context, productID string) (*model.ProductReviewSummary, bool, error) {
	value, err := c.client.Get(ctx, c.summaryKey(productID)).Result()
	if err == redis.Nil {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("failed to get product review summary cache: %w", err)
	}

	var summary model.ProductReviewSummary
	if err := json.Unmarshal([]byte(value), &summary); err != nil {
		return nil, false, fmt.Errorf("failed to decode product review summary cache: %w", err)
	}

	return &summary, true, nil
}

func (c *RedisProductReviewCache) SetSummary(ctx context.Context, productID string, summary *model.ProductReviewSummary) error {
	payload, err := json.Marshal(summary)
	if err != nil {
		return fmt.Errorf("failed to encode product review summary cache: %w", err)
	}

	if err := c.client.Set(ctx, c.summaryKey(productID), payload, c.ttl).Err(); err != nil {
		return fmt.Errorf("failed to set product review summary cache: %w", err)
	}

	return nil
}

func (c *RedisProductReviewCache) GetFirstPage(ctx context.Context, productID string, limit int) ([]*model.ProductReview, bool, error) {
	value, err := c.client.Get(ctx, c.firstPageKey(productID, limit)).Result()
	if err == redis.Nil {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("failed to get product review list cache: %w", err)
	}

	var reviews []*model.ProductReview
	if err := json.Unmarshal([]byte(value), &reviews); err != nil {
		return nil, false, fmt.Errorf("failed to decode product review list cache: %w", err)
	}

	return reviews, true, nil
}

func (c *RedisProductReviewCache) SetFirstPage(ctx context.Context, productID string, limit int, reviews []*model.ProductReview) error {
	payload, err := json.Marshal(reviews)
	if err != nil {
		return fmt.Errorf("failed to encode product review list cache: %w", err)
	}

	pageKey := c.firstPageKey(productID, limit)
	indexKey := c.firstPageIndexKey(productID)
	pipe := c.client.TxPipeline()
	pipe.Set(ctx, pageKey, payload, c.ttl)
	pipe.SAdd(ctx, indexKey, pageKey)
	pipe.Expire(ctx, indexKey, c.ttl)
	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("failed to set product review list cache: %w", err)
	}

	return nil
}

func (c *RedisProductReviewCache) Invalidate(ctx context.Context, productID string) error {
	indexKey := c.firstPageIndexKey(productID)
	pageKeys, err := c.client.SMembers(ctx, indexKey).Result()
	if err != nil && err != redis.Nil {
		return fmt.Errorf("failed to list product review cache keys: %w", err)
	}

	keys := make([]string, 0, len(pageKeys)+2)
	keys = append(keys, c.summaryKey(productID), indexKey)
	keys = append(keys, pageKeys...)
	if len(keys) == 0 {
		return nil
	}

	if err := c.client.Del(ctx, keys...).Err(); err != nil {
		return fmt.Errorf("failed to invalidate product review cache: %w", err)
	}

	return nil
}

func (c *RedisProductReviewCache) summaryKey(productID string) string {
	return fmt.Sprintf("product-review:summary:%s", productID)
}

func (c *RedisProductReviewCache) firstPageKey(productID string, limit int) string {
	return fmt.Sprintf("product-review:list:%s:limit:%d", productID, limit)
}

func (c *RedisProductReviewCache) firstPageIndexKey(productID string) string {
	return fmt.Sprintf("product-review:list-index:%s", productID)
}
