package service

import (
	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/repository"
	ordersvc "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/service/order"
)

var (
	ErrOrderNotFound                    = ordersvc.ErrOrderNotFound
	ErrEmptyOrder                       = ordersvc.ErrEmptyOrder
	ErrProductNotFound                  = ordersvc.ErrProductNotFound
	ErrProductUnavailable               = ordersvc.ErrProductUnavailable
	ErrInsufficientStock                = ordersvc.ErrInsufficientStock
	ErrOrderNotCancellable              = ordersvc.ErrOrderNotCancellable
	ErrAdminCancelNotAllowed            = ordersvc.ErrAdminCancelNotAllowed
	ErrInvalidOrderStatus               = ordersvc.ErrInvalidOrderStatus
	ErrInvalidIdempotencyKey            = ordersvc.ErrInvalidIdempotencyKey
	ErrIdempotencyKeyConflict           = ordersvc.ErrIdempotencyKeyConflict
	ErrInvalidOrderCursor               = ordersvc.ErrInvalidOrderCursor
	ErrCouponAlreadyExists              = ordersvc.ErrCouponAlreadyExists
	ErrCouponNotFound                   = ordersvc.ErrCouponNotFound
	ErrCouponInactive                   = ordersvc.ErrCouponInactive
	ErrCouponExpired                    = ordersvc.ErrCouponExpired
	ErrCouponMinimumNotMet              = ordersvc.ErrCouponMinimumNotMet
	ErrCouponUsageLimit                 = ordersvc.ErrCouponUsageLimit
	ErrInvalidShippingMethod            = ordersvc.ErrInvalidShippingMethod
	ErrShippingAddressRequired          = ordersvc.ErrShippingAddressRequired
	ErrReturnNotFound                   = ordersvc.ErrReturnNotFound
	ErrReturnReasonRequired             = ordersvc.ErrReturnReasonRequired
	ErrReturnItemsRequired              = ordersvc.ErrReturnItemsRequired
	ErrReturnNotAllowed                 = ordersvc.ErrReturnNotAllowed
	ErrReturnOrderItemNotFound          = ordersvc.ErrReturnOrderItemNotFound
	ErrReturnQuantityExceeded           = ordersvc.ErrReturnQuantityExceeded
	ErrDuplicateReturnItem              = ordersvc.ErrDuplicateReturnItem
	ErrInvalidReturnStatus              = ordersvc.ErrInvalidReturnStatus
	ErrReturnStatusTransition           = ordersvc.ErrReturnStatusTransition
	ErrReturnRefundUnavailable          = ordersvc.ErrReturnRefundUnavailable
	ErrReturnRefundAmount               = ordersvc.ErrReturnRefundAmount
	ErrReturnRefundPending              = ordersvc.ErrReturnRefundPending
	ErrReturnEvidenceRequired           = ordersvc.ErrReturnEvidenceRequired
	ErrReturnEvidenceClosed             = ordersvc.ErrReturnEvidenceClosed
	ErrReturnEvidenceStorageUnavailable = ordersvc.ErrReturnEvidenceStorageUnavailable
)

type OrderEvent = ordersvc.OrderEvent
type ReturnLifecycleEvent = ordersvc.ReturnLifecycleEvent
type PaymentLifecycleEvent = ordersvc.PaymentLifecycleEvent
type ProductCatalog = ordersvc.ProductCatalog
type PaymentHistorySource = ordersvc.PaymentHistorySource
type ReturnEvidenceStore = ordersvc.ReturnEvidenceStore
type OrderService = ordersvc.OrderService

func NewOrderService(
	repo repository.OrderRepository,
	amqpCh *amqp.Channel,
	log *zap.Logger,
	productClient ProductCatalog,
	paymentClient PaymentHistorySource,
) *OrderService {
	return ordersvc.NewOrderService(repo, amqpCh, log, productClient, paymentClient)
}

func SetupExchange(ch *amqp.Channel) error {
	return ordersvc.SetupExchange(ch)
}

func StartPaymentEventConsumer(ch *amqp.Channel, log *zap.Logger, service *OrderService) error {
	return ordersvc.StartPaymentEventConsumer(ch, log, service)
}
