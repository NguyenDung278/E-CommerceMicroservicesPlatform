package dto

// ProcessPaymentRequest is the request body for processing a payment.
type ProcessPaymentRequest struct {
	OrderID       string  `json:"order_id" validate:"required"`
	PaymentMethod string  `json:"payment_method" validate:"required,oneof=manual momo credit_card digital_wallet demo"`
	Amount        float64 `json:"amount" validate:"omitempty,gt=0"`
}

type RefundPaymentRequest struct {
	Amount  float64 `json:"amount" validate:"omitempty,gt=0"`
	Message string  `json:"message" validate:"omitempty,max=255"`
}

type MomoWebhookRequest struct {
	PaymentID            string  `json:"payment_id"`
	OrderID              string  `json:"order_id"`
	GatewayOrderID       string  `json:"gateway_order_id"`
	GatewayTransactionID string  `json:"gateway_transaction_id"`
	Amount               float64 `json:"amount"`
	ResultCode           int     `json:"result_code"`
	Message              string  `json:"message"`
	Signature            string  `json:"signature"`
}
