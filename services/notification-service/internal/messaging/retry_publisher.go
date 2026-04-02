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
	mu        sync.Mutex
}

func NewRetryPublisher(ch *amqp.Channel, queueName string) *RetryPublisher {
	return &RetryPublisher{
		ch:        ch,
		queueName: queueName,
	}
}

func (p *RetryPublisher) Publish(ctx context.Context, msg amqp.Delivery, retryCount int, firstSeenAt time.Time) error {
	if p == nil || p.ch == nil {
		return fmt.Errorf("retry publisher is not configured")
	}

	headers := cloneHeaders(msg.Headers)
	headers[HeaderRetryCount] = retryCount
	headers[HeaderFirstSeen] = firstSeenAt.UTC().Format(time.RFC3339Nano)

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
			MessageId:       messageIDFromDelivery(msg),
			Timestamp:       time.Now(),
			Type:            msg.Type,
			AppId:           msg.AppId,
		},
	); err != nil {
		return fmt.Errorf("failed to publish notification retry message: %w", err)
	}

	return nil
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
