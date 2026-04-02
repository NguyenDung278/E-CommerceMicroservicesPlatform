package messaging

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

type DeliveryMetadata struct {
	MessageID   string
	RetryCount  int
	FirstSeenAt time.Time
}

func BuildDeliveryMetadata(msg amqp.Delivery) DeliveryMetadata {
	firstSeenAt := time.Now().UTC()
	if !msg.Timestamp.IsZero() {
		firstSeenAt = msg.Timestamp.UTC()
	}
	if value, ok := msg.Headers[HeaderFirstSeen]; ok {
		if parsed, err := parseHeaderTime(value); err == nil {
			firstSeenAt = parsed
		}
	}

	return DeliveryMetadata{
		MessageID:   messageIDFromDelivery(msg),
		RetryCount:  parseRetryCount(msg.Headers[HeaderRetryCount]),
		FirstSeenAt: firstSeenAt,
	}
}

func messageIDFromDelivery(msg amqp.Delivery) string {
	if msg.MessageId != "" {
		return msg.MessageId
	}

	sum := sha256.Sum256(append([]byte(msg.RoutingKey), msg.Body...))
	return hex.EncodeToString(sum[:])
}

func parseRetryCount(value any) int {
	switch typed := value.(type) {
	case int:
		return maxInt(typed, 0)
	case int32:
		return maxInt(int(typed), 0)
	case int64:
		return maxInt(int(typed), 0)
	case float64:
		return maxInt(int(typed), 0)
	case string:
		parsed, err := strconv.Atoi(typed)
		if err == nil {
			return maxInt(parsed, 0)
		}
	}

	return 0
}

func parseHeaderTime(value any) (time.Time, error) {
	text, ok := value.(string)
	if !ok {
		return time.Time{}, fmt.Errorf("unsupported first seen header type %T", value)
	}

	parsed, err := time.Parse(time.RFC3339Nano, text)
	if err != nil {
		return time.Time{}, fmt.Errorf("failed to parse first seen header: %w", err)
	}

	return parsed.UTC(), nil
}

func maxInt(value, minimum int) int {
	if value < minimum {
		return minimum
	}
	return value
}
