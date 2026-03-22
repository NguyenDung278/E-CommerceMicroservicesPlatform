package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/model"
)

type PaymentRepository interface {
	Create(ctx context.Context, payment *model.Payment) error
	GetByID(ctx context.Context, id string) (*model.Payment, error)
	GetByOrderID(ctx context.Context, orderID string) (*model.Payment, error)
	GetByGatewayOrderID(ctx context.Context, gatewayOrderID string) (*model.Payment, error)
	GetByIDForUser(ctx context.Context, id, userID string) (*model.Payment, error)
	GetByOrderIDForUser(ctx context.Context, orderID, userID string) (*model.Payment, error)
	ListByOrderID(ctx context.Context, orderID string) ([]*model.Payment, error)
	ListByOrderIDForUser(ctx context.Context, orderID, userID string) ([]*model.Payment, error)
	ListByUserID(ctx context.Context, userID string) ([]*model.Payment, error)
	Update(ctx context.Context, payment *model.Payment) error
	CreateAuditEntry(ctx context.Context, entry *model.AuditEntry) error
}

type postgresPaymentRepository struct {
	db *sql.DB
}

func NewPaymentRepository(db *sql.DB) PaymentRepository {
	return &postgresPaymentRepository{db: db}
}

func (r *postgresPaymentRepository) Create(ctx context.Context, payment *model.Payment) error {
	query := `
		INSERT INTO payments (
			id, order_id, user_id, order_total, amount, status, transaction_type, reference_payment_id,
			payment_method, gateway_provider, gateway_transaction_id, gateway_order_id, checkout_url,
			signature_verified, failure_reason, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
	`
	_, err := r.db.ExecContext(ctx, query,
		payment.ID, payment.OrderID, payment.UserID, payment.OrderTotal, payment.Amount,
		payment.Status, payment.TransactionType, nullableString(payment.ReferencePaymentID),
		payment.PaymentMethod, payment.GatewayProvider, nullableString(payment.GatewayTransactionID),
		nullableString(payment.GatewayOrderID), nullableString(payment.CheckoutURL),
		payment.SignatureVerified, nullableString(payment.FailureReason), payment.CreatedAt, payment.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create payment: %w", err)
	}
	return nil
}

func (r *postgresPaymentRepository) GetByID(ctx context.Context, id string) (*model.Payment, error) {
	query := `
		SELECT id, order_id, user_id, order_total, amount, status, transaction_type, reference_payment_id,
		       payment_method, gateway_provider, gateway_transaction_id, gateway_order_id, checkout_url,
		       signature_verified, failure_reason, created_at, updated_at
		FROM payments
		WHERE id = $1
	`
	payment, err := scanPayment(r.db.QueryRowContext(ctx, query, id))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get payment: %w", err)
	}
	return payment, nil
}

func (r *postgresPaymentRepository) GetByOrderID(ctx context.Context, orderID string) (*model.Payment, error) {
	query := `
		SELECT id, order_id, user_id, order_total, amount, status, transaction_type, reference_payment_id,
		       payment_method, gateway_provider, gateway_transaction_id, gateway_order_id, checkout_url,
		       signature_verified, failure_reason, created_at, updated_at
		FROM payments
		WHERE order_id = $1
		ORDER BY created_at DESC, id DESC
		LIMIT 1
	`
	payment, err := scanPayment(r.db.QueryRowContext(ctx, query, orderID))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get payment by order: %w", err)
	}
	return payment, nil
}

func (r *postgresPaymentRepository) GetByGatewayOrderID(ctx context.Context, gatewayOrderID string) (*model.Payment, error) {
	query := `
		SELECT id, order_id, user_id, order_total, amount, status, transaction_type, reference_payment_id,
		       payment_method, gateway_provider, gateway_transaction_id, gateway_order_id, checkout_url,
		       signature_verified, failure_reason, created_at, updated_at
		FROM payments
		WHERE gateway_order_id = $1
		ORDER BY created_at DESC, id DESC
		LIMIT 1
	`
	payment, err := scanPayment(r.db.QueryRowContext(ctx, query, gatewayOrderID))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get payment by gateway order: %w", err)
	}
	return payment, nil
}

func (r *postgresPaymentRepository) GetByIDForUser(ctx context.Context, id, userID string) (*model.Payment, error) {
	query := `
		SELECT id, order_id, user_id, order_total, amount, status, transaction_type, reference_payment_id,
		       payment_method, gateway_provider, gateway_transaction_id, gateway_order_id, checkout_url,
		       signature_verified, failure_reason, created_at, updated_at
		FROM payments
		WHERE id = $1 AND user_id = $2
	`
	payment, err := scanPayment(r.db.QueryRowContext(ctx, query, id, userID))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get payment for user: %w", err)
	}
	return payment, nil
}

func (r *postgresPaymentRepository) GetByOrderIDForUser(ctx context.Context, orderID, userID string) (*model.Payment, error) {
	query := `
		SELECT id, order_id, user_id, order_total, amount, status, transaction_type, reference_payment_id,
		       payment_method, gateway_provider, gateway_transaction_id, gateway_order_id, checkout_url,
		       signature_verified, failure_reason, created_at, updated_at
		FROM payments
		WHERE order_id = $1 AND user_id = $2
		ORDER BY created_at DESC, id DESC
		LIMIT 1
	`
	payment, err := scanPayment(r.db.QueryRowContext(ctx, query, orderID, userID))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get payment by order for user: %w", err)
	}
	return payment, nil
}

