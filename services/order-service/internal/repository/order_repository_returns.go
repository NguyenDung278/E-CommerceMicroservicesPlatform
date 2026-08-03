package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

func (r *postgresOrderRepository) CreateReturn(ctx context.Context, returnRequest *model.ReturnRequest, outbox *model.OutboxMessage) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin return transaction: %w", err)
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, `
		INSERT INTO returns (id, order_id, user_id, user_email, status, reason, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`,
		returnRequest.ID,
		returnRequest.OrderID,
		returnRequest.UserID,
		returnRequest.UserEmail,
		returnRequest.Status,
		returnRequest.Reason,
		returnRequest.CreatedAt,
		returnRequest.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create return: %w", err)
	}

	for _, item := range returnRequest.Items {
		_, err = tx.ExecContext(ctx, `
			INSERT INTO return_items (id, return_id, order_item_id, product_id, quantity, reason, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`,
			item.ID,
			item.ReturnID,
			item.OrderItemID,
			item.ProductID,
			item.Quantity,
			item.Reason,
			item.CreatedAt,
			item.UpdatedAt,
		)
		if err != nil {
			return fmt.Errorf("failed to create return item: %w", err)
		}
	}

	for _, event := range returnRequest.Events {
		if err := r.insertReturnEventTx(ctx, tx, &event); err != nil {
			return err
		}
	}

	if err := r.insertOutboxMessageTx(ctx, tx, outbox); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *postgresOrderRepository) GetReturnByID(ctx context.Context, id string) (*model.ReturnRequest, error) {
	returnRequest, err := scanReturn(r.db.QueryRowContext(ctx, `
		SELECT id, order_id, user_id, user_email, status, reason,
		       refund_amount, refund_charge_payment_id, refund_payment_id, refund_idempotency_key,
		       refund_last_error, refund_attempt_count, refund_requested_at, refund_completed_at,
		       refund_next_retry_at, refund_processing_started_at, created_at, updated_at
		FROM returns
		WHERE id = $1
	`, id))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get return: %w", err)
	}
	if err := r.loadReturnDetails(ctx, returnRequest); err != nil {
		return nil, err
	}

	return returnRequest, nil
}

