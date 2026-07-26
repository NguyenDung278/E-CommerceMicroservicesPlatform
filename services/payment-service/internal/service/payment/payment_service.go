package service

import (
	"context"
	"strings"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/client"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/repository/payment"
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

// OrderLookup captures the order-service capabilities payment flows depend on.
type OrderLookup interface {
	GetOrder(ctx context.Context, authHeader, orderID string) (*client.Order, error)
}

// GatewaySettings gom cấu hình của mọi cổng thanh toán được hỗ trợ.
//
// Dùng struct thay vì thêm tham số vị trí để việc thêm cổng thứ ba không biến
// constructor thành một hàng chục string không tên.
type GatewaySettings struct {
	MomoSecret     string
	MomoReturnURL  string
	VNPaySecret    string
	VNPayReturnURL string
}

// PaymentService coordinates payment validation, persistence, and lifecycle
// event publication.
type PaymentService struct {
	repo        repository.PaymentRepository
	orderClient OrderLookup
	amqpCh      *amqp.Channel
	log         *zap.Logger
	gateways    map[string]PaymentGateway
}

// NewPaymentService wires the dependencies needed by payment workflows.
//
// Inputs:
//   - repo persists payments and audit entries.
//   - orderClient loads authoritative order state before charging.
//   - amqpCh publishes lifecycle events when RabbitMQ is available.
//   - log records structured diagnostics.
//   - settings cấu hình secret và return URL cho từng cổng thanh toán.
//
// Returns:
//   - a ready-to-use payment service.
//
// Edge cases:
//   - optional dependencies such as amqpCh may be nil; affected flows degrade
//     gracefully.
//   - cổng nào thiếu secret thì KHÔNG được đăng ký, nên request chọn phương thức
//     đó nhận ErrUnsupportedPaymentMethod thay vì đi vào một luồng hỏng ngầm.
//
// Side effects:
//   - none during construction.
//
// Performance:
//   - O(1); the constructor stores references only.
func NewPaymentService(
	repo repository.PaymentRepository,
	orderClient OrderLookup,
	amqpCh *amqp.Channel,
	log *zap.Logger,
	settings GatewaySettings,
) *PaymentService {
	gateways := map[string]PaymentGateway{
		"manual": newManualGateway(),
		"momo":   newMomoGateway(settings.MomoSecret, settings.MomoReturnURL),
	}
	if strings.TrimSpace(settings.VNPaySecret) != "" {
		gateways["vnpay"] = newVNPayGateway(settings.VNPaySecret, settings.VNPayReturnURL)
	}

	return &PaymentService{
		repo:        repo,
		orderClient: orderClient,
		amqpCh:      amqpCh,
		log:         log,
		gateways:    gateways,
	}
}

// gatewayFor tra cổng theo phương thức đã chuẩn hóa.
//
// Returns:
//   - implementation tương ứng.
//   - ErrUnsupportedPaymentMethod khi cổng chưa được cấu hình.
func (s *PaymentService) gatewayFor(method string) (PaymentGateway, error) {
	gateway, ok := s.gateways[method]
	if !ok {
		return nil, ErrUnsupportedPaymentMethod
	}
	return gateway, nil
}

// gatewayForProvider tra cổng theo định danh provider dùng cho luồng webhook.
func (s *PaymentService) gatewayForProvider(provider string) (PaymentGateway, error) {
	for _, gateway := range s.gateways {
		if gateway.Provider() == provider {
			return gateway, nil
		}
	}
	return nil, ErrUnsupportedPaymentMethod
}
