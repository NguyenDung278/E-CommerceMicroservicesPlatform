package handler

import (
	paymenthandler "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/handler/payment"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/service"
)

type PaymentHandler = paymenthandler.PaymentHandler

func NewPaymentHandler(paymentService *service.PaymentService) *PaymentHandler {
	return paymenthandler.NewPaymentHandler(paymentService)
}
