package model

import (
	"io"
	"time"
)

type ReturnStatus string

const (
	ReturnStatusRequested     ReturnStatus = "requested"
	ReturnStatusApproved      ReturnStatus = "approved"
	ReturnStatusRejected      ReturnStatus = "rejected"
	ReturnStatusReceived      ReturnStatus = "received"
	ReturnStatusRefundPending ReturnStatus = "refund_pending"
	ReturnStatusRefunded      ReturnStatus = "refunded"
	ReturnStatusCancelled     ReturnStatus = "cancelled"
)

type ReturnRequest struct {
	ID                      string           `json:"id"`
	OrderID                 string           `json:"order_id"`
	UserID                  string           `json:"user_id"`
	UserEmail               string           `json:"user_email,omitempty"`
	Status                  ReturnStatus     `json:"status"`
	Reason                  string           `json:"reason"`
	Items                   []ReturnItem     `json:"items"`
	Events                  []ReturnEvent    `json:"events,omitempty"`
	Evidence                []ReturnEvidence `json:"evidence,omitempty"`
	RefundAmount            float64          `json:"refund_amount,omitempty"`
	RefundChargePaymentID   string           `json:"refund_charge_payment_id,omitempty"`
	RefundPaymentID         string           `json:"refund_payment_id,omitempty"`
	RefundLastError         string           `json:"refund_last_error,omitempty"`
	RefundAttemptCount      int              `json:"refund_attempt_count,omitempty"`
	RefundRequestedAt       *time.Time       `json:"refund_requested_at,omitempty"`
	RefundCompletedAt       *time.Time       `json:"refund_completed_at,omitempty"`
	RefundNextRetryAt       *time.Time       `json:"refund_next_retry_at,omitempty"`
	RefundIdempotencyKey    string           `json:"-"`
	RefundProcessingStarted *time.Time       `json:"-"`
	CreatedAt               time.Time        `json:"created_at"`
	UpdatedAt               time.Time        `json:"updated_at"`
}

type ReturnItem struct {
	ID          string    `json:"id"`
	ReturnID    string    `json:"return_id"`
	OrderItemID string    `json:"order_item_id"`
	ProductID   string    `json:"product_id"`
	Quantity    int       `json:"quantity"`
	Reason      string    `json:"reason,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ReturnEvent struct {
	ID        string       `json:"id"`
	ReturnID  string       `json:"return_id"`
	Status    ReturnStatus `json:"status"`
	ActorID   string       `json:"actor_id,omitempty"`
	ActorRole string       `json:"actor_role,omitempty"`
	Message   string       `json:"message"`
	CreatedAt time.Time    `json:"created_at"`
}

type ReturnEvidence struct {
	ID             string    `json:"id"`
	ReturnID       string    `json:"return_id"`
	FileName       string    `json:"file_name"`
	ContentType    string    `json:"content_type"`
	SizeBytes      int64     `json:"size_bytes"`
	URL            string    `json:"url"`
	UploadedBy     string    `json:"uploaded_by,omitempty"`
	UploadedByRole string    `json:"uploaded_by_role,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	StorageKey     string    `json:"-"`
}

type ReturnEvidenceUpload struct {
	FileName    string
	ContentType string
	Size        int64
	Reader      io.Reader
}

type ReturnFilters struct {
	UserID string
	Query  string
	Status ReturnStatus
	Page   int
	Limit  int
}

type ReturnQueueFailure struct {
	ReturnID     string     `json:"return_id"`
	OrderID      string     `json:"order_id"`
	UserID       string     `json:"user_id"`
	LastError    string     `json:"last_error"`
	AttemptCount int        `json:"attempt_count"`
	NextRetryAt  *time.Time `json:"next_retry_at,omitempty"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type ReturnQueueHealth struct {
	PendingCount        int                  `json:"pending_count"`
	ReadyNowCount       int                  `json:"ready_now_count"`
	InFlightCount       int                  `json:"in_flight_count"`
	RetryScheduledCount int                  `json:"retry_scheduled_count"`
	FailedAttemptCount  int                  `json:"failed_attempt_count"`
	MaxAttemptCount     int                  `json:"max_attempt_count"`
	OldestPendingAt     *time.Time           `json:"oldest_pending_at,omitempty"`
	NextRetryAt         *time.Time           `json:"next_retry_at,omitempty"`
	RecentFailures      []ReturnQueueFailure `json:"recent_failures,omitempty"`
}
