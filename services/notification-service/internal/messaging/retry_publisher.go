package messaging

import (
	"context"
	"fmt"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

// RetryPublisher republishes transiently failed notification events to a retry
// queue whose TTL eventually routes them back to the main queue.
type RetryPublisher struct {
	ch        *amqp.Channel
	queueName string
	baseDelay time.Duration
	maxDelay  time.Duration
	mu        sync.Mutex
}

func NewRetryPublisher(ch *amqp.Channel, queueName string, baseDelay, maxDelay time.Duration) *RetryPublisher {
	if baseDelay <= 0 {
		baseDelay = 30 * time.Second
	}
	if maxDelay < baseDelay {
		maxDelay = baseDelay
	}
	return &RetryPublisher{
		ch:        ch,
		queueName: queueName,
		baseDelay: baseDelay,
		maxDelay:  maxDelay,
	}
}

func (p *RetryPublisher) Publish(ctx context.Context, msg amqp.Delivery, retryCount int, firstSeenAt time.Time) (time.Time, time.Duration, error) {
	if p == nil || p.ch == nil {
		return time.Time{}, 0, fmt.Errorf("retry publisher is not configured")
	}

	headers := cloneHeaders(msg.Headers)
	headers[HeaderRetryCount] = retryCount
	headers[HeaderFirstSeen] = firstSeenAt.UTC().Format(time.RFC3339Nano)
	delay := p.delayForRetry(retryCount)
	nextRetryAt := time.Now().UTC().Add(delay)
	headers[HeaderNextRetryAt] = nextRetryAt.Format(time.RFC3339Nano)

	p.mu.Lock()
	defer p.mu.Unlock()

	if err := p.ch.PublishWithContext(
		ctx,
		"",
		p.queueName,
		false,
		false,
		amqp.Publishing{
			ContentType:     msg.ContentType,
			ContentEncoding: msg.ContentEncoding,
			DeliveryMode:    amqp.Persistent,
			Body:            msg.Body,
			Headers:         headers,
			Expiration:      fmt.Sprintf("%d", delay.Milliseconds()),
			MessageId:       messageIDFromDelivery(msg),
			Timestamp:       time.Now(),
			Type:            msg.Type,
			AppId:           msg.AppId,
		},
	); err != nil {
		return time.Time{}, 0, fmt.Errorf("failed to publish notification retry message: %w", err)
	}

	return nextRetryAt, delay, nil
}

func (p *RetryPublisher) delayForRetry(retryCount int) time.Duration {
	if retryCount <= 1 {
		return p.baseDelay
	}

	delay := p.baseDelay
	for attempt := 1; attempt < retryCount; attempt++ {
		if delay >= p.maxDelay/2 {
			return p.maxDelay
		}
		delay *= 2
	}
	if delay > p.maxDelay {
		return p.maxDelay
	}
	return delay
}

func cloneHeaders(source amqp.Table) amqp.Table {
	if source == nil {
		return amqp.Table{}
	}

	copied := make(amqp.Table, len(source))
	for key, value := range source {
		copied[key] = value
	}
	return copied
}
