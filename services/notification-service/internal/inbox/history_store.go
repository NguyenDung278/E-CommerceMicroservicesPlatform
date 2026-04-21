package inbox

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type HistoryItem struct {
	ID             string     `json:"id"`
	UserID         string     `json:"user_id"`
	Topic          string     `json:"topic"`
	RoutingKey     string     `json:"routing_key"`
	DeliveryStatus string     `json:"delivery_status"`
	VisibleToUser  bool       `json:"visible_to_user"`
	AttemptCount   int        `json:"attempt_count,omitempty"`
	LastError      string     `json:"last_error,omitempty"`
	NextRetryAt    *time.Time `json:"next_retry_at,omitempty"`
	Title          string     `json:"title"`
	Message        string     `json:"message"`
	ActionHref     string     `json:"action_href,omitempty"`
	ActionLabel    string     `json:"action_label,omitempty"`
	OrderID        string     `json:"order_id,omitempty"`
	PaymentID      string     `json:"payment_id,omitempty"`
	ReturnID       string     `json:"return_id,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	ReadAt         *time.Time `json:"read_at,omitempty"`
}

type HistoryStore interface {
	Append(ctx context.Context, item HistoryItem, ttl time.Duration) error
	ListByUser(ctx context.Context, userID string, limit int) ([]HistoryItem, error)
	ListRecent(ctx context.Context, limit int) ([]HistoryItem, error)
	MarkAllRead(ctx context.Context, userID string, readAt time.Time) (int, error)
}

type redisHistoryStore struct {
	client *redis.Client
	prefix string
}

func NewRedisHistoryStore(client *redis.Client, prefix string) HistoryStore {
	return &redisHistoryStore{
		client: client,
		prefix: prefix,
	}
}

func (s *redisHistoryStore) Append(ctx context.Context, item HistoryItem, ttl time.Duration) error {
	if s == nil || s.client == nil {
		return nil
	}

	item.ID = strings.TrimSpace(item.ID)
	item.UserID = strings.TrimSpace(item.UserID)
	if item.ID == "" {
		return nil
	}
	if item.VisibleToUser && item.UserID == "" {
		return nil
	}
	if item.CreatedAt.IsZero() {
		item.CreatedAt = time.Now().UTC()
	}
	if ttl <= 0 {
		ttl = 7 * 24 * time.Hour
	}

	payload, err := json.Marshal(item)
	if err != nil {
		return fmt.Errorf("failed to marshal notification history item: %w", err)
	}

	pipe := s.client.TxPipeline()
	if item.VisibleToUser {
		pipe.ZAdd(ctx, s.userItemsKey(item.UserID), redis.Z{
			Score:  float64(item.CreatedAt.UnixMilli()),
			Member: item.ID,
		})
		pipe.Expire(ctx, s.userItemsKey(item.UserID), ttl)
	}
	pipe.ZAdd(ctx, s.auditItemsKey(), redis.Z{
		Score:  float64(item.CreatedAt.UnixMilli()),
		Member: item.ID,
	})
	pipe.Set(ctx, s.itemKey(item.ID), payload, ttl)
	pipe.Expire(ctx, s.auditItemsKey(), ttl)
	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("failed to append notification history item: %w", err)
	}

	return nil
}

func (s *redisHistoryStore) ListByUser(ctx context.Context, userID string, limit int) ([]HistoryItem, error) {
	if s == nil || s.client == nil {
		return []HistoryItem{}, nil
	}

	userID = strings.TrimSpace(userID)
	if userID == "" {
		return []HistoryItem{}, nil
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	ids, err := s.client.ZRevRange(ctx, s.userItemsKey(userID), 0, int64(limit-1)).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to list notification history ids: %w", err)
	}

	return s.listByIDs(ctx, ids)
}

func (s *redisHistoryStore) ListRecent(ctx context.Context, limit int) ([]HistoryItem, error) {
	if s == nil || s.client == nil {
		return []HistoryItem{}, nil
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 200 {
		limit = 200
	}

	ids, err := s.client.ZRevRange(ctx, s.auditItemsKey(), 0, int64(limit-1)).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to list notification history ids: %w", err)
	}
	return s.listByIDs(ctx, ids)
}

func (s *redisHistoryStore) listByIDs(ctx context.Context, ids []string) ([]HistoryItem, error) {
	if len(ids) == 0 {
		return []HistoryItem{}, nil
	}

	pipe := s.client.Pipeline()
	cmds := make([]*redis.StringCmd, 0, len(ids))
	for _, id := range ids {
		cmds = append(cmds, pipe.Get(ctx, s.itemKey(id)))
	}
	if _, err := pipe.Exec(ctx); err != nil && err != redis.Nil {
		return nil, fmt.Errorf("failed to load notification history items: %w", err)
	}

	items := make([]HistoryItem, 0, len(ids))
	for _, cmd := range cmds {
		payload, err := cmd.Result()
		if err != nil {
			if err == redis.Nil {
				continue
			}
			return nil, fmt.Errorf("failed to read notification history item payload: %w", err)
		}

		var item HistoryItem
		if err := json.Unmarshal([]byte(payload), &item); err != nil {
			return nil, fmt.Errorf("failed to decode notification history item: %w", err)
		}
		items = append(items, item)
	}

	return items, nil
}

func (s *redisHistoryStore) MarkAllRead(ctx context.Context, userID string, readAt time.Time) (int, error) {
	if s == nil || s.client == nil {
		return 0, nil
	}

	userID = strings.TrimSpace(userID)
	if userID == "" {
		return 0, nil
	}
	if readAt.IsZero() {
		readAt = time.Now().UTC()
	}

	ids, err := s.client.ZRevRange(ctx, s.userItemsKey(userID), 0, -1).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to list notification history ids for mark-all-read: %w", err)
	}
	if len(ids) == 0 {
		return 0, nil
	}

	items, err := s.ListByUser(ctx, userID, len(ids))
	if err != nil {
		return 0, err
	}
	if len(items) == 0 {
		return 0, nil
	}

	updated := 0
	pipe := s.client.TxPipeline()
	for _, item := range items {
		if item.ReadAt != nil {
			continue
		}

		item.ReadAt = &readAt
		payload, err := json.Marshal(item)
		if err != nil {
			return 0, fmt.Errorf("failed to marshal notification history read state: %w", err)
		}
		ttl, ttlErr := s.client.TTL(ctx, s.itemKey(item.ID)).Result()
		if ttlErr != nil || ttl <= 0 {
			ttl = 7 * 24 * time.Hour
		}
		pipe.Set(ctx, s.itemKey(item.ID), payload, ttl)
		updated++
	}

	if updated == 0 {
		return 0, nil
	}
	if _, err := pipe.Exec(ctx); err != nil {
		return 0, fmt.Errorf("failed to mark notification history items read: %w", err)
	}

	return updated, nil
}

func (s *redisHistoryStore) userItemsKey(userID string) string {
	return s.prefix + ":user:" + userID
}

func (s *redisHistoryStore) itemKey(itemID string) string {
	return s.prefix + ":item:" + itemID
}

func (s *redisHistoryStore) auditItemsKey() string {
	return s.prefix + ":audit"
}
