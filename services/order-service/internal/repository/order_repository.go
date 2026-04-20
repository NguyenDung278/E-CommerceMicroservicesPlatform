package repository

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

var (
	ErrCouponNotFound          = errors.New("coupon not found")
	ErrCouponInactive          = errors.New("coupon inactive")
	ErrCouponExpired           = errors.New("coupon expired")
	ErrCouponUsageLimitReached = errors.New("coupon usage limit reached")
	ErrCouponMinimumNotMet     = errors.New("order does not meet coupon minimum amount")
	ErrInvalidOrderCursor      = errors.New("invalid order cursor")
)

type OrderRepository interface {
	Create(ctx context.Context, order *model.Order, outbox *model.OutboxMessage) error
	CreateWithIdempotency(ctx context.Context, order *model.Order, outbox *model.OutboxMessage, record *model.OrderIdempotencyRecord) error
	GetByID(ctx context.Context, id string) (*model.Order, error)
	GetByUserID(ctx context.Context, userID string) ([]*model.Order, error)
	GetIdempotencyKey(ctx context.Context, userID, idempotencyKey string) (*model.OrderIdempotencyRecord, error)
	CreateReturn(ctx context.Context, returnRequest *model.ReturnRequest, outbox *model.OutboxMessage) error
	GetReturnByID(ctx context.Context, id string) (*model.ReturnRequest, error)
	ListReturnsByOrderID(ctx context.Context, orderID string) ([]*model.ReturnRequest, error)
	ListReturns(ctx context.Context, filters model.ReturnFilters) ([]*model.ReturnRequest, int64, error)
	AddReturnEvidence(ctx context.Context, returnID string, status model.ReturnStatus, evidence []model.ReturnEvidence, actorID, actorRole, message string) error
	GetReturnQueueHealth(ctx context.Context) (*model.ReturnQueueHealth, error)
	UpdateReturnStatus(ctx context.Context, id string, status model.ReturnStatus, actorID, actorRole, message string, outbox *model.OutboxMessage) error
	ScheduleReturnRefund(ctx context.Context, returnRequest *model.ReturnRequest, actorID, actorRole, message string, outbox *model.OutboxMessage) error
	ClaimPendingReturnRefunds(ctx context.Context, limit int, leaseDuration time.Duration) ([]*model.ReturnRequest, error)
	CompleteReturnRefund(ctx context.Context, returnRequest *model.ReturnRequest, actorID, actorRole, message string, outbox *model.OutboxMessage) error
	MarkReturnRefundAttemptFailed(ctx context.Context, returnID, lastError string, nextRetryAt time.Time) error
	ListAll(ctx context.Context, filters model.OrderFilters) ([]*model.Order, int64, error)
	ListAllByCursor(ctx context.Context, filters model.OrderFilters) ([]*model.Order, string, bool, error)
	GetEventsByOrderID(ctx context.Context, orderID string) ([]*model.OrderEvent, error)
	UpdateStatus(ctx context.Context, id string, status model.OrderStatus, actorID, actorRole, message string, outbox *model.OutboxMessage) error
	CreateCoupon(ctx context.Context, coupon *model.Coupon) error
	ListCoupons(ctx context.Context) ([]*model.Coupon, error)
	GetCouponByCode(ctx context.Context, code string) (*model.Coupon, error)
	GetAdminReport(ctx context.Context, from time.Time, to time.Time, windowDays int) (*model.AdminReport, error)
	ListPopularProducts(ctx context.Context, limit int) ([]model.ProductPopularity, error)
	CreateAuditEntry(ctx context.Context, entry *model.AuditEntry) error
	ClaimPendingOutbox(ctx context.Context, limit int, leaseDuration time.Duration) ([]*model.OutboxMessage, error)
	MarkOutboxPublished(ctx context.Context, id string, publishedAt time.Time) error
	MarkOutboxFailed(ctx context.Context, id, lastError string, nextAvailableAt time.Time) error
	ExpirePendingReservation(
		ctx context.Context,
		orderID string,
		actorID, actorRole, message string,
		outbox *model.OutboxMessage,
	) (bool, error)
	ApplyInboxStatusTransition(
		ctx context.Context,
		inbox *model.InboxMessage,
		orderID string,
		expectedCurrent model.OrderStatus,
		nextStatus model.OrderStatus,
		actorID, actorRole, message string,
	) (*model.InboxTransitionResult, error)
}

