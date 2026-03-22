package service

import "errors"

var (
	ErrPaymentNotFound         = errors.New("payment not found")
	ErrDuplicatePayment        = errors.New("payment already exists for this order")
	ErrOrderNotFound           = errors.New("order not found")
	ErrOrderNotPayable         = errors.New("order is not payable")
	ErrPaymentAlreadySettled   = errors.New("order is already fully paid")
	ErrInvalidPaymentAmount    = errors.New("payment amount is invalid")
	ErrRefundNotAllowed        = errors.New("payment is not refundable")
	ErrRefundAmountExceeded    = errors.New("refund amount exceeds refundable balance")
	ErrInvalidWebhookSignature = errors.New("invalid webhook signature")
	ErrPaymentAmountMismatch   = errors.New("payment amount does not match pending request")
)
