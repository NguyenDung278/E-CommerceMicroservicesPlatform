package service

import "errors"

var (
	ErrPaymentNotFound  = errors.New("payment not found")
	ErrDuplicatePayment = errors.New("payment already exists for this order")
	ErrOrderNotFound    = errors.New("order not found")
)
