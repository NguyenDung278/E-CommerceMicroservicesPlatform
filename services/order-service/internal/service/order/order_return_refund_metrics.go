package service

import (
	"context"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

const returnRefundMonitorInterval = 15 * time.Second

var (
	returnRefundQueueGauge = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "ecommerce",
		Subsystem: "order",
		Name:      "return_refund_queue_jobs",
		Help:      "Current refund_pending queue counts grouped by state.",
	}, []string{"state"})

	returnRefundQueueOldestAgeGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "ecommerce",
		Subsystem: "order",
		Name:      "return_refund_queue_oldest_age_seconds",
		Help:      "Age in seconds of the oldest refund_pending return.",
	})

	returnRefundQueueNextRetryDelayGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "ecommerce",
		Subsystem: "order",
		Name:      "return_refund_queue_next_retry_delay_seconds",
		Help:      "Seconds until the next scheduled refund_pending retry.",
	})

	returnRefundQueueMaxAttemptGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "ecommerce",
		Subsystem: "order",
		Name:      "return_refund_queue_max_attempt_count",
		Help:      "Highest retry attempt count observed in the refund_pending queue.",
	})

	returnRefundQueueStaleInFlightGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "ecommerce",
		Subsystem: "order",
		Name:      "return_refund_queue_stale_in_flight_jobs",
		Help:      "Number of refund_pending jobs whose worker lease appears stale.",
	})

	returnRefundQueueLongestInFlightAgeGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "ecommerce",
		Subsystem: "order",
		Name:      "return_refund_queue_longest_in_flight_age_seconds",
		Help:      "Age in seconds of the longest-running in-flight refund job.",
	})

	returnRefundAttemptTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "ecommerce",
		Subsystem: "order",
		Name:      "return_refund_attempt_total",
		Help:      "Total number of asynchronous return refund attempts by outcome.",
	}, []string{"outcome"})

	returnRefundAttemptDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "ecommerce",
		Subsystem: "order",
		Name:      "return_refund_attempt_duration_seconds",
		Help:      "Latency of asynchronous return refund attempts by outcome.",
		Buckets:   prometheus.DefBuckets,
	}, []string{"outcome"})
)

func (s *OrderService) StartReturnRefundQueueMonitor(ctx context.Context) {
	ticker := time.NewTicker(returnRefundMonitorInterval)
	defer ticker.Stop()

	for {
		s.refreshReturnRefundQueueMetrics(ctx)

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (s *OrderService) refreshReturnRefundQueueMetrics(ctx context.Context) {
	health, err := s.repo.GetReturnQueueHealth(ctx)
	if err != nil {
		if ctx.Err() == nil {
			s.log.Warn("failed to refresh return refund queue metrics", zap.Error(err))
		}
		return
	}
	recordReturnRefundQueueHealth(health, time.Now())
}

func observeReturnRefundAttempt(outcome string, duration time.Duration) {
	returnRefundAttemptTotal.WithLabelValues(outcome).Inc()
	returnRefundAttemptDuration.WithLabelValues(outcome).Observe(duration.Seconds())
}

func recordReturnRefundQueueHealth(health *model.ReturnQueueHealth, measuredAt time.Time) {
	if health == nil {
		returnRefundQueueGauge.WithLabelValues("pending").Set(0)
		returnRefundQueueGauge.WithLabelValues("ready_now").Set(0)
		returnRefundQueueGauge.WithLabelValues("in_flight").Set(0)
		returnRefundQueueGauge.WithLabelValues("retry_scheduled").Set(0)
		returnRefundQueueGauge.WithLabelValues("failed").Set(0)
		returnRefundQueueGauge.WithLabelValues("ready_with_failures").Set(0)
		returnRefundQueueOldestAgeGauge.Set(0)
		returnRefundQueueNextRetryDelayGauge.Set(0)
		returnRefundQueueMaxAttemptGauge.Set(0)
		returnRefundQueueStaleInFlightGauge.Set(0)
		returnRefundQueueLongestInFlightAgeGauge.Set(0)
		return
	}

	returnRefundQueueGauge.WithLabelValues("pending").Set(float64(health.PendingCount))
	returnRefundQueueGauge.WithLabelValues("ready_now").Set(float64(health.ReadyNowCount))
	returnRefundQueueGauge.WithLabelValues("ready_with_failures").Set(float64(health.ReadyWithFailuresCount))
	returnRefundQueueGauge.WithLabelValues("in_flight").Set(float64(health.InFlightCount))
	returnRefundQueueGauge.WithLabelValues("retry_scheduled").Set(float64(health.RetryScheduledCount))
	returnRefundQueueGauge.WithLabelValues("failed").Set(float64(health.FailedAttemptCount))
	returnRefundQueueMaxAttemptGauge.Set(float64(health.MaxAttemptCount))
	returnRefundQueueStaleInFlightGauge.Set(float64(health.StaleInFlightCount))

	if health.OldestPendingAt != nil {
		returnRefundQueueOldestAgeGauge.Set(measuredAt.Sub(*health.OldestPendingAt).Seconds())
	} else {
		returnRefundQueueOldestAgeGauge.Set(0)
	}
	if health.LongestInFlightStartedAt != nil {
		returnRefundQueueLongestInFlightAgeGauge.Set(measuredAt.Sub(*health.LongestInFlightStartedAt).Seconds())
	} else {
		returnRefundQueueLongestInFlightAgeGauge.Set(0)
	}
	if health.NextRetryAt != nil {
		delay := health.NextRetryAt.Sub(measuredAt).Seconds()
		if delay < 0 {
			delay = 0
		}
		returnRefundQueueNextRetryDelayGauge.Set(delay)
	} else {
		returnRefundQueueNextRetryDelayGauge.Set(0)
	}
}
