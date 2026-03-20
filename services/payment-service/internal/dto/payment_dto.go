package dto

// ProcessPaymentRequest is the request body for processing a payment.
type ProcessPaymentRequest struct {
	OrderID       string `json:"order_id" validate:"required"`
	PaymentMethod string  `json:"payment_method" validate:"required"`
}