func (r *postgresOrderRepository) ListReturnsByOrderID(ctx context.Context, orderID string) ([]*model.ReturnRequest, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, order_id, user_id, user_email, status, reason,
		       refund_amount, refund_charge_payment_id, refund_payment_id, refund_idempotency_key,
		       refund_last_error, refund_attempt_count, refund_requested_at, refund_completed_at,
		       refund_next_retry_at, refund_processing_started_at, created_at, updated_at
		FROM returns
		WHERE order_id = $1
		ORDER BY created_at DESC, id DESC
	`, orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to list returns by order: %w", err)
	}
	defer rows.Close()

	var returns []*model.ReturnRequest
	for rows.Next() {
		returnRequest, err := scanReturn(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan return: %w", err)
		}
		returns = append(returns, returnRequest)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate returns: %w", err)
	}

	for _, returnRequest := range returns {
		if err := r.loadReturnDetails(ctx, returnRequest); err != nil {
			return nil, err
		}
	}

	return returns, nil
}

func (r *postgresOrderRepository) ListReturns(ctx context.Context, filters model.ReturnFilters) ([]*model.ReturnRequest, int64, error) {
	baseQuery := `FROM returns WHERE 1=1`
	args := make([]interface{}, 0, 5)
	argIdx := 1

	if filters.UserID != "" {
		baseQuery += fmt.Sprintf(` AND user_id = $%d`, argIdx)
		args = append(args, filters.UserID)
		argIdx++
	}
	if filters.Status != "" {
		baseQuery += fmt.Sprintf(` AND status = $%d`, argIdx)
		args = append(args, filters.Status)
		argIdx++
	}
	if query := strings.TrimSpace(filters.Query); query != "" {
		baseQuery += fmt.Sprintf(` AND (
			id ILIKE $%d OR
			order_id ILIKE $%d OR
			user_id ILIKE $%d OR
			user_email ILIKE $%d OR
			reason ILIKE $%d
		)`, argIdx, argIdx, argIdx, argIdx, argIdx)
		args = append(args, "%"+query+"%")
		argIdx++
	}

	var total int64
	countQuery := `SELECT COUNT(*) ` + baseQuery
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count returns: %w", err)
	}

	selectQuery := fmt.Sprintf(`
		SELECT id, order_id, user_id, user_email, status, reason,
		       refund_amount, refund_charge_payment_id, refund_payment_id, refund_idempotency_key,
		       refund_last_error, refund_attempt_count, refund_requested_at, refund_completed_at,
		       refund_next_retry_at, refund_processing_started_at, created_at, updated_at
		%s
		ORDER BY created_at DESC, id DESC
		LIMIT $%d OFFSET $%d
	`, baseQuery, argIdx, argIdx+1)
	args = append(args, filters.Limit, (filters.Page-1)*filters.Limit)

	rows, err := r.db.QueryContext(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list returns: %w", err)
	}
	defer rows.Close()

	var returns []*model.ReturnRequest
	for rows.Next() {
		returnRequest, err := scanReturn(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan return: %w", err)
		}
		returns = append(returns, returnRequest)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("failed to iterate returns: %w", err)
	}

	for _, returnRequest := range returns {
		if err := r.loadReturnDetails(ctx, returnRequest); err != nil {
			return nil, 0, err
		}
	}

	return returns, total, nil
}

func (r *postgresOrderRepository) GetReturnQueueHealth(ctx context.Context) (*model.ReturnQueueHealth, error) {
	health := &model.ReturnQueueHealth{
		RecentFailures: []model.ReturnQueueFailure{},
	}

	var oldestPendingAt sql.NullTime
	var longestInFlightStartedAt sql.NullTime
	var nextRetryAt sql.NullTime

	if err := r.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE status = 'refund_pending') AS pending_count,
			COUNT(*) FILTER (
				WHERE status = 'refund_pending'
				  AND refund_payment_id = ''
				  AND (refund_next_retry_at IS NULL OR refund_next_retry_at <= NOW())
				  AND refund_processing_started_at IS NULL
			) AS ready_now_count,
			COUNT(*) FILTER (
				WHERE status = 'refund_pending'
				  AND refund_payment_id = ''
				  AND (refund_next_retry_at IS NULL OR refund_next_retry_at <= NOW())
				  AND refund_processing_started_at IS NULL
				  AND COALESCE(refund_last_error, '') <> ''
			) AS ready_with_failures_count,
			COUNT(*) FILTER (
				WHERE status = 'refund_pending'
				  AND refund_processing_started_at IS NOT NULL
			) AS in_flight_count,
			COUNT(*) FILTER (
				WHERE status = 'refund_pending'
				  AND refund_processing_started_at IS NOT NULL
				  AND refund_processing_started_at <= NOW() - INTERVAL '1 minute'
			) AS stale_in_flight_count,
			COUNT(*) FILTER (
				WHERE status = 'refund_pending'
				  AND refund_next_retry_at IS NOT NULL
				  AND refund_next_retry_at > NOW()
			) AS retry_scheduled_count,
			COUNT(*) FILTER (
				WHERE status = 'refund_pending'
				  AND COALESCE(refund_last_error, '') <> ''
			) AS failed_attempt_count,
			COALESCE(MAX(refund_attempt_count) FILTER (WHERE status = 'refund_pending'), 0) AS max_attempt_count,
			MIN(COALESCE(refund_requested_at, created_at)) FILTER (WHERE status = 'refund_pending') AS oldest_pending_at,
			MIN(refund_processing_started_at) FILTER (
				WHERE status = 'refund_pending'
				  AND refund_processing_started_at IS NOT NULL
			) AS longest_in_flight_started_at,
			MIN(refund_next_retry_at) FILTER (
				WHERE status = 'refund_pending'
				  AND refund_next_retry_at IS NOT NULL
				  AND refund_next_retry_at > NOW()
			) AS next_retry_at
		FROM returns
	`).Scan(
		&health.PendingCount,
		&health.ReadyNowCount,
		&health.ReadyWithFailuresCount,
		&health.InFlightCount,
		&health.StaleInFlightCount,
		&health.RetryScheduledCount,
		&health.FailedAttemptCount,
		&health.MaxAttemptCount,
		&oldestPendingAt,
		&longestInFlightStartedAt,
		&nextRetryAt,
	); err != nil {
		return nil, fmt.Errorf("failed to query return queue health: %w", err)
	}

	if oldestPendingAt.Valid {
		value := oldestPendingAt.Time
		health.OldestPendingAt = &value
	}
	if longestInFlightStartedAt.Valid {
		value := longestInFlightStartedAt.Time
		health.LongestInFlightStartedAt = &value
	}
	if nextRetryAt.Valid {
		value := nextRetryAt.Time
		health.NextRetryAt = &value
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT
			id,
			order_id,
			user_id,
			refund_last_error,
			refund_attempt_count,
			refund_next_retry_at,
			updated_at
		FROM returns
		WHERE status = 'refund_pending'
		  AND COALESCE(refund_last_error, '') <> ''
		ORDER BY updated_at DESC, id DESC
		LIMIT 5
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to query recent return refund failures: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		failure := model.ReturnQueueFailure{}
		var retryAt sql.NullTime
		if err := rows.Scan(
			&failure.ReturnID,
			&failure.OrderID,
			&failure.UserID,
			&failure.LastError,
			&failure.AttemptCount,
			&retryAt,
			&failure.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan return queue failure: %w", err)
		}
		if retryAt.Valid {
			value := retryAt.Time
			failure.NextRetryAt = &value
		}
		health.RecentFailures = append(health.RecentFailures, failure)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate recent return refund failures: %w", err)
	}

	return health, nil
}

