package repository

import (
	"testing"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/model"
)

func TestPaymentCreateArgsKeepRequiredStringsNonNil(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	payment := &model.Payment{
		ID:              "payment-1",
		OrderID:         "order-1",
		UserID:          "user-1",
		OrderTotal:      49.99,
		Amount:          49.99,
		Status:          model.PaymentStatusCompleted,
		TransactionType: model.PaymentTransactionTypeCharge,
		PaymentMethod:   "manual",
		GatewayProvider: "manual",
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	args := paymentCreateArgs(payment)

	for _, index := range []int{10, 11, 12, 14} {
		value, ok := args[index].(string)
		if !ok {
			t.Fatalf("expected arg %d to be a string, got %T", index, args[index])
		}
		if value != "" {
			t.Fatalf("expected arg %d to be an empty string, got %q", index, value)
		}
	}

	if args[7] != nil {
		t.Fatalf("expected nullable reference payment id to remain nil, got %#v", args[7])
	}
}

func TestPaymentUpdateArgsKeepRequiredStringsNonNil(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	payment := &model.Payment{
		ID:              "payment-1",
		OrderID:         "order-1",
		UserID:          "user-1",
		OrderTotal:      49.99,
		Amount:          49.99,
		Status:          model.PaymentStatusPending,
		TransactionType: model.PaymentTransactionTypeCharge,
		PaymentMethod:   "momo",
		GatewayProvider: "momo",
		UpdatedAt:       now,
	}

	args := paymentUpdateArgs(payment)

	for _, index := range []int{7, 8, 9, 11} {
		value, ok := args[index].(string)
		if !ok {
			t.Fatalf("expected arg %d to be a string, got %T", index, args[index])
		}
		if value != "" {
			t.Fatalf("expected arg %d to be an empty string, got %q", index, value)
		}
	}

	if args[4] != nil {
		t.Fatalf("expected nullable reference payment id to remain nil, got %#v", args[4])
	}
}
