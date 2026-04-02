package inbox

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type ClaimStatus int

const (
	Claimed ClaimStatus = iota + 1
	AlreadyProcessed
	AlreadyClaimed
)

// Store coordinates duplicate detection through Redis so multiple notification
// replicas do not deliver the same event twice after successful processing.
type Store interface {
	Claim(ctx context.Context, messageID string, processingTTL time.Duration) (ClaimStatus, error)
	MarkProcessed(ctx context.Context, messageID string, ttl time.Duration) error
	Release(ctx context.Context, messageID string) error
}

type redisStore struct {
	client *redis.Client
	prefix string
}

func NewRedisStore(client *redis.Client, prefix string) Store {
	return &redisStore{
		client: client,
		prefix: prefix,
	}
}

func (s *redisStore) Claim(ctx context.Context, messageID string, processingTTL time.Duration) (ClaimStatus, error) {
	result, err := claimScript.Run(ctx, s.client, []string{
		s.processedKey(messageID),
		s.processingKey(messageID),
	}, int(processingTTL/time.Millisecond)).Int()
	if err != nil {
		return 0, fmt.Errorf("failed to claim notification inbox message: %w", err)
	}

	switch result {
	case 1:
		return Claimed, nil
	case 2:
		return AlreadyProcessed, nil
	default:
		return AlreadyClaimed, nil
	}
}

func (s *redisStore) MarkProcessed(ctx context.Context, messageID string, ttl time.Duration) error {
	_, err := markProcessedScript.Run(ctx, s.client, []string{
		s.processedKey(messageID),
		s.processingKey(messageID),
	}, int(ttl/time.Millisecond)).Result()
	if err != nil {
		return fmt.Errorf("failed to mark notification inbox message processed: %w", err)
	}

	return nil
}

func (s *redisStore) Release(ctx context.Context, messageID string) error {
	if err := s.client.Del(ctx, s.processingKey(messageID)).Err(); err != nil {
		return fmt.Errorf("failed to release notification inbox message: %w", err)
	}

	return nil
}

func (s *redisStore) processedKey(messageID string) string {
	return s.prefix + ":processed:" + messageID
}

func (s *redisStore) processingKey(messageID string) string {
	return s.prefix + ":processing:" + messageID
}

var claimScript = redis.NewScript(`
if redis.call("EXISTS", KEYS[1]) == 1 then
	return 2
end
if redis.call("SET", KEYS[2], "1", "NX", "PX", ARGV[1]) then
	return 1
end
return 3
`)

var markProcessedScript = redis.NewScript(`
redis.call("SET", KEYS[1], "1", "PX", ARGV[1])
redis.call("DEL", KEYS[2])
return 1
`)