func (r *postgresOrderRepository) AddReturnEvidence(
	ctx context.Context,
	returnID string,
	status model.ReturnStatus,
	evidence []model.ReturnEvidence,
	actorID, actorRole, message string,
) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin return evidence transaction: %w", err)
	}
	defer tx.Rollback()

	for _, evidenceFile := range evidence {
		_, err = tx.ExecContext(ctx, `
			INSERT INTO return_evidence (
				id, return_id, file_name, content_type, size_bytes,
				storage_key, url, uploaded_by, uploaded_by_role, created_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`,
			evidenceFile.ID,
			returnID,
			evidenceFile.FileName,
			evidenceFile.ContentType,
			evidenceFile.SizeBytes,
			evidenceFile.StorageKey,
			evidenceFile.URL,
			nullIfEmpty(evidenceFile.UploadedBy),
			nullIfEmpty(evidenceFile.UploadedByRole),
			evidenceFile.CreatedAt,
		)
		if err != nil {
			return fmt.Errorf("failed to insert return evidence: %w", err)
		}
	}

	_, err = tx.ExecContext(ctx, `
		UPDATE returns
		SET updated_at = NOW()
		WHERE id = $1
	`, returnID)
	if err != nil {
		return fmt.Errorf("failed to touch return after evidence upload: %w", err)
	}

	if strings.TrimSpace(message) == "" {
		message = "return evidence uploaded"
	}
	if err := r.insertReturnEventTx(ctx, tx, &model.ReturnEvent{
		ID:        uuid.New().String(),
		ReturnID:  returnID,
		Status:    status,
		ActorID:   actorID,
		ActorRole: actorRole,
		Message:   message,
		CreatedAt: time.Now(),
	}); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *postgresOrderRepository) UpdateReturnStatus(ctx context.Context, id string, status model.ReturnStatus, actorID, actorRole, message string, outbox *model.OutboxMessage) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin return status transaction: %w", err)
	}
	defer tx.Rollback()

	result, err := tx.ExecContext(ctx, `
		UPDATE returns
		SET status = $1,
		    updated_at = NOW()
		WHERE id = $2
	`, status, id)
	if err != nil {
		return fmt.Errorf("failed to update return status: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to read return status rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return tx.Commit()
	}

	if strings.TrimSpace(message) == "" {
		message = fmt.Sprintf("return status changed to %s", status)
	}
	if err := r.insertReturnEventTx(ctx, tx, &model.ReturnEvent{
		ID:        uuid.New().String(),
		ReturnID:  id,
		Status:    status,
		ActorID:   actorID,
		ActorRole: actorRole,
		Message:   message,
		CreatedAt: time.Now(),
	}); err != nil {
		return err
	}

	if err := r.insertOutboxMessageTx(ctx, tx, outbox); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *postgresOrderRepository) ScheduleReturnRefund(
	ctx context.Context,
	returnRequest *model.ReturnRequest,
	actorID, actorRole, message string,
	outbox *model.OutboxMessage,
) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin return refund scheduling transaction: %w", err)
	}
	defer tx.Rollback()

	result, err := tx.ExecContext(ctx, `
		UPDATE returns
		SET status = $1,
		    refund_amount = $2,
		    refund_charge_payment_id = $3,
		    refund_payment_id = '',
		    refund_idempotency_key = $4,
		    refund_last_error = '',
		    refund_requested_at = $5,
		    refund_completed_at = NULL,
		    refund_next_retry_at = $6,
		    refund_processing_started_at = NULL,
		    updated_at = $7
		WHERE id = $8
	`,
		returnRequest.Status,
		returnRequest.RefundAmount,
		nullIfEmpty(returnRequest.RefundChargePaymentID),
		nullIfEmpty(returnRequest.RefundIdempotencyKey),
		returnRequest.RefundRequestedAt,
		returnRequest.RefundNextRetryAt,
		returnRequest.UpdatedAt,
		returnRequest.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to schedule return refund: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to read return refund scheduling rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	if strings.TrimSpace(message) == "" {
		message = "return refund queued"
	}
	if err := r.insertReturnEventTx(ctx, tx, &model.ReturnEvent{
		ID:        uuid.New().String(),
		ReturnID:  returnRequest.ID,
		Status:    model.ReturnStatusRefundPending,
		ActorID:   actorID,
		ActorRole: actorRole,
		Message:   message,
		CreatedAt: time.Now(),
	}); err != nil {
		return err
	}

	if err := r.insertOutboxMessageTx(ctx, tx, outbox); err != nil {
		return err
	}

	return tx.Commit()
}

