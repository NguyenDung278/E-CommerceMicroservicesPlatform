package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

type OrderRepository interface {
	Create(ctx context.Context, order *model.Order) error
	GetByID(ctx context.Context, id string) (*model.Order, error)
	GetByUserID(ctx context.Context, userID string) ([]*model.Order, error)
	UpdateStatus(ctx context.Context, id string, status model.OrderStatus) error
}

type postgresOrderRepository struct {
	db *sql.DB
}

func NewOrderRepository(db *sql.DB) OrderRepository {
	return &postgresOrderRepository{db: db}
}

// Create inserts an order and its items in a single transaction.
// WHY TRANSACTION: An order without items is invalid. If item insertion fails,
// the entire order must be rolled back to maintain data consistency.
func (r *postgresOrderRepository) Create(ctx context.Context, order *model.Order) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	// PITFALL: Always defer rollback. If tx.Commit() is called first, rollback is a no-op.
	defer tx.Rollback()

	// Insert the order.
	orderQuery := `
		INSERT INTO orders (id, user_id, status, total_price, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err = tx.ExecContext(ctx, orderQuery,
		order.ID, order.UserID, order.Status, order.TotalPrice,
		order.CreatedAt, order.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create order: %w", err)
	}

	// Insert each order item.
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

	return tx.Commit()
}

func (r *postgresOrderRepository) GetByID(ctx context.Context, id string) (*model.Order, error) {
	orderQuery := `SELECT id, user_id, status, total_price, created_at, updated_at FROM orders WHERE id = $1`

	order := &model.Order{}
	err := r.db.QueryRowContext(ctx, orderQuery, id).Scan(
		&order.ID, &order.UserID, &order.Status, &order.TotalPrice,
		&order.CreatedAt, &order.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get order: %w", err)
	}

	// Load order items.
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

	return order, nil
}

func (r *postgresOrderRepository) GetByUserID(ctx context.Context, userID string) ([]*model.Order, error) {
	query := `SELECT id, user_id, status, total_price, created_at, updated_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC`

	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list orders: %w", err)
	}
	defer rows.Close()

	var orders []*model.Order
	for rows.Next() {
		o := &model.Order{}
		if err := rows.Scan(&o.ID, &o.UserID, &o.Status, &o.TotalPrice, &o.CreatedAt, &o.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan order: %w", err)
		}
		orders = append(orders, o)
	}
	return orders, nil
}

func (r *postgresOrderRepository) UpdateStatus(ctx context.Context, id string, status model.OrderStatus) error {
	query := `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, status, id)
	if err != nil {
		return fmt.Errorf("failed to update order status: %w", err)
	}
	return nil
}