type postgresOrderRepository struct {
	db *sql.DB
}

func NewOrderRepository(db *sql.DB) OrderRepository {
	return &postgresOrderRepository{db: db}
}

// Create inserts a new order along with its items and event tracking into PostgreSQL.
//
// TRANSACTIONAL GUARANTEE:
//   - Quá trình insert vào `orders`, `order_items`, bảng `coupons` (khóa row), và `order_events`
//     phải diễn ra trong một Transaction (BeginTx).
//   - Nếu có bất cứ bảng nào thất bại, toàn bộ quá trình sẽ Rollback để tránh việc tạo ra Data "Mồ côi".
func (r *postgresOrderRepository) Create(ctx context.Context, order *model.Order, outbox *model.OutboxMessage) error {
	return r.createOrderTx(ctx, order, outbox, nil)
}

func (r *postgresOrderRepository) CreateWithIdempotency(
	ctx context.Context,
	order *model.Order,
	outbox *model.OutboxMessage,
	record *model.OrderIdempotencyRecord,
) error {
	return r.createOrderTx(ctx, order, outbox, record)
}

func (r *postgresOrderRepository) createOrderTx(
	ctx context.Context,
	order *model.Order,
	outbox *model.OutboxMessage,
	record *model.OrderIdempotencyRecord,
) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	if order.CouponCode != "" {
		if err := r.lockAndConsumeCoupon(ctx, tx, order.CouponCode, order.SubtotalPrice); err != nil {
			return err
		}
	}

	orderQuery := `
		INSERT INTO orders (
			id, user_id, status, subtotal_price, discount_amount, coupon_code, shipping_method, shipping_fee,
			shipping_recipient_name, shipping_phone, shipping_location,
			reservation_expires_at, reservation_allocated_at, total_price, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
	`
	shippingRecipientName, shippingPhone, shippingLocation := shippingAddressColumns(order.ShippingAddress)
	_, err = tx.ExecContext(ctx, orderQuery,
		order.ID,
		order.UserID,
		order.Status,
		order.SubtotalPrice,
		order.DiscountAmount,
		nullIfEmpty(order.CouponCode),
		order.ShippingMethod,
		order.ShippingFee,
		shippingRecipientName,
		shippingPhone,
		shippingLocation,
		order.ReservationExpiresAt,
		order.ReservationAllocatedAt,
		order.TotalPrice,
		order.CreatedAt,
		order.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create order: %w", err)
	}

	itemQuery := `
		INSERT INTO order_items (id, order_id, product_id, name, price, quantity)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	for _, item := range order.Items {
		_, err = tx.ExecContext(ctx, itemQuery,
			item.ID, order.ID, item.ProductID, item.Name, item.Price, item.Quantity,
		)
		if err != nil {
			return fmt.Errorf("failed to create order item: %w", err)
		}
	}

	if err := r.insertOrderEventTx(ctx, tx, &model.OrderEvent{
		ID:        uuid.New().String(),
		OrderID:   order.ID,
		Type:      "created",
		Status:    order.Status,
		ActorID:   order.UserID,
		ActorRole: "user",
		Message:   "order created",
		CreatedAt: time.Now(),
	}); err != nil {
		return err
	}

	if err := r.insertOutboxMessageTx(ctx, tx, outbox); err != nil {
		return err
	}
	if err := r.insertOrderIdempotencyRecordTx(ctx, tx, record); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *postgresOrderRepository) GetByID(ctx context.Context, id string) (*model.Order, error) {
	orderQuery := `
		SELECT id, user_id, status, subtotal_price, discount_amount, coupon_code, shipping_method, shipping_fee,
		       shipping_recipient_name, shipping_phone, shipping_location,
		       reservation_expires_at, reservation_allocated_at, total_price, created_at, updated_at
		FROM orders
		WHERE id = $1
	`

	order, err := scanOrder(r.db.QueryRowContext(ctx, orderQuery, id))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get order: %w", err)
	}

	itemQuery := `SELECT id, order_id, product_id, name, price, quantity FROM order_items WHERE order_id = $1`
	rows, err := r.db.QueryContext(ctx, itemQuery, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get order items: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		item := model.OrderItem{}
		if err := rows.Scan(&item.ID, &item.OrderID, &item.ProductID, &item.Name, &item.Price, &item.Quantity); err != nil {
			return nil, fmt.Errorf("failed to scan order item: %w", err)
		}
		order.Items = append(order.Items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate order items: %w", err)
	}

	return order, nil
}

func (r *postgresOrderRepository) GetByUserID(ctx context.Context, userID string) ([]*model.Order, error) {
	query := `
		SELECT id, user_id, status, subtotal_price, discount_amount, coupon_code, shipping_method, shipping_fee,
		       shipping_recipient_name, shipping_phone, shipping_location,
		       reservation_expires_at, reservation_allocated_at, total_price, created_at, updated_at
		FROM orders
		WHERE user_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list orders: %w", err)
	}
	defer rows.Close()

	var orders []*model.Order
	for rows.Next() {
		o, err := scanOrder(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan order: %w", err)
		}
		orders = append(orders, o)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate orders: %w", err)
	}
	return orders, nil
}

