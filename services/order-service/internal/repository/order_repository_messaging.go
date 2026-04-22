package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

func (r *postgresOrderRepository) ClaimPendingOutbox(ctx context.Context, limit int, leaseDuration time.Duration) ([]*model.OutboxMessage, error) {
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
		return nil, fmt.Errorf("failed to claim outbox messages: %w", err)
	}
	defer rows.Close()

	var messages []*model.OutboxMessage
	for rows.Next() {
		message, err := scanOutboxMessage(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan claimed outbox message: %w", err)
		}
		messages = append(messages, message)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate claimed outbox messages: %w", err)
	}

	return messages, nil
}

func (r *postgresOrderRepository) MarkOutboxPublished(ctx context.Context, id string, publishedAt time.Time) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE outbox_events
		SET published_at = $2,
		    last_error = '',
		    updated_at = $2
		WHERE id = $1
	`, id, publishedAt)
	if err != nil {
		return fmt.Errorf("failed to mark outbox message published: %w", err)
	}

	return nil
}

func (r *postgresOrderRepository) MarkOutboxFailed(ctx context.Context, id, lastError string, nextAvailableAt time.Time) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE outbox_events
		SET last_error = $2,
		    available_at = $3,
		    updated_at = NOW()
		WHERE id = $1
	`, id, lastError, nextAvailableAt)
	if err != nil {
		return fmt.Errorf("failed to mark outbox message failed: %w", err)
	}

	return nil
}

func (r *postgresOrderRepository) ApplyInboxStatusTransition(
	ctx context.Context,
	inbox *model.InboxMessage,
	orderID string,
	expectedCurrent model.OrderStatus,
	nextStatus model.OrderStatus,
	actorID, actorRole, message string,
) (*model.InboxTransitionResult, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin inbox transition transaction: %w", err)
	}
	defer tx.Rollback()

	inserted, err := r.insertInboxMessageTx(ctx, tx, inbox)
	if err != nil {
		return nil, err
	}
	if !inserted {
		return &model.InboxTransitionResult{Duplicate: true}, nil
	}

	var currentStatus model.OrderStatus
	if err := tx.QueryRowContext(ctx, `SELECT status FROM orders WHERE id = $1 FOR UPDATE`, orderID).Scan(&currentStatus); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			if err := tx.Commit(); err != nil {
				return nil, fmt.Errorf("failed to commit inbox miss: %w", err)
			}
			return &model.InboxTransitionResult{OrderFound: false}, nil
		}
		return nil, fmt.Errorf("failed to lock order for inbox transition: %w", err)
	}

	result := &model.InboxTransitionResult{
		OrderFound:     true,
		PreviousStatus: currentStatus,
	}
	if currentStatus == nextStatus {
		if err := tx.Commit(); err != nil {
			return nil, fmt.Errorf("failed to commit no-op inbox transition: %w", err)
		}
		return result, nil
	}
	if expectedCurrent != "" && currentStatus != expectedCurrent {
		if err := tx.Commit(); err != nil {
			return nil, fmt.Errorf("failed to commit unmatched inbox transition: %w", err)
		}
		return result, nil
	}

	updateResult, err := tx.ExecContext(ctx, `
		UPDATE orders
		SET status = CAST($1 AS VARCHAR(20)),
		    reservation_expires_at = CASE
		        WHEN CAST($1 AS VARCHAR(20)) IN ('paid', 'cancelled', 'refunded') THEN NULL
		        ELSE reservation_expires_at
		    END,
		    reservation_allocated_at = CASE
		        WHEN CAST($1 AS VARCHAR(20)) = 'paid' THEN COALESCE(reservation_allocated_at, NOW())
		        WHEN CAST($1 AS VARCHAR(20)) = 'cancelled' THEN NULL
		        ELSE reservation_allocated_at
		    END,
		    updated_at = NOW()
		WHERE id = $2
	`, nextStatus, orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to update order status from inbox event: %w", err)
	}
	rowsAffected, err := updateResult.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("failed to read inbox update rows affected: %w", err)
	}
	if rowsAffected == 0 {
		if err := tx.Commit(); err != nil {
			return nil, fmt.Errorf("failed to commit empty inbox transition: %w", err)
		}
		return result, nil
	}

	if strings.TrimSpace(message) == "" {
		message = fmt.Sprintf("order status changed to %s", nextStatus)
	}
	if err := r.insertOrderEventTx(ctx, tx, &model.OrderEvent{
		ID:        uuid.New().String(),
		OrderID:   orderID,
		Type:      "status_changed",
		Status:    nextStatus,
		ActorID:   actorID,
		ActorRole: actorRole,
		Message:   message,
		CreatedAt: time.Now(),
	}); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit inbox transition: %w", err)
	}

	result.Transitioned = true
	return result, nil
}

func (r *postgresOrderRepository) insertOutboxMessageTx(ctx context.Context, tx *sql.Tx, outbox *model.OutboxMessage) error {
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
		nullIfEmpty(outbox.RequestID),
		outbox.Attempts,
		outbox.LastError,
		outbox.AvailableAt,
		outbox.PublishedAt,
		outbox.CreatedAt,
		outbox.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert outbox message: %w", err)
	}

	return nil
}

func (r *postgresOrderRepository) insertInboxMessageTx(ctx context.Context, tx *sql.Tx, inbox *model.InboxMessage) (bool, error) {
	if inbox == nil {
		return true, nil
	}

	result, err := tx.ExecContext(ctx, `
		INSERT INTO inbox_messages (consumer, message_id, routing_key, created_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (consumer, message_id) DO NOTHING
	`, inbox.Consumer, inbox.MessageID, inbox.RoutingKey, inbox.CreatedAt)
	if err != nil {
		return false, fmt.Errorf("failed to insert inbox message: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("failed to read inbox insert rows affected: %w", err)
	}

	return rowsAffected > 0, nil
}
