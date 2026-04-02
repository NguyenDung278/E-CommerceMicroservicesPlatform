package service

import (
	"context"
	"strings"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/client"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/repository"
)

// PaymentEvent is published to RabbitMQ after payment processing.
type PaymentEvent struct {
	EventID            string  `json:"event_id"`
	PaymentID          string  `json:"payment_id"`
	OrderID            string  `json:"order_id"`
	UserID             string  `json:"user_id"`
	UserEmail          string  `json:"user_email"`
	Amount             float64 `json:"amount"`
	Status             string  `json:"status"`
	TransactionType    string  `json:"transaction_type"`
	NetPaidAmount      float64 `json:"net_paid_amount"`
	OutstandingAmount  float64 `json:"outstanding_amount"`
	FullyPaid          bool    `json:"fully_paid"`
	FullyRefunded      bool    `json:"fully_refunded"`
	GatewayProvider    string  `json:"gateway_provider"`
	GatewayTransaction string  `json:"gateway_transaction_id,omitempty"`
	RequestID          string  `json:"request_id,omitempty"`
}

// orderLookup captures the order-service capabilities payment flows depend on.
type orderLookup interface {
	GetOrder(ctx context.Context, authHeader, orderID string) (*client.Order, error)
}

// PaymentService coordinates payment validation, persistence, and lifecycle
// event publication.
type PaymentService struct {
	repo          repository.PaymentRepository
	orderClient   orderLookup
	amqpCh        *amqp.Channel
	log           *zap.Logger
	webhookSecret string
	momoReturnURL string
}

// NewPaymentService wires the dependencies needed by payment workflows.
//
// Inputs:
//   - repo persists payments and audit entries.
//   - orderClient loads authoritative order state before charging.
//   - amqpCh publishes lifecycle events when RabbitMQ is available.
//   - log records structured diagnostics.
//   - webhookSecret verifies MoMo webhook signatures.
//   - momoReturnURL seeds simulated checkout URLs for pending wallet payments.
//
// Returns:
//   - a ready-to-use payment service.
//
// Edge cases:
//   - optional dependencies such as amqpCh may be nil; affected flows degrade
//     gracefully.
//
// Side effects:
//   - none during construction.
//
// Performance:
//   - O(1); the constructor stores references only.
func NewPaymentService(
	repo repository.PaymentRepository,
	orderClient orderLookup,
	amqpCh *amqp.Channel,
	log *zap.Logger,
	webhookSecret string,
	momoReturnURL string,
) *PaymentService {
	return &PaymentService{
		repo:          repo,
		orderClient:   orderClient,
		amqpCh:        amqpCh,
		log:           log,
		webhookSecret: strings.TrimSpace(webhookSecret),
		momoReturnURL: strings.TrimSpace(momoReturnURL),
	}
}
