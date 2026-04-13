package repository

import (
	"context"
	"database/sql"
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
)

type OrderRepository interface {
	Create(ctx context.Context, order *model.Order, outbox *model.OutboxMessage) error
	GetByID(ctx context.Context, id string) (*model.Order, error)
	GetByUserID(ctx context.Context, userID string) ([]*model.Order, error)
	CreateReturn(ctx context.Context, returnRequest *model.ReturnRequest, outbox *model.OutboxMessage) error
	GetReturnByID(ctx context.Context, id string) (*model.ReturnRequest, error)
	ListReturnsByOrderID(ctx context.Context, orderID string) ([]*model.ReturnRequest, error)
	UpdateReturnStatus(ctx context.Context, id string, status model.ReturnStatus, actorID, actorRole, message string, outbox *model.OutboxMessage) error
	ListAll(ctx context.Context, filters model.OrderFilters) ([]*model.Order, int64, error)
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
			shipping_recipient_name, shipping_phone, total_price, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`
	shippingRecipientName, shippingPhone := shippingAddressColumns(order.ShippingAddress)
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

	return tx.Commit()
}

func (r *postgresOrderRepository) GetByID(ctx context.Context, id string) (*model.Order, error) {
	orderQuery := `
		SELECT id, user_id, status, subtotal_price, discount_amount, coupon_code, shipping_method, shipping_fee,
		       shipping_recipient_name, shipping_phone,
		       total_price, created_at, updated_at
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
		       shipping_recipient_name, shipping_phone,
		       total_price, created_at, updated_at
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
		SELECT id, order_id, user_id, user_email, status, reason, created_at, updated_at
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
		SELECT id, order_id, user_id, user_email, status, reason, created_at, updated_at
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
		        shipping_recipient_name, shipping_phone,
		        total_price, created_at, updated_at %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
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

	query := `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`
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
	if shippingRecipientName.Valid || shippingPhone.Valid {
		order.ShippingAddress = &model.ShippingAddress{
			RecipientName: shippingRecipientName.String,
			Phone:         shippingPhone.String,
		}
	}
	return order, nil
}

func shippingAddressColumns(address *model.ShippingAddress) (any, any) {
	if address == nil {
		return nil, nil
	}

	return nullIfEmpty(address.RecipientName),
		nullIfEmpty(address.Phone)
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
	if err := scanner.Scan(
		&returnRequest.ID,
		&returnRequest.OrderID,
		&returnRequest.UserID,
		&returnRequest.UserEmail,
		&returnRequest.Status,
		&returnRequest.Reason,
		&returnRequest.CreatedAt,
		&returnRequest.UpdatedAt,
	); err != nil {
		return nil, err
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

	returnRequest.Items = items
	returnRequest.Events = events
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

	updateResult, err := tx.ExecContext(ctx, `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`, nextStatus, orderID)
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
