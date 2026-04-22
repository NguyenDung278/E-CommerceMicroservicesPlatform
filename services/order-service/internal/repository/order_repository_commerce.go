package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

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
