package model

import paymentmodel "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/model/payment"

type PaymentStatus = paymentmodel.PaymentStatus
type PaymentTransactionType = paymentmodel.PaymentTransactionType

const (
	PaymentStatusPending   = paymentmodel.PaymentStatusPending
	PaymentStatusCompleted = paymentmodel.PaymentStatusCompleted
	PaymentStatusFailed    = paymentmodel.PaymentStatusFailed
	PaymentStatusRefunded  = paymentmodel.PaymentStatusRefunded
)

const (
	PaymentTransactionTypeCharge = paymentmodel.PaymentTransactionTypeCharge
	PaymentTransactionTypeRefund = paymentmodel.PaymentTransactionTypeRefund
)

type Payment = paymentmodel.Payment
type AuditEntry = paymentmodel.AuditEntry
type OutboxMessage = paymentmodel.OutboxMessage
type InboxMessage = paymentmodel.InboxMessage
type PaymentIdempotencyRecord = paymentmodel.PaymentIdempotencyRecord
