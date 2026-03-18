package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

// ProductRepository defines the interface for product data access.
type ProductRepository interface {
	Create(ctx context.Context, product *model.Product) error
	GetByID(ctx context.Context, id string) (*model.Product, error)
	Update(ctx context.Context, product *model.Product) error
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, offset, limit int, category, search string) ([]*model.Product, int64, error)
	UpdateStock(ctx context.Context, id string, quantity int) error
}

type postgresProductRepository struct {
	db *sql.DB
}

// NewProductRepository creates a new PostgreSQL-backed product repository.
func NewProductRepository(db *sql.DB) ProductRepository {
	return &postgresProductRepository{db: db}
}

func (r *postgresProductRepository) Create(ctx context.Context, product *model.Product) error {
	query := `
		INSERT INTO products (id, name, description, price, stock, category, image_url, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := r.db.ExecContext(ctx, query,
		product.ID, product.Name, product.Description, product.Price,
		product.Stock, product.Category, product.ImageURL,
		product.CreatedAt, product.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create product: %w", err)
	}
	return nil
}

func (r *postgresProductRepository) GetByID(ctx context.Context, id string) (*model.Product, error) {
	query := `SELECT id, name, description, price, stock, category, image_url, created_at, updated_at FROM products WHERE id = $1`

	product := &model.Product{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&product.ID, &product.Name, &product.Description, &product.Price,
		&product.Stock, &product.Category, &product.ImageURL,
		&product.CreatedAt, &product.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get product: %w", err)
	}
	return product, nil
}

func (r *postgresProductRepository) Update(ctx context.Context, product *model.Product) error {
	query := `
		UPDATE products SET name=$1, description=$2, price=$3, stock=$4,
		category=$5, image_url=$6, updated_at=$7 WHERE id=$8
	`
	_, err := r.db.ExecContext(ctx, query,
		product.Name, product.Description, product.Price, product.Stock,
		product.Category, product.ImageURL, product.UpdatedAt, product.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update product: %w", err)
	}
	return nil
}

func (r *postgresProductRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM products WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete product: %w", err)
	}
	return nil
}

// List retrieves products with pagination, category filtering, and text search.
//
// WHY dynamic query building: We build the WHERE clause dynamically so that
// omitted filters don't affect the query. This is more efficient than fetching
// all products and filtering in Go.
//
// PITFALL: Always use parameterized queries even for dynamic SQL.
func (r *postgresProductRepository) List(ctx context.Context, offset, limit int, category, search string) ([]*model.Product, int64, error) {
	baseQuery := `FROM products WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if category != "" {
		baseQuery += fmt.Sprintf(` AND category = $%d`, argIdx)
		args = append(args, category)
		argIdx++
	}
	if search != "" {
		baseQuery += fmt.Sprintf(` AND (name ILIKE $%d OR description ILIKE $%d)`, argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}

	// Count total results for pagination metadata.
	var total int64
	countQuery := `SELECT COUNT(*) ` + baseQuery
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count products: %w", err)
	}

	// Fetch the page of results.
	selectQuery := fmt.Sprintf(
		`SELECT id, name, description, price, stock, category, image_url, created_at, updated_at %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		baseQuery, argIdx, argIdx+1,
	)
	args = append(args, limit, offset)

	rows, err := r.db.QueryContext(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list products: %w", err)
	}
	defer rows.Close()

	var products []*model.Product
	for rows.Next() {
		p := &model.Product{}
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.Stock, &p.Category, &p.ImageURL, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, 0, fmt.Errorf("failed to scan product: %w", err)
		}
		products = append(products, p)
	}
	return products, total, nil
}

// UpdateStock atomically decrements the stock for a product.
// IMPORTANT: Uses a WHERE clause to prevent negative stock (optimistic approach).
func (r *postgresProductRepository) UpdateStock(ctx context.Context, id string, quantity int) error {
	query := `UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2 AND stock >= $1`
	result, err := r.db.ExecContext(ctx, query, quantity, id)
	if err != nil {
		return fmt.Errorf("failed to update stock: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("insufficient stock for product %s", id)
	}
	return nil
}