// ClaimPendingReturnRefunds nhận một lô return đang chờ hoàn tiền, giữ lease
// bằng FOR UPDATE SKIP LOCKED để hai worker không cùng gọi refund một đơn.
//
// Lưu ý khi sửa câu SQL bên dưới: tên cột phải viết đúng snake_case. Postgres
// hạ chữ thường mọi identifier không đặt trong nháy kép, nên một chữ hoa lạc
// (refund_next_retryAt) biến thành refund_next_retryat và làm hỏng cả câu lệnh.
// Khi đó worker không claim được job nào, hàng đợi refund_pending kẹt vĩnh viễn
// mà chỉ để lại WARN trong log — hỏng âm thầm chứ không hỏng ồn ào.
func (r *postgresOrderRepository) ClaimPendingReturnRefunds(ctx context.Context, limit int, leaseDuration time.Duration) ([]*model.ReturnRequest, error) {
	if limit <= 0 {
		limit = 1
	}
	leaseSeconds := int(leaseDuration / time.Second)
	if leaseSeconds <= 0 {
		leaseSeconds = 30
	}

	rows, err := r.db.QueryContext(ctx, `
		WITH candidates AS (
			SELECT id
			FROM returns
			WHERE status = 'refund_pending'
			  AND refund_payment_id = ''
			  AND (refund_next_retry_at IS NULL OR refund_next_retry_at <= NOW())
			  AND (
				refund_processing_started_at IS NULL OR
				refund_processing_started_at <= NOW() - ($2 * INTERVAL '1 second')
			  )
			ORDER BY COALESCE(refund_next_retry_at, created_at) ASC, created_at ASC
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE returns AS r
		SET refund_attempt_count = r.refund_attempt_count + 1,
		    refund_processing_started_at = NOW(),
		    updated_at = NOW()
		FROM candidates
		WHERE r.id = candidates.id
		RETURNING
			r.id,
			r.order_id,
			r.user_id,
			r.user_email,
			r.status,
			r.reason,
			r.refund_amount,
			r.refund_charge_payment_id,
			r.refund_payment_id,
			r.refund_idempotency_key,
			r.refund_last_error,
			r.refund_attempt_count,
			r.refund_requested_at,
			r.refund_completed_at,
			r.refund_next_retry_at,
			r.refund_processing_started_at,
			r.created_at,
			r.updated_at
	`, limit, leaseSeconds)
	if err != nil {
		return nil, fmt.Errorf("failed to claim pending return refunds: %w", err)
	}
	defer rows.Close()

	var returns []*model.ReturnRequest
	for rows.Next() {
		returnRequest, err := scanReturn(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan claimed return refund: %w", err)
		}
		returns = append(returns, returnRequest)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate claimed return refunds: %w", err)
	}

	for _, returnRequest := range returns {
		if err := r.loadReturnDetails(ctx, returnRequest); err != nil {
			return nil, err
		}
	}

	return returns, nil
}