func (r *postgresOrderRepository) GetIdempotencyKey(ctx context.Context, userID, idempotencyKey string) (*model.OrderIdempotencyRecord, error) {
	query := `
		SELECT user_id, idempotency_key, request_hash, order_id, reservation_expires_at, created_at, updated_at
		FROM order_idempotency_keys
		WHERE user_id = $1 AND idempotency_key = $2
	`

	record, err := scanOrderIdempotencyRecord(r.db.QueryRowContext(ctx, query, userID, idempotencyKey))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get order idempotency key: %w", err)
	}

	return record, nil
}

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

func (r *postgresOrderRepository) ListAll(ctx context.Context, filters model.OrderFilters) ([]*model.Order, int64, error) {
	baseQuery := `FROM orders WHERE 1=1`
	args := make([]interface{}, 0, 6)
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
	if filters.From != nil {
		baseQuery += fmt.Sprintf(` AND created_at >= $%d`, argIdx)
		args = append(args, *filters.From)
		argIdx++
	}
	if filters.To != nil {
		baseQuery += fmt.Sprintf(` AND created_at <= $%d`, argIdx)
		args = append(args, *filters.To)
		argIdx++
	}

	var total int64
	countQuery := `SELECT COUNT(*) ` + baseQuery
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count orders: %w", err)
	}

	selectQuery := fmt.Sprintf(
		`SELECT id, user_id, status, subtotal_price, discount_amount, coupon_code, shipping_method, shipping_fee,
		        shipping_recipient_name, shipping_phone, shipping_location,
		        reservation_expires_at, reservation_allocated_at, total_price, created_at, updated_at %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		baseQuery, argIdx, argIdx+1,
	)
	args = append(args, filters.Limit, (filters.Page-1)*filters.Limit)

	rows, err := r.db.QueryContext(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list all orders: %w", err)
	}
	defer rows.Close()

	var orders []*model.Order
	for rows.Next() {
		order, err := scanOrder(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan order: %w", err)
		}
		orders = append(orders, order)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("failed to iterate orders: %w", err)
	}

	return orders, total, nil
}

func (r *postgresOrderRepository) ListAllByCursor(ctx context.Context, filters model.OrderFilters) ([]*model.Order, string, bool, error) {
	baseQuery := `FROM orders WHERE 1=1`
	args := make([]interface{}, 0, 8)
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
	if filters.From != nil {
		baseQuery += fmt.Sprintf(` AND created_at >= $%d`, argIdx)
		args = append(args, *filters.From)
		argIdx++
	}
	if filters.To != nil {
		baseQuery += fmt.Sprintf(` AND created_at <= $%d`, argIdx)
		args = append(args, *filters.To)
		argIdx++
	}

	if strings.TrimSpace(filters.Cursor) != "" {
		cursorTime, cursorID, err := decodeOrderListCursor(filters.Cursor)
		if err != nil {
			return nil, "", false, fmt.Errorf("%w: %v", ErrInvalidOrderCursor, err)
		}
		baseQuery += fmt.Sprintf(` AND (created_at < $%d OR (created_at = $%d AND id < $%d))`, argIdx, argIdx, argIdx+1)
		args = append(args, cursorTime, cursorID)
		argIdx += 2
	}

	selectQuery := fmt.Sprintf(
		`SELECT id, user_id, status, subtotal_price, discount_amount, coupon_code, shipping_method, shipping_fee,
		        shipping_recipient_name, shipping_phone, shipping_location,
		        reservation_expires_at, reservation_allocated_at, total_price, created_at, updated_at %s ORDER BY created_at DESC, id DESC LIMIT $%d`,
		baseQuery, argIdx,
	)
	args = append(args, filters.Limit+1)

	rows, err := r.db.QueryContext(ctx, selectQuery, args...)
	if err != nil {
		return nil, "", false, fmt.Errorf("failed to list orders by cursor: %w", err)
	}
	defer rows.Close()

	var orders []*model.Order
	for rows.Next() {
		order, err := scanOrder(rows)
		if err != nil {
			return nil, "", false, fmt.Errorf("failed to scan cursor order: %w", err)
		}
		orders = append(orders, order)
	}
	if err := rows.Err(); err != nil {
		return nil, "", false, fmt.Errorf("failed to iterate cursor orders: %w", err)
	}

	hasNext := len(orders) > filters.Limit
	if hasNext {
		orders = orders[:filters.Limit]
	}

	nextCursor := ""
	if hasNext && len(orders) > 0 {
		lastOrder := orders[len(orders)-1]
		nextCursor = encodeOrderListCursor(lastOrder.CreatedAt, lastOrder.ID)
	}

	return orders, nextCursor, hasNext, nil
}

func (r *postgresOrderRepository) GetEventsByOrderID(ctx context.Context, orderID string) ([]*model.OrderEvent, error) {
	query := `
		SELECT id, order_id, event_type, status, actor_id, actor_role, message, created_at
		FROM order_events
		WHERE order_id = $1
		ORDER BY created_at ASC, id ASC
	`

	rows, err := r.db.QueryContext(ctx, query, orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to get order events: %w", err)
	}
	defer rows.Close()

	var events []*model.OrderEvent
	for rows.Next() {
		event := &model.OrderEvent{}
		var actorID sql.NullString
		var actorRole sql.NullString
		if err := rows.Scan(
			&event.ID,
			&event.OrderID,
			&event.Type,
			&event.Status,
			&actorID,
			&actorRole,
			&event.Message,
			&event.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan order event: %w", err)
		}
		if actorID.Valid {
			event.ActorID = actorID.String
		}
		if actorRole.Valid {
			event.ActorRole = actorRole.String
		}
		events = append(events, event)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate order events: %w", err)
	}

	return events, nil
}

func (r *postgresOrderRepository) UpdateStatus(ctx context.Context, id string, status model.OrderStatus, actorID, actorRole, message string, outbox *model.OutboxMessage) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	query := `
		UPDATE orders
		SET status = $1,
		    reservation_expires_at = CASE
		        WHEN $1 IN ('paid', 'cancelled', 'refunded') THEN NULL
		        ELSE reservation_expires_at
		    END,
		    reservation_allocated_at = CASE
		        WHEN $1 = 'paid' THEN COALESCE(reservation_allocated_at, NOW())
		        WHEN $1 = 'cancelled' THEN NULL
		        ELSE reservation_allocated_at
		    END,
		    updated_at = NOW()
		WHERE id = $2
	`
	result, err := tx.ExecContext(ctx, query, status, id)
	if err != nil {
		return fmt.Errorf("failed to update order status: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	if strings.TrimSpace(message) == "" {
		message = fmt.Sprintf("order status changed to %s", status)
	}

	if err := r.insertOrderEventTx(ctx, tx, &model.OrderEvent{
		ID:        uuid.New().String(),
		OrderID:   id,
		Type:      "status_changed",
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

func (r *postgresOrderRepository) ExpirePendingReservation(
	ctx context.Context,
	orderID string,
	actorID, actorRole, message string,
	outbox *model.OutboxMessage,
) (bool, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return false, fmt.Errorf("failed to begin reservation expiry transaction: %w", err)
	}
	defer tx.Rollback()

	result, err := tx.ExecContext(ctx, `
		UPDATE orders
		SET status = $1,
		    reservation_expires_at = NULL,
		    reservation_allocated_at = NULL,
		    updated_at = NOW()
		WHERE id = $2
		  AND status = $3
		  AND reservation_allocated_at IS NULL
		  AND reservation_expires_at IS NOT NULL
		  AND reservation_expires_at <= NOW()
	`, model.OrderStatusCancelled, orderID, model.OrderStatusPending)
	if err != nil {
		return false, fmt.Errorf("failed to expire pending reservation: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("failed to read expired reservation rows affected: %w", err)
	}
	if rowsAffected == 0 {
		if err := tx.Commit(); err != nil {
			return false, fmt.Errorf("failed to commit no-op reservation expiry: %w", err)
		}
		return false, nil
	}

	if strings.TrimSpace(message) == "" {
		message = "order cancelled because reserved stock expired before payment completed"
	}
	if err := r.insertOrderEventTx(ctx, tx, &model.OrderEvent{
		ID:        uuid.New().String(),
		OrderID:   orderID,
		Type:      "status_changed",
		Status:    model.OrderStatusCancelled,
		ActorID:   actorID,
		ActorRole: actorRole,
		Message:   message,
		CreatedAt: time.Now(),
	}); err != nil {
		return false, err
	}

	if err := r.insertOutboxMessageTx(ctx, tx, outbox); err != nil {
		return false, err
	}

	if err := tx.Commit(); err != nil {
		return false, fmt.Errorf("failed to commit reservation expiry: %w", err)
	}
	return true, nil
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

func (r *postgresOrderRepository) CreateCoupon(ctx context.Context, coupon *model.Coupon) error {
	query := `
		INSERT INTO coupons (id, code, description, discount_type, discount_value, min_order_amount, usage_limit, used_count, active, expires_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`

	_, err := r.db.ExecContext(ctx, query,
		coupon.ID,
		coupon.Code,
		coupon.Description,
		coupon.DiscountType,
		coupon.DiscountValue,
		coupon.MinOrderAmount,
		coupon.UsageLimit,
		coupon.UsedCount,
		coupon.Active,
		coupon.ExpiresAt,
		coupon.CreatedAt,
		coupon.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create coupon: %w", err)
	}
	return nil
}

func (r *postgresOrderRepository) ListCoupons(ctx context.Context) ([]*model.Coupon, error) {
	query := `
		SELECT id, code, description, discount_type, discount_value, min_order_amount, usage_limit, used_count, active, expires_at, created_at, updated_at
		FROM coupons
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list coupons: %w", err)
	}
	defer rows.Close()

	var coupons []*model.Coupon
	for rows.Next() {
		coupon, err := scanCoupon(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan coupon: %w", err)
		}
		coupons = append(coupons, coupon)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate coupons: %w", err)
	}

	return coupons, nil
}

