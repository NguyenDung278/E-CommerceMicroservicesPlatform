package monitoring

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	deliveryTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "ecommerce",
		Subsystem: "notification",
		Name:      "delivery_total",
		Help:      "Total notification delivery outcomes by routing key and outcome.",
	}, []string{"routing_key", "outcome"})

	duplicateInboxTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "ecommerce",
		Subsystem: "notification",
		Name:      "duplicate_inbox_total",
		Help:      "Total duplicate notification events skipped because they were already processed.",
	}, []string{"routing_key"})

	queueDepth = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "ecommerce",
		Subsystem: "notification",
		Name:      "queue_messages",
		Help:      "Current number of messages in notification RabbitMQ queues.",
	}, []string{"queue"})

	queueConsumers = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "ecommerce",
		Subsystem: "notification",
		Name:      "queue_consumers",
		Help:      "Current number of consumers attached to notification RabbitMQ queues.",
	}, []string{"queue"})

	retryAgeSeconds = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "ecommerce",
		Subsystem: "notification",
		Name:      "retry_age_seconds",
		Help:      "Age of retried notification messages when they are observed by the worker.",
		Buckets:   []float64{5, 15, 30, 60, 120, 300, 600, 1800, 3600},
	}, []string{"routing_key"})

	oldestRetryAgeSeconds = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "ecommerce",
		Subsystem: "notification",
		Name:      "retry_oldest_age_seconds",
		Help:      "Largest retry age observed recently for each routing key.",
	}, []string{"routing_key"})
)

func ObserveDelivery(routingKey, outcome string) {
	deliveryTotal.WithLabelValues(normalize(routingKey), normalize(outcome)).Inc()
}

func ObserveDuplicate(routingKey string) {
	duplicateInboxTotal.WithLabelValues(normalize(routingKey)).Inc()
}

func ObserveRetryAge(routingKey string, age time.Duration) {
	seconds := age.Seconds()
	label := normalize(routingKey)
	retryAgeSeconds.WithLabelValues(label).Observe(seconds)
	oldestRetryAgeSeconds.WithLabelValues(label).Set(seconds)
}

func SetQueueDepth(queue string, messages int) {
	queueDepth.WithLabelValues(normalize(queue)).Set(float64(messages))
}

func SetQueueConsumers(queue string, consumers int) {
	queueConsumers.WithLabelValues(normalize(queue)).Set(float64(consumers))
}

func normalize(value string) string {
	if value == "" {
		return "unknown"
	}
	return value
}