func (r *postgresOrderRepository) CompleteReturnRefund(
	ctx context.Context,
	returnRequest *model.ReturnRequest,
	actorID, actorRole, message string,
	outbox *model.OutboxMessage,
) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin return refund completion transaction: %w", err)
	}
	defer tx.Rollback()

	result, err := tx.ExecContext(ctx, `
		UPDATE returns
		SET status = $1,
		    refund_payment_id = $2,
		    refund_last_error = '',
		    refund_completed_at = $3,
		    refund_next_retry_at = NULL,
		    refund_processing_started_at = NULL,
		    updated_at = $4
		WHERE id = $5
	`,
		returnRequest.Status,
		nullIfEmpty(returnRequest.RefundPaymentID),
		returnRequest.RefundCompletedAt,
		returnRequest.UpdatedAt,
		returnRequest.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to complete return refund: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to read return refund completion rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	if strings.TrimSpace(message) == "" {
		message = "return refund completed"
	}
	if err := r.insertReturnEventTx(ctx, tx, &model.ReturnEvent{
		ID:        uuid.New().String(),
		ReturnID:  returnRequest.ID,
		Status:    model.ReturnStatusRefunded,
		ActorID:   actorID,
		ActorRole: actorRole,
		Message:   message,
		CreatedAt: time.Now(),
	}); err != nil {
		return err
	}

	if err := r.insertOutboxMessageTx(ctx, tx, outbox); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *postgresOrderRepository) MarkReturnRefundAttemptFailed(
	ctx context.Context,
	returnID, lastError string,
	nextRetryAt time.Time,
) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE returns
		SET refund_last_error = $2,
		    refund_next_retry_at = $3,
		    refund_processing_started_at = NULL,
		    updated_at = NOW()
		WHERE id = $1
	`, returnID, lastError, nextRetryAt)
	if err != nil {
		return fmt.Errorf("failed to mark return refund attempt failed: %w", err)
	}
	return nil
}

func (r *postgresOrderRepository) insertReturnEventTx(ctx context.Context, tx *sql.Tx, event *model.ReturnEvent) error {
	_, err := tx.ExecContext(ctx, `
		INSERT INTO return_events (id, return_id, status, actor_id, actor_role, message, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`,
		event.ID,
		event.ReturnID,
		event.Status,
		nullIfEmpty(event.ActorID),
		nullIfEmpty(event.ActorRole),
		event.Message,
		event.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert return event: %w", err)
	}

	return nil
}

func (r *postgresOrderRepository) loadReturnDetails(ctx context.Context, returnRequest *model.ReturnRequest) error {
	items, err := r.listReturnItems(ctx, returnRequest.ID)
	if err != nil {
		return err
	}
	events, err := r.listReturnEvents(ctx, returnRequest.ID)
	if err != nil {
		return err
	}
	evidence, err := r.listReturnEvidence(ctx, returnRequest.ID)
	if err != nil {
		return err
	}

	returnRequest.Items = items
	returnRequest.Events = events
	returnRequest.Evidence = evidence
	return nil
}

func (r *postgresOrderRepository) listReturnItems(ctx context.Context, returnID string) ([]model.ReturnItem, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, return_id, order_item_id, product_id, quantity, reason, created_at, updated_at
		FROM return_items
		WHERE return_id = $1
		ORDER BY created_at ASC, id ASC
	`, returnID)
	if err != nil {
		return nil, fmt.Errorf("failed to list return items: %w", err)
	}
	defer rows.Close()

	var items []model.ReturnItem
	for rows.Next() {
		item, err := scanReturnItem(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan return item: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate return items: %w", err)
	}

	return items, nil
}

func (r *postgresOrderRepository) listReturnEvents(ctx context.Context, returnID string) ([]model.ReturnEvent, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, return_id, status, actor_id, actor_role, message, created_at
		FROM return_events
		WHERE return_id = $1
		ORDER BY created_at ASC, id ASC
	`, returnID)
	if err != nil {
		return nil, fmt.Errorf("failed to list return events: %w", err)
	}
	defer rows.Close()

	var events []model.ReturnEvent
	for rows.Next() {
		event, err := scanReturnEvent(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan return event: %w", err)
		}
		events = append(events, event)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate return events: %w", err)
	}

	return events, nil
}

func (r *postgresOrderRepository) listReturnEvidence(ctx context.Context, returnID string) ([]model.ReturnEvidence, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, return_id, file_name, content_type, size_bytes, storage_key, url,
		       uploaded_by, uploaded_by_role, created_at
		FROM return_evidence
		WHERE return_id = $1
		ORDER BY created_at ASC, id ASC
	`, returnID)
	if err != nil {
		return nil, fmt.Errorf("failed to list return evidence: %w", err)
	}
	defer rows.Close()

	var evidence []model.ReturnEvidence
	for rows.Next() {
		evidenceFile, err := scanReturnEvidence(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan return evidence: %w", err)
		}
		evidence = append(evidence, evidenceFile)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate return evidence: %w", err)
	}

	return evidence, nil
}