func (r *postgresOrderRepository) GetCouponByCode(ctx context.Context, code string) (*model.Coupon, error) {
	query := `
		SELECT id, code, description, discount_type, discount_value, min_order_amount, usage_limit, used_count, active, expires_at, created_at, updated_at
		FROM coupons
		WHERE code = $1
	`

	coupon, err := scanCoupon(r.db.QueryRowContext(ctx, query, strings.ToUpper(strings.TrimSpace(code))))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get coupon: %w", err)
	}
	return coupon, nil
}

func (r *postgresOrderRepository) GetAdminReport(
	ctx context.Context,
	from time.Time,
	to time.Time,
	windowDays int,
) (*model.AdminReport, error) {
	report := &model.AdminReport{
		WindowDays:      windowDays,
		TopProducts:     []model.SalesTopProduct{},
		StatusBreakdown: []model.SalesStatusBreakdown{},
	}

	summaryQuery := `
		SELECT
			COUNT(*) AS order_count,
			COALESCE(SUM(CASE WHEN status IN ('paid', 'shipped', 'delivered') THEN total_price ELSE 0 END), 0) AS total_revenue,
			COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_count,
			COALESCE(AVG(CASE WHEN status IN ('paid', 'shipped', 'delivered') THEN total_price END), 0) AS average_order_value
		FROM orders
		WHERE created_at BETWEEN $1 AND $2
	`
	if err := r.db.QueryRowContext(ctx, summaryQuery, from, to).Scan(
		&report.OrderCount,
		&report.TotalRevenue,
		&report.CancelledCount,
		&report.AverageOrderValue,
	); err != nil {
		return nil, fmt.Errorf("failed to load admin report summary: %w", err)
	}

	topProductsQuery := `
		SELECT
			oi.product_id,
			MAX(oi.name) AS name,
			COALESCE(SUM(oi.quantity), 0) AS quantity,
			COALESCE(SUM(oi.price * oi.quantity), 0) AS revenue
		FROM order_items oi
		INNER JOIN orders o ON o.id = oi.order_id
		WHERE o.created_at BETWEEN $1 AND $2
		  AND o.status IN ('paid', 'shipped', 'delivered')
		GROUP BY oi.product_id
		ORDER BY quantity DESC, revenue DESC
		LIMIT 5
	`
	rows, err := r.db.QueryContext(ctx, topProductsQuery, from, to)
	if err != nil {
		return nil, fmt.Errorf("failed to load top products: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		item := model.SalesTopProduct{}
		if err := rows.Scan(&item.ProductID, &item.Name, &item.Quantity, &item.Revenue); err != nil {
			return nil, fmt.Errorf("failed to scan top product: %w", err)
		}
		report.TopProducts = append(report.TopProducts, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate top products: %w", err)
	}

	statusQuery := `
		SELECT
			status,
			COUNT(*) AS orders,
			COALESCE(SUM(total_price), 0) AS revenue
		FROM orders
		WHERE created_at BETWEEN $1 AND $2
		GROUP BY status
		ORDER BY orders DESC, status ASC
	`
	statusRows, err := r.db.QueryContext(ctx, statusQuery, from, to)
	if err != nil {
		return nil, fmt.Errorf("failed to load status breakdown: %w", err)
	}
	defer statusRows.Close()

	for statusRows.Next() {
		item := model.SalesStatusBreakdown{}
		if err := statusRows.Scan(&item.Status, &item.Orders, &item.Revenue); err != nil {
			return nil, fmt.Errorf("failed to scan status breakdown: %w", err)
		}
		report.StatusBreakdown = append(report.StatusBreakdown, item)
	}
	if err := statusRows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate status breakdown: %w", err)
	}

	return report, nil
}

func (r *postgresOrderRepository) ListPopularProducts(ctx context.Context, limit int) ([]model.ProductPopularity, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT oi.product_id, COALESCE(SUM(oi.quantity), 0) AS quantity
		FROM order_items oi
		INNER JOIN orders o ON o.id = oi.order_id
		WHERE o.status IN ('paid', 'shipped', 'delivered')
		GROUP BY oi.product_id
		ORDER BY quantity DESC, oi.product_id ASC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list popular products: %w", err)
	}
	defer rows.Close()

	popularity := make([]model.ProductPopularity, 0, limit)
	for rows.Next() {
		item := model.ProductPopularity{}
		if err := rows.Scan(&item.ProductID, &item.Quantity); err != nil {
			return nil, fmt.Errorf("failed to scan product popularity: %w", err)
		}
		popularity = append(popularity, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate product popularity: %w", err)
	}

	return popularity, nil
}

func (r *postgresOrderRepository) CreateAuditEntry(ctx context.Context, entry *model.AuditEntry) error {
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
		nullIfEmpty(entry.ActorID),
		nullIfEmpty(entry.ActorRole),
		string(metadata),
		entry.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create audit entry: %w", err)
	}

	return nil
}

