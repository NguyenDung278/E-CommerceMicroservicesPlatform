package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/model"
)

type PaymentRepository interface {
	Create(ctx context.Context, payment *model.Payment, outbox *model.OutboxMessage) error
	GetByID(ctx context.Context, id string) (*model.Payment, error)
	GetByOrderID(ctx context.Context, orderID string) (*model.Payment, error)
	GetByGatewayOrderID(ctx context.Context, gatewayOrderID string) (*model.Payment, error)
	GetByIDForUser(ctx context.Context, id, userID string) (*model.Payment, error)
	GetByOrderIDForUser(ctx context.Context, orderID, userID string) (*model.Payment, error)
	ListByOrderID(ctx context.Context, orderID string) ([]*model.Payment, error)
	ListByOrderIDForUser(ctx context.Context, orderID, userID string) ([]*model.Payment, error)
	ListByUserID(ctx context.Context, userID string) ([]*model.Payment, error)
	Update(ctx context.Context, payment *model.Payment, outbox *model.OutboxMessage) error
	ApplyWebhookResult(ctx context.Context, payment *model.Payment, inbox *model.InboxMessage, outbox *model.OutboxMessage) (bool, error)
	CreateAuditEntry(ctx context.Context, entry *model.AuditEntry) error
	ClaimPendingOutbox(ctx context.Context, limit int, leaseDuration time.Duration) ([]*model.OutboxMessage, error)
	MarkOutboxPublished(ctx context.Context, id string, publishedAt time.Time) error
	MarkOutboxFailed(ctx context.Context, id, lastError string, nextAvailableAt time.Time) error
}

type postgresPaymentRepository struct {
	db *sql.DB
}

func NewPaymentRepository(db *sql.DB) PaymentRepository {
	return &postgresPaymentRepository{db: db}
}

func (r *postgresPaymentRepository) Create(ctx context.Context, payment *model.Payment, outbox *model.OutboxMessage) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin payment create transaction: %w", err)
	}
	defer tx.Rollback()

	query := `
		INSERT INTO payments (
			id, order_id, user_id, order_total, amount, status, transaction_type, reference_payment_id,
			payment_method, gateway_provider, gateway_transaction_id, gateway_order_id, checkout_url,
			signature_verified, failure_reason, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
	`
	_, err = tx.ExecContext(ctx, query, paymentCreateArgs(payment)...)
	if err != nil {
		return fmt.Errorf("failed to create payment: %w", err)
	}
	if err := r.insertOutboxMessageTx(ctx, tx, outbox); err != nil {
		return err
	}
	return tx.Commit()
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

func (r *postgresPaymentRepository) Update(ctx context.Context, payment *model.Payment, outbox *model.OutboxMessage) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin payment update transaction: %w", err)
	}
	defer tx.Rollback()

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
	_, err = tx.ExecContext(ctx, query, paymentUpdateArgs(payment)...)
	if err != nil {
		return fmt.Errorf("failed to update payment: %w", err)
	}
	if err := r.insertOutboxMessageTx(ctx, tx, outbox); err != nil {
		return err
	}
	return tx.Commit()
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

func (r *postgresPaymentRepository) ApplyWebhookResult(
	ctx context.Context,
	payment *model.Payment,
	inbox *model.InboxMessage,
	outbox *model.OutboxMessage,
) (bool, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return false, fmt.Errorf("failed to begin webhook transaction: %w", err)
	}
	defer tx.Rollback()

	inserted, err := r.insertInboxMessageTx(ctx, tx, inbox)
	if err != nil {
		return false, err
	}
	if !inserted {
		return true, nil
	}

	result, err := tx.ExecContext(ctx, `
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
		WHERE id = $14 AND status = 'pending'
	`, paymentUpdateArgs(payment)...)
	if err != nil {
		return false, fmt.Errorf("failed to update payment from webhook: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("failed to read webhook update rows affected: %w", err)
	}
	if rowsAffected == 0 {
		if err := tx.Commit(); err != nil {
			return false, fmt.Errorf("failed to commit no-op webhook transaction: %w", err)
		}
		return false, nil
	}

	if err := r.insertOutboxMessageTx(ctx, tx, outbox); err != nil {
		return false, err
	}
	if err := tx.Commit(); err != nil {
		return false, fmt.Errorf("failed to commit webhook transaction: %w", err)
	}

	return false, nil
}

func (r *postgresPaymentRepository) ClaimPendingOutbox(ctx context.Context, limit int, leaseDuration time.Duration) ([]*model.OutboxMessage, error) {
	if limit <= 0 {
		limit = 1
	}
	leaseSeconds := int(leaseDuration / time.Second)
	if leaseSeconds <= 0 {
		leaseSeconds = 30
	}

	query := `
		WITH candidates AS (
			SELECT id
			FROM outbox_events
			WHERE published_at IS NULL
			  AND available_at <= NOW()
			ORDER BY created_at ASC
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE outbox_events AS oe
		SET attempts = oe.attempts + 1,
		    available_at = NOW() + ($2 * INTERVAL '1 second'),
		    updated_at = NOW()
		FROM candidates
		WHERE oe.id = candidates.id
		RETURNING
			oe.id,
			oe.aggregate_type,
			oe.aggregate_id,
			oe.event_type,
			oe.routing_key,
			oe.payload,
			oe.request_id,
			oe.attempts,
			oe.last_error,
			oe.available_at,
			oe.published_at,
			oe.created_at,
			oe.updated_at
	`

	rows, err := r.db.QueryContext(ctx, query, limit, leaseSeconds)
	if err != nil {
		return nil, fmt.Errorf("failed to claim payment outbox messages: %w", err)
	}
	defer rows.Close()

	var messages []*model.OutboxMessage
	for rows.Next() {
		message, err := scanOutboxMessage(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan payment outbox message: %w", err)
		}
		messages = append(messages, message)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate payment outbox messages: %w", err)
	}

	return messages, nil
}

