package service

import (
	"context"
	"errors"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"

	pb "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/proto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/repository"
)

var (
	ErrOrderNotFound           = errors.New("order not found")
	ErrEmptyOrder              = errors.New("order must contain at least one item")
	ErrProductNotFound         = errors.New("product not found")
	ErrProductUnavailable      = errors.New("product is unavailable")
	ErrInsufficientStock       = errors.New("insufficient stock")
	ErrOrderNotCancellable     = errors.New("only pending orders can be cancelled")
	ErrAdminCancelNotAllowed   = errors.New("only pending or paid orders can be cancelled manually")
	ErrInvalidOrderStatus      = errors.New("invalid order status")
	ErrCouponAlreadyExists     = errors.New("coupon code already exists")
	ErrCouponNotFound          = repository.ErrCouponNotFound
	ErrCouponInactive          = repository.ErrCouponInactive
	ErrCouponExpired           = repository.ErrCouponExpired
	ErrCouponMinimumNotMet     = repository.ErrCouponMinimumNotMet
	ErrCouponUsageLimit        = repository.ErrCouponUsageLimitReached
	ErrInvalidShippingMethod   = errors.New("invalid shipping method")
	ErrShippingAddressRequired = errors.New("shipping address is required")
)

// OrderEvent is published to RabbitMQ when an order is created or cancelled so
// downstream services can react asynchronously.
type OrderEvent struct {
	OrderID    string  `json:"order_id"`
	UserID     string  `json:"user_id"`
	UserEmail  string  `json:"user_email"`
	TotalPrice float64 `json:"total_price"`
	Status     string  `json:"status"`
	RequestID  string  `json:"request_id,omitempty"`
}

// OrderService coordinates order pricing, persistence, and event publication.
type OrderService struct {
	repo          repository.OrderRepository
	amqpCh        *amqp.Channel
	log           *zap.Logger
	productClient productCatalog
	paymentClient paymentHistorySource
}

// productCatalog describes the downstream product capabilities the order
// service needs for pricing and stock restoration.
type productCatalog interface {
	GetProduct(ctx context.Context, productID string) (*pb.Product, error)
	RestoreStock(ctx context.Context, productID string, quantity int) error
}

// paymentHistorySource describes the downstream payment lookup needed to build
// user order summaries without coupling the service to a concrete client.
type paymentHistorySource interface {
	ListPaymentHistory(ctx context.Context, authHeader string) ([]model.PaymentSummary, error)
}

type pricedOrderItem struct {
	ProductID string
	Name      string
	Price     float64
	Quantity  int
}

type pricedOrderQuote struct {
	Items             []pricedOrderItem
	SubtotalPrice     float64
	DiscountAmount    float64
	CouponCode        string
	CouponDescription string
	ShippingMethod    string
	ShippingAddress   *model.ShippingAddress
	ShippingFee       float64
	TotalPrice        float64
}

// ToPreview converts the internal pricing quote into the API-facing preview
// shape.
//
// Inputs:
//   - q contains already calculated pricing fields.
//
// Returns:
//   - a new preview instance suitable for handlers to serialize.
//
// Edge cases:
//   - nil receivers are not expected; callers build the quote first.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1) time and allocation cost for one preview object.
func (q *pricedOrderQuote) ToPreview() *model.OrderPreview {
	return &model.OrderPreview{
		SubtotalPrice:     q.SubtotalPrice,
		DiscountAmount:    q.DiscountAmount,
		CouponCode:        q.CouponCode,
		CouponDescription: q.CouponDescription,
		ShippingMethod:    q.ShippingMethod,
		ShippingFee:       q.ShippingFee,
		TotalPrice:        q.TotalPrice,
	}
}

// NewOrderService wires the dependencies required by the order domain.
//
// Inputs:
//   - repo persists order state and audit data.
//   - amqpCh publishes lifecycle events when RabbitMQ is available.
//   - log captures structured diagnostics.
//   - productClient resolves live catalog data and stock restoration.
//   - paymentClient loads payment history for summary endpoints.
//
// Returns:
//   - a ready-to-use service value.
//
// Edge cases:
//   - optional dependencies such as amqpCh or paymentClient may be nil; callers
//     must avoid code paths that require them.
//
// Side effects:
//   - none during construction.
//
// Performance:
//   - O(1); the constructor stores references only.
func NewOrderService(
	repo repository.OrderRepository,
	amqpCh *amqp.Channel,
	log *zap.Logger,
	productClient productCatalog,
	paymentClient paymentHistorySource,
) *OrderService {
	return &OrderService{
		repo:          repo,
		amqpCh:        amqpCh,
		log:           log,
		productClient: productClient,
		paymentClient: paymentClient,
	}
}
