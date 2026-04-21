package repository

import (
	"database/sql"

	paymentrepo "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/repository/payment"
)

type PaymentRepository = paymentrepo.PaymentRepository

func NewPaymentRepository(db *sql.DB) PaymentRepository {
	return paymentrepo.NewPaymentRepository(db)
}
