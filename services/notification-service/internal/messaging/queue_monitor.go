package messaging

import (
	"context"
	"fmt"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/monitoring"
)

// QueueMonitor periodically inspects RabbitMQ queues and exports backlog
// metrics for dashboards and alerts.
type QueueMonitor struct {
	ch     *amqp.Channel
	queues []string
	log    *zap.Logger
	mu     sync.Mutex
}

func NewQueueMonitor(ch *amqp.Channel, log *zap.Logger, queues ...string) *QueueMonitor {
	return &QueueMonitor{
		ch:     ch,
		queues: queues,
		log:    log,
	}
}

func (m *QueueMonitor) Start(ctx context.Context, interval time.Duration) {
	if m == nil || m.ch == nil || interval <= 0 {
		return
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		m.observeQueues(ctx)

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (m *QueueMonitor) observeQueues(ctx context.Context) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, queueName := range m.queues {
		queue, err := m.ch.QueueInspect(queueName)
		if err != nil {
			m.log.Warn("failed to inspect notification queue",
				zap.String("queue", queueName),
				zap.Error(err),
			)
			continue
		}

		monitoring.SetQueueDepth(queueName, queue.Messages)
		monitoring.SetQueueConsumers(queueName, queue.Consumers)
	}
}

func DeclareQueues(ch *amqp.Channel, retryDelay time.Duration) error {
	if ch == nil {
		return fmt.Errorf("rabbitmq channel is required")
	}

	if err := ch.ExchangeDeclare(MainExchange, "topic", true, false, false, false, nil); err != nil {
		return fmt.Errorf("failed to declare notification exchange: %w", err)
	}

	if _, err := ch.QueueDeclare(DLQQueue, true, false, false, false, nil); err != nil {
		return fmt.Errorf("failed to declare notification dlq: %w", err)
	}

	if _, err := ch.QueueDeclare(MainQueue, true, false, false, false, amqp.Table{
		"x-dead-letter-exchange":    "",
		"x-dead-letter-routing-key": DLQQueue,
	}); err != nil {
		return fmt.Errorf("failed to declare notification main queue: %w", err)
	}

	if _, err := ch.QueueDeclare(RetryQueue, true, false, false, false, amqp.Table{
		"x-dead-letter-exchange":    "",
		"x-dead-letter-routing-key": MainQueue,
		"x-message-ttl":             int(retryDelay / time.Millisecond),
	}); err != nil {
		return fmt.Errorf("failed to declare notification retry queue: %w", err)
	}

	for _, key := range []string{"order.created", "order.cancelled", "payment.completed", "payment.failed", "payment.refunded"} {
		if err := ch.QueueBind(MainQueue, key, MainExchange, false, nil); err != nil {
			return fmt.Errorf("failed to bind notification queue to %s: %w", key, err)
		}
	}

	return nil
}