type rowScanner interface {
	Scan(dest ...interface{}) error
}

func scanOrder(scanner rowScanner) (*model.Order, error) {
	order := &model.Order{}
	var couponCode sql.NullString
	var shippingRecipientName sql.NullString
	var shippingPhone sql.NullString
	var shippingLocation sql.NullString
	var reservationExpiresAt sql.NullTime
	var reservationAllocatedAt sql.NullTime
	err := scanner.Scan(
		&order.ID,
		&order.UserID,
		&order.Status,
		&order.SubtotalPrice,
		&order.DiscountAmount,
		&couponCode,
		&order.ShippingMethod,
		&order.ShippingFee,
		&shippingRecipientName,
		&shippingPhone,
		&shippingLocation,
		&reservationExpiresAt,
		&reservationAllocatedAt,
		&order.TotalPrice,
		&order.CreatedAt,
		&order.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if couponCode.Valid {
		order.CouponCode = couponCode.String
	}
	if shippingRecipientName.Valid || shippingPhone.Valid || shippingLocation.Valid {
		order.ShippingAddress = &model.ShippingAddress{
			RecipientName: shippingRecipientName.String,
			Phone:         shippingPhone.String,
			Location:      shippingLocation.String,
		}
	}
	if reservationExpiresAt.Valid {
		order.ReservationExpiresAt = &reservationExpiresAt.Time
	}
	if reservationAllocatedAt.Valid {
		order.ReservationAllocatedAt = &reservationAllocatedAt.Time
	}
	return order, nil
}

func scanOrderIdempotencyRecord(scanner rowScanner) (*model.OrderIdempotencyRecord, error) {
	record := &model.OrderIdempotencyRecord{}
	if err := scanner.Scan(
		&record.UserID,
		&record.IdempotencyKey,
		&record.RequestHash,
		&record.OrderID,
		&record.ReservationExpiresAt,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return nil, err
	}

	return record, nil
}

func shippingAddressColumns(address *model.ShippingAddress) (any, any, any) {
	if address == nil {
		return nil, nil, nil
	}

	return nullIfEmpty(address.RecipientName),
		nullIfEmpty(address.Phone),
		nullIfEmpty(address.Location)
}

func (r *postgresOrderRepository) insertOrderIdempotencyRecordTx(
	ctx context.Context,
	tx *sql.Tx,
	record *model.OrderIdempotencyRecord,
) error {
	if record == nil {
		return nil
	}

	_, err := tx.ExecContext(ctx, `
		INSERT INTO order_idempotency_keys (
			user_id, idempotency_key, request_hash, order_id, reservation_expires_at, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`,
		record.UserID,
		record.IdempotencyKey,
		record.RequestHash,
		record.OrderID,
		record.ReservationExpiresAt,
		record.CreatedAt,
		record.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create order idempotency key: %w", err)
	}

	return nil
}

func encodeOrderListCursor(createdAt time.Time, id string) string {
	raw := fmt.Sprintf("%s|%s", createdAt.UTC().Format(time.RFC3339Nano), id)
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func decodeOrderListCursor(value string) (time.Time, string, error) {
	decoded, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(value))
	if err != nil {
		return time.Time{}, "", err
	}

	parts := strings.SplitN(string(decoded), "|", 2)
	if len(parts) != 2 || strings.TrimSpace(parts[1]) == "" {
		return time.Time{}, "", fmt.Errorf("cursor payload is invalid")
	}

	createdAt, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		return time.Time{}, "", err
	}

	return createdAt, parts[1], nil
}