func (r *postgresPaymentRepository) MarkOutboxPublished(ctx context.Context, id string, publishedAt time.Time) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE outbox_events
		SET published_at = $2,
		    last_error = '',
		    updated_at = $2
		WHERE id = $1
	`, id, publishedAt)
	if err != nil {
		return fmt.Errorf("failed to mark payment outbox message published: %w", err)
	}
	return nil
}

func (r *postgresPaymentRepository) MarkOutboxFailed(ctx context.Context, id, lastError string, nextAvailableAt time.Time) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE outbox_events
		SET last_error = $2,
		    available_at = $3,
		    updated_at = NOW()
		WHERE id = $1
	`, id, lastError, nextAvailableAt)
	if err != nil {
		return fmt.Errorf("failed to mark payment outbox message failed: %w", err)
	}
	return nil
}

func (r *postgresPaymentRepository) insertOutboxMessageTx(ctx context.Context, tx *sql.Tx, outbox *model.OutboxMessage) error {
	if outbox == nil {
		return nil
	}

	_, err := tx.ExecContext(ctx, `
		INSERT INTO outbox_events (
			id, aggregate_type, aggregate_id, event_type, routing_key, payload,
			request_id, attempts, last_error, available_at, published_at, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13)
	`,
		outbox.ID,
		outbox.AggregateType,
		outbox.AggregateID,
		outbox.EventType,
		outbox.RoutingKey,
		string(outbox.Payload),
		nullableString(outbox.RequestID),
		outbox.Attempts,
		outbox.LastError,
		outbox.AvailableAt,
		outbox.PublishedAt,
		outbox.CreatedAt,
		outbox.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert payment outbox message: %w", err)
	}

	return nil
}

func (r *postgresPaymentRepository) insertInboxMessageTx(ctx context.Context, tx *sql.Tx, inbox *model.InboxMessage) (bool, error) {
	if inbox == nil {
		return true, nil
	}

	result, err := tx.ExecContext(ctx, `
		INSERT INTO inbox_messages (consumer, message_id, routing_key, created_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (consumer, message_id) DO NOTHING
	`, inbox.Consumer, inbox.MessageID, inbox.RoutingKey, inbox.CreatedAt)
	if err != nil {
		return false, fmt.Errorf("failed to insert payment inbox message: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("failed to read payment inbox insert rows affected: %w", err)
	}
	return rowsAffected > 0, nil
}

type paymentScanner interface {
	Scan(dest ...any) error
}

func scanOutboxMessage(scanner paymentScanner) (*model.OutboxMessage, error) {
	message := &model.OutboxMessage{}
	var requestID sql.NullString
	var publishedAt sql.NullTime

	err := scanner.Scan(
		&message.ID,
		&message.AggregateType,
		&message.AggregateID,
		&message.EventType,
		&message.RoutingKey,
		&message.Payload,
		&requestID,
		&message.Attempts,
		&message.LastError,
		&message.AvailableAt,
		&publishedAt,
		&message.CreatedAt,
		&message.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if requestID.Valid {
		message.RequestID = requestID.String
	}
	if publishedAt.Valid {
		value := publishedAt.Time
		message.PublishedAt = &value
	}

	return message, nil
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

func paymentCreateArgs(payment *model.Payment) []any {
	return []any{
		payment.ID,
		payment.OrderID,
		payment.UserID,
		payment.OrderTotal,
		payment.Amount,
		payment.Status,
		payment.TransactionType,
		nullableString(payment.ReferencePaymentID),
		payment.PaymentMethod,
		payment.GatewayProvider,
		requiredString(payment.GatewayTransactionID),
		requiredString(payment.GatewayOrderID),
		requiredString(payment.CheckoutURL),
		payment.SignatureVerified,
		requiredString(payment.FailureReason),
		payment.CreatedAt,
		payment.UpdatedAt,
	}
}

func paymentUpdateArgs(payment *model.Payment) []any {
	return []any{
		payment.OrderTotal,
		payment.Amount,
		payment.Status,
		payment.TransactionType,
		nullableString(payment.ReferencePaymentID),
		payment.PaymentMethod,
		payment.GatewayProvider,
		requiredString(payment.GatewayTransactionID),
		requiredString(payment.GatewayOrderID),
		requiredString(payment.CheckoutURL),
		payment.SignatureVerified,
		requiredString(payment.FailureReason),
		payment.UpdatedAt,
		payment.ID,
	}
}

func requiredString(value string) string {
	return value
}