func (r *postgresPaymentRepository) ListByOrderID(ctx context.Context, orderID string) ([]*model.Payment, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, order_id, user_id, order_total, amount, status, transaction_type, reference_payment_id,
		       payment_method, gateway_provider, gateway_transaction_id, gateway_order_id, checkout_url,
		       signature_verified, failure_reason, created_at, updated_at
		FROM payments
		WHERE order_id = $1
		ORDER BY created_at DESC, id DESC
	`, orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to list payments by order: %w", err)
	}
	defer rows.Close()

	return scanPayments(rows)
}

func (r *postgresPaymentRepository) ListByOrderIDForUser(ctx context.Context, orderID, userID string) ([]*model.Payment, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, order_id, user_id, order_total, amount, status, transaction_type, reference_payment_id,
		       payment_method, gateway_provider, gateway_transaction_id, gateway_order_id, checkout_url,
		       signature_verified, failure_reason, created_at, updated_at
		FROM payments
		WHERE order_id = $1 AND user_id = $2
		ORDER BY created_at DESC, id DESC
	`, orderID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list payments by order for user: %w", err)
	}
	defer rows.Close()

	return scanPayments(rows)
}

func (r *postgresPaymentRepository) ListByUserID(ctx context.Context, userID string) ([]*model.Payment, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, order_id, user_id, order_total, amount, status, transaction_type, reference_payment_id,
		       payment_method, gateway_provider, gateway_transaction_id, gateway_order_id, checkout_url,
		       signature_verified, failure_reason, created_at, updated_at
		FROM payments
		WHERE user_id = $1
		ORDER BY created_at DESC, id DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list payments by user: %w", err)
	}
	defer rows.Close()

	return scanPayments(rows)
}

func (r *postgresPaymentRepository) Update(ctx context.Context, payment *model.Payment) error {
	query := `
		UPDATE payments
		SET order_total = $1,
		    amount = $2,
		    status = $3,
		    transaction_type = $4,
		    reference_payment_id = $5,
		    payment_method = $6,
		    gateway_provider = $7,
		    gateway_transaction_id = $8,
		    gateway_order_id = $9,
		    checkout_url = $10,
		    signature_verified = $11,
		    failure_reason = $12,
		    updated_at = $13
		WHERE id = $14
	`
	_, err := r.db.ExecContext(ctx, query,
		payment.OrderTotal,
		payment.Amount,
		payment.Status,
		payment.TransactionType,
		nullableString(payment.ReferencePaymentID),
		payment.PaymentMethod,
		payment.GatewayProvider,
		nullableString(payment.GatewayTransactionID),
		nullableString(payment.GatewayOrderID),
		nullableString(payment.CheckoutURL),
		payment.SignatureVerified,
		nullableString(payment.FailureReason),
		payment.UpdatedAt,
		payment.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update payment: %w", err)
	}
	return nil
}

func (r *postgresPaymentRepository) CreateAuditEntry(ctx context.Context, entry *model.AuditEntry) error {
	query := `
		INSERT INTO audit_entries (id, entity_type, entity_id, action, actor_id, actor_role, metadata, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
	`

	metadata, err := json.Marshal(entry.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal audit metadata: %w", err)
	}

	_, err = r.db.ExecContext(ctx, query,
		entry.ID,
		entry.EntityType,
		entry.EntityID,
		entry.Action,
		nullableString(entry.ActorID),
		nullableString(entry.ActorRole),
		string(metadata),
		entry.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create audit entry: %w", err)
	}

	return nil
}

type paymentScanner interface {
	Scan(dest ...any) error
}

func scanPayment(scanner paymentScanner) (*model.Payment, error) {
	payment := &model.Payment{}
	var referencePaymentID sql.NullString
	var gatewayTransactionID sql.NullString
	var gatewayOrderID sql.NullString
	var checkoutURL sql.NullString
	var failureReason sql.NullString

	err := scanner.Scan(
		&payment.ID,
		&payment.OrderID,
		&payment.UserID,
		&payment.OrderTotal,
		&payment.Amount,
		&payment.Status,
		&payment.TransactionType,
		&referencePaymentID,
		&payment.PaymentMethod,
		&payment.GatewayProvider,
		&gatewayTransactionID,
		&gatewayOrderID,
		&checkoutURL,
		&payment.SignatureVerified,
		&failureReason,
		&payment.CreatedAt,
		&payment.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if referencePaymentID.Valid {
		payment.ReferencePaymentID = referencePaymentID.String
	}
	if gatewayTransactionID.Valid {
		payment.GatewayTransactionID = gatewayTransactionID.String
	}
	if gatewayOrderID.Valid {
		payment.GatewayOrderID = gatewayOrderID.String
	}
	if checkoutURL.Valid {
		payment.CheckoutURL = checkoutURL.String
	}
	if failureReason.Valid {
		payment.FailureReason = failureReason.String
	}

	return payment, nil
}

func scanPayments(rows *sql.Rows) ([]*model.Payment, error) {
	var payments []*model.Payment
	for rows.Next() {
		payment, err := scanPayment(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan payment: %w", err)
		}
		payments = append(payments, payment)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate payments: %w", err)
	}
	return payments, nil
}

func nullableString(value string) any {
	if value == "" {
		return nil
	}
	return value
}
