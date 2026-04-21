package service

import (
	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/repository"
	paymentsvc "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/service/payment"
)

var (
	ErrPaymentNotFound          = paymentsvc.ErrPaymentNotFound
	ErrDuplicatePayment         = paymentsvc.ErrDuplicatePayment
	ErrOrderNotFound            = paymentsvc.ErrOrderNotFound
	ErrOrderNotPayable          = paymentsvc.ErrOrderNotPayable
	ErrPaymentAlreadySettled    = paymentsvc.ErrPaymentAlreadySettled
	ErrInvalidPaymentAmount     = paymentsvc.ErrInvalidPaymentAmount
	ErrUnsupportedPaymentMethod = paymentsvc.ErrUnsupportedPaymentMethod
	ErrInvalidIdempotencyKey    = paymentsvc.ErrInvalidIdempotencyKey
	ErrIdempotencyKeyConflict   = paymentsvc.ErrIdempotencyKeyConflict
	ErrRefundNotAllowed         = paymentsvc.ErrRefundNotAllowed
	ErrRefundAmountExceeded     = paymentsvc.ErrRefundAmountExceeded
	ErrInvalidWebhookSignature  = paymentsvc.ErrInvalidWebhookSignature
	ErrPaymentAmountMismatch    = paymentsvc.ErrPaymentAmountMismatch
)

type PaymentEvent = paymentsvc.PaymentEvent
type OrderLookup = paymentsvc.OrderLookup
type PaymentService = paymentsvc.PaymentService

func NewPaymentService(
	repo repository.PaymentRepository,
	orderClient OrderLookup,
	amqpCh *amqp.Channel,
	log *zap.Logger,
	webhookSecret string,
	momoReturnURL string,
) *PaymentService {
	return paymentsvc.NewPaymentService(repo, orderClient, amqpCh, log, webhookSecret, momoReturnURL)
}
