package observability

import (
	"errors"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

const (
	OutcomeSuccess       = "success"
	OutcomeBusinessError = "business_error"
	OutcomeSystemError   = "system_error"
)

var (
	businessOperationTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "ecommerce",
		Subsystem: "business",
		Name:      "operation_total",
		Help:      "Total number of business operations by service, operation, and outcome.",
	}, []string{"service", "operation", "outcome"})

	businessOperationDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "ecommerce",
		Subsystem: "business",
		Name:      "operation_duration_seconds",
		Help:      "Latency of business operations by service, operation, and outcome.",
		Buckets:   prometheus.DefBuckets,
	}, []string{"service", "operation", "outcome"})

	stateTransitionTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "ecommerce",
		Subsystem: "business",
		Name:      "state_transition_total",
		Help:      "Total number of tracked entity state transitions.",
	}, []string{"service", "entity", "from", "to", "outcome"})
)

func ObserveOperation(service, operation, outcome string, duration time.Duration) {
	service = normalizeMetricLabel(service, "unknown")
	operation = normalizeMetricLabel(operation, "unknown")
	outcome = normalizeMetricLabel(outcome, OutcomeSuccess)

	businessOperationTotal.WithLabelValues(service, operation, outcome).Inc()
	businessOperationDuration.WithLabelValues(service, operation, outcome).Observe(duration.Seconds())
}

func IncEvent(service, operation, outcome string) {
	service = normalizeMetricLabel(service, "unknown")
	operation = normalizeMetricLabel(operation, "unknown")
	outcome = normalizeMetricLabel(outcome, OutcomeSuccess)

	businessOperationTotal.WithLabelValues(service, operation, outcome).Inc()
}

func RecordStateTransition(service, entity, from, to, outcome string) {
	stateTransitionTotal.WithLabelValues(
		normalizeMetricLabel(service, "unknown"),
		normalizeMetricLabel(entity, "unknown"),
		normalizeMetricLabel(from, "unknown"),
		normalizeMetricLabel(to, "unknown"),
		normalizeMetricLabel(outcome, OutcomeSuccess),
	).Inc()
}

func OutcomeFromError(err error, businessErrors ...error) string {
	if err == nil {
		return OutcomeSuccess
	}

	for _, businessErr := range businessErrors {
		if businessErr != nil && errors.Is(err, businessErr) {
			return OutcomeBusinessError
		}
	}

	return OutcomeSystemError
}

func normalizeMetricLabel(value string, fallback string) string {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	if trimmed == "" {
		return fallback
	}

	trimmed = strings.ReplaceAll(trimmed, " ", "_")
	return trimmed
}