func scanCoupon(scanner rowScanner) (*model.Coupon, error) {
	coupon := &model.Coupon{}
	var expiresAt sql.NullTime
	err := scanner.Scan(
		&coupon.ID,
		&coupon.Code,
		&coupon.Description,
		&coupon.DiscountType,
		&coupon.DiscountValue,
		&coupon.MinOrderAmount,
		&coupon.UsageLimit,
		&coupon.UsedCount,
		&coupon.Active,
		&expiresAt,
		&coupon.CreatedAt,
		&coupon.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if expiresAt.Valid {
		value := expiresAt.Time
		coupon.ExpiresAt = &value
	}
	return coupon, nil
}

func scanReturn(scanner rowScanner) (*model.ReturnRequest, error) {
	returnRequest := &model.ReturnRequest{}
	var refundChargePaymentID sql.NullString
	var refundPaymentID sql.NullString
	var refundIdempotencyKey sql.NullString
	var refundLastError sql.NullString
	var refundRequestedAt sql.NullTime
	var refundCompletedAt sql.NullTime
	var refundNextRetryAt sql.NullTime
	var refundProcessingStarted sql.NullTime
	if err := scanner.Scan(
		&returnRequest.ID,
		&returnRequest.OrderID,
		&returnRequest.UserID,
		&returnRequest.UserEmail,
		&returnRequest.Status,
		&returnRequest.Reason,
		&returnRequest.RefundAmount,
		&refundChargePaymentID,
		&refundPaymentID,
		&refundIdempotencyKey,
		&refundLastError,
		&returnRequest.RefundAttemptCount,
		&refundRequestedAt,
		&refundCompletedAt,
		&refundNextRetryAt,
		&refundProcessingStarted,
		&returnRequest.CreatedAt,
		&returnRequest.UpdatedAt,
	); err != nil {
		return nil, err
	}
	if refundChargePaymentID.Valid {
		returnRequest.RefundChargePaymentID = refundChargePaymentID.String
	}
	if refundPaymentID.Valid {
		returnRequest.RefundPaymentID = refundPaymentID.String
	}
	if refundIdempotencyKey.Valid {
		returnRequest.RefundIdempotencyKey = refundIdempotencyKey.String
	}
	if refundLastError.Valid {
		returnRequest.RefundLastError = refundLastError.String
	}
	if refundRequestedAt.Valid {
		value := refundRequestedAt.Time
		returnRequest.RefundRequestedAt = &value
	}
	if refundCompletedAt.Valid {
		value := refundCompletedAt.Time
		returnRequest.RefundCompletedAt = &value
	}
	if refundNextRetryAt.Valid {
		value := refundNextRetryAt.Time
		returnRequest.RefundNextRetryAt = &value
	}
	if refundProcessingStarted.Valid {
		value := refundProcessingStarted.Time
		returnRequest.RefundProcessingStarted = &value
	}

	return returnRequest, nil
}

func scanReturnItem(scanner rowScanner) (model.ReturnItem, error) {
	item := model.ReturnItem{}
	err := scanner.Scan(
		&item.ID,
		&item.ReturnID,
		&item.OrderItemID,
		&item.ProductID,
		&item.Quantity,
		&item.Reason,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	return item, err
}

func scanReturnEvidence(scanner rowScanner) (model.ReturnEvidence, error) {
	evidence := model.ReturnEvidence{}
	var uploadedBy sql.NullString
	var uploadedByRole sql.NullString
	err := scanner.Scan(
		&evidence.ID,
		&evidence.ReturnID,
		&evidence.FileName,
		&evidence.ContentType,
		&evidence.SizeBytes,
		&evidence.StorageKey,
		&evidence.URL,
		&uploadedBy,
		&uploadedByRole,
		&evidence.CreatedAt,
	)
	if err != nil {
		return model.ReturnEvidence{}, err
	}
	if uploadedBy.Valid {
		evidence.UploadedBy = uploadedBy.String
	}
	if uploadedByRole.Valid {
		evidence.UploadedByRole = uploadedByRole.String
	}

	return evidence, nil
}

func scanReturnEvent(scanner rowScanner) (model.ReturnEvent, error) {
	event := model.ReturnEvent{}
	var actorID sql.NullString
	var actorRole sql.NullString

	err := scanner.Scan(
		&event.ID,
		&event.ReturnID,
		&event.Status,
		&actorID,
		&actorRole,
		&event.Message,
		&event.CreatedAt,
	)
	if err != nil {
		return model.ReturnEvent{}, err
	}
	if actorID.Valid {
		event.ActorID = actorID.String
	}
	if actorRole.Valid {
		event.ActorRole = actorRole.String
	}

	return event, nil
}

func (r *postgresOrderRepository) lockAndConsumeCoupon(ctx context.Context, tx *sql.Tx, code string, subtotal float64) error {
	query := `
		SELECT id, code, description, discount_type, discount_value, min_order_amount, usage_limit, used_count, active, expires_at, created_at, updated_at
		FROM coupons
		WHERE code = $1
		FOR UPDATE
	`

	coupon, err := scanCoupon(tx.QueryRowContext(ctx, query, strings.ToUpper(strings.TrimSpace(code))))
	if err == sql.ErrNoRows {
		return ErrCouponNotFound
	}
	if err != nil {
		return fmt.Errorf("failed to lock coupon: %w", err)
	}

	now := time.Now()
	if !coupon.Active {
		return ErrCouponInactive
	}
	if coupon.ExpiresAt != nil && now.After(*coupon.ExpiresAt) {
		return ErrCouponExpired
	}
	if coupon.MinOrderAmount > subtotal {
		return ErrCouponMinimumNotMet
	}
	if coupon.UsageLimit > 0 && coupon.UsedCount >= coupon.UsageLimit {
		return ErrCouponUsageLimitReached
	}

	if _, err := tx.ExecContext(ctx, `UPDATE coupons SET used_count = used_count + 1, updated_at = NOW() WHERE id = $1`, coupon.ID); err != nil {
		return fmt.Errorf("failed to consume coupon: %w", err)
	}

	return nil
}

func (r *postgresOrderRepository) insertOrderEventTx(ctx context.Context, tx *sql.Tx, event *model.OrderEvent) error {
	query := `
		INSERT INTO order_events (id, order_id, event_type, status, actor_id, actor_role, message, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := tx.ExecContext(ctx, query,
		event.ID,
		event.OrderID,
		event.Type,
		event.Status,
		nullIfEmpty(event.ActorID),
		nullIfEmpty(event.ActorRole),
		event.Message,
		event.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert order event: %w", err)
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

func scanOutboxMessage(scanner rowScanner) (*model.OutboxMessage, error) {
	message := &model.OutboxMessage{}
	var requestID sql.NullString
	var publishedAt sql.NullTime

	if err := scanner.Scan(
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
	); err != nil {
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

func nullIfEmpty(value string) interface{} {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}
