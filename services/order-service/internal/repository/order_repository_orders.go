package repository

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

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
