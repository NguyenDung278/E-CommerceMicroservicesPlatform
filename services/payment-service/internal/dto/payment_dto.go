package dto

// ProcessPaymentRequest is the request body for processing a payment.
type ProcessPaymentRequest struct {
	OrderID       string  `json:"order_id" validate:"required"`
	Amount        float64 `json:"amount" validate:"gt=0"`
	PaymentMethod string  `json:"payment_method" validate:"required"`
}
