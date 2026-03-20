package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/model"
)

type PaymentRepository interface {
	Create(ctx context.Context, payment *model.Payment) error
	GetByID(ctx context.Context, id string) (*model.Payment, error)
	GetByOrderID(ctx context.Context, orderID string) (*model.Payment, error)
	GetByIDForUser(ctx context.Context, id, userID string) (*model.Payment, error)
	GetByOrderIDForUser(ctx context.Context, orderID, userID string) (*model.Payment, error)
	UpdateStatus(ctx context.Context, id string, status model.PaymentStatus) error
}

type postgresPaymentRepository struct {
	db *sql.DB
}

func NewPaymentRepository(db *sql.DB) PaymentRepository {
	return &postgresPaymentRepository{db: db}
}

func (r *postgresPaymentRepository) Create(ctx context.Context, payment *model.Payment) error {
	query := `
		INSERT INTO payments (id, order_id, user_id, amount, status, payment_method, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := r.db.ExecContext(ctx, query,
		payment.ID, payment.OrderID, payment.UserID, payment.Amount,
		payment.Status, payment.PaymentMethod, payment.CreatedAt, payment.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create payment: %w", err)
	}
	return nil
}

func (r *postgresPaymentRepository) GetByID(ctx context.Context, id string) (*model.Payment, error) {
	query := `SELECT id, order_id, user_id, amount, status, payment_method, created_at, updated_at FROM payments WHERE id = $1`
	payment := &model.Payment{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&payment.ID, &payment.OrderID, &payment.UserID, &payment.Amount,
		&payment.Status, &payment.PaymentMethod, &payment.CreatedAt, &payment.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get payment: %w", err)
	}
	return payment, nil
}

func (r *postgresPaymentRepository) GetByOrderID(ctx context.Context, orderID string) (*model.Payment, error) {
	query := `SELECT id, order_id, user_id, amount, status, payment_method, created_at, updated_at FROM payments WHERE order_id = $1`
	payment := &model.Payment{}
	err := r.db.QueryRowContext(ctx, query, orderID).Scan(
		&payment.ID, &payment.OrderID, &payment.UserID, &payment.Amount,
		&payment.Status, &payment.PaymentMethod, &payment.CreatedAt, &payment.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get payment by order: %w", err)
	}
	return payment, nil
}

func (r *postgresPaymentRepository) GetByIDForUser(ctx context.Context, id, userID string) (*model.Payment, error) {
	query := `SELECT id, order_id, user_id, amount, status, payment_method, created_at, updated_at FROM payments WHERE id = $1 AND user_id = $2`
	payment := &model.Payment{}
	err := r.db.QueryRowContext(ctx, query, id, userID).Scan(
		&payment.ID, &payment.OrderID, &payment.UserID, &payment.Amount,
		&payment.Status, &payment.PaymentMethod, &payment.CreatedAt, &payment.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get payment for user: %w", err)
	}
	return payment, nil
}

func (r *postgresPaymentRepository) GetByOrderIDForUser(ctx context.Context, orderID, userID string) (*model.Payment, error) {
	query := `SELECT id, order_id, user_id, amount, status, payment_method, created_at, updated_at FROM payments WHERE order_id = $1 AND user_id = $2`
	payment := &model.Payment{}
	err := r.db.QueryRowContext(ctx, query, orderID, userID).Scan(
		&payment.ID, &payment.OrderID, &payment.UserID, &payment.Amount,
		&payment.Status, &payment.PaymentMethod, &payment.CreatedAt, &payment.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get payment by order for user: %w", err)
	}
	return payment, nil
}

func (r *postgresPaymentRepository) UpdateStatus(ctx context.Context, id string, status model.PaymentStatus) error {
	query := `UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, status, id)
	if err != nil {
		return fmt.Errorf("failed to update payment status: %w", err)
	}
	return nil
}
