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
	Create(ctx context.Context, order *model.Order) error
	GetByID(ctx context.Context, id string) (*model.Order, error)
	GetByUserID(ctx context.Context, userID string) ([]*model.Order, error)
	ListAll(ctx context.Context, filters model.OrderFilters) ([]*model.Order, int64, error)
	GetEventsByOrderID(ctx context.Context, orderID string) ([]*model.OrderEvent, error)
	UpdateStatus(ctx context.Context, id string, status model.OrderStatus, actorID, actorRole, message string) error
	CreateCoupon(ctx context.Context, coupon *model.Coupon) error
	ListCoupons(ctx context.Context) ([]*model.Coupon, error)
	GetCouponByCode(ctx context.Context, code string) (*model.Coupon, error)
	GetAdminReport(ctx context.Context, from time.Time, to time.Time, windowDays int) (*model.AdminReport, error)
	ListPopularProducts(ctx context.Context, limit int) ([]model.ProductPopularity, error)
	CreateAuditEntry(ctx context.Context, entry *model.AuditEntry) error
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
func (r *postgresOrderRepository) Create(ctx context.Context, order *model.Order) error {
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
			shipping_recipient_name, shipping_phone, shipping_street, shipping_ward, shipping_district, shipping_city,
			total_price, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
	`
	shippingRecipientName, shippingPhone, shippingStreet, shippingWard, shippingDistrict, shippingCity := shippingAddressColumns(order.ShippingAddress)
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
		shippingStreet,
		shippingWard,
		shippingDistrict,
		shippingCity,
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

	return tx.Commit()
}

func (r *postgresOrderRepository) GetByID(ctx context.Context, id string) (*model.Order, error) {
	orderQuery := `
		SELECT id, user_id, status, subtotal_price, discount_amount, coupon_code, shipping_method, shipping_fee,
		       shipping_recipient_name, shipping_phone, shipping_street, shipping_ward, shipping_district, shipping_city,
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
		       shipping_recipient_name, shipping_phone, shipping_street, shipping_ward, shipping_district, shipping_city,
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
		        shipping_recipient_name, shipping_phone, shipping_street, shipping_ward, shipping_district, shipping_city,
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

func (r *postgresOrderRepository) UpdateStatus(ctx context.Context, id string, status model.OrderStatus, actorID, actorRole, message string) error {
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
	var shippingStreet sql.NullString
	var shippingWard sql.NullString
	var shippingDistrict sql.NullString
	var shippingCity sql.NullString
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
		&shippingStreet,
		&shippingWard,
		&shippingDistrict,
		&shippingCity,
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
	if shippingRecipientName.Valid || shippingPhone.Valid || shippingStreet.Valid || shippingDistrict.Valid || shippingCity.Valid {
		order.ShippingAddress = &model.ShippingAddress{
			RecipientName: shippingRecipientName.String,
			Phone:         shippingPhone.String,
			Street:        shippingStreet.String,
			Ward:          shippingWard.String,
			District:      shippingDistrict.String,
			City:          shippingCity.String,
		}
	}
	return order, nil
}

func shippingAddressColumns(address *model.ShippingAddress) (any, any, any, any, any, any) {
	if address == nil {
		return nil, nil, nil, nil, nil, nil
	}

	return nullIfEmpty(address.RecipientName),
		nullIfEmpty(address.Phone),
		nullIfEmpty(address.Street),
		nullIfEmpty(address.Ward),
		nullIfEmpty(address.District),
		nullIfEmpty(address.City)
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

func nullIfEmpty(value string) interface{} {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}
