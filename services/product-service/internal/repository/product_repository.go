package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/lib/pq"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

// ProductRepository defines the interface for product data access.
type ProductRepository interface {
	Create(ctx context.Context, product *model.Product) error
	GetByID(ctx context.Context, id string) (*model.Product, error)
	Update(ctx context.Context, product *model.Product) error
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, offset, limit int, category, brand, tag, status, search string, minPrice, maxPrice float64, size, color, sort string) ([]*model.Product, int64, error)
	ListByIDs(ctx context.Context, ids []string) ([]*model.Product, error)
	ListForSearchIndex(ctx context.Context) ([]*model.Product, error)
	UpdateStock(ctx context.Context, id string, quantity int) error
	RestoreStock(ctx context.Context, id string, quantity int) error
	ListLowStock(ctx context.Context, threshold int) ([]*model.Product, error)
	CreateReview(ctx context.Context, review *model.ProductReview) error
	GetReviewByProductAndUser(ctx context.Context, productID, userID string) (*model.ProductReview, error)
	UpdateReview(ctx context.Context, review *model.ProductReview) error
	DeleteReviewByProductAndUser(ctx context.Context, productID, userID string) (bool, error)
	ListReviewsByProduct(ctx context.Context, productID string, offset, limit int) ([]*model.ProductReview, int64, error)
	GetReviewSummary(ctx context.Context, productID string) (*model.ProductReviewSummary, error)
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
		INSERT INTO products (
			id, name, description, price, stock, category, brand, tags, status, sku, variants, image_url, image_urls, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11::jsonb, $12, $13::jsonb, $14, $15)
	`
	_, err := r.db.ExecContext(ctx, query,
		product.ID,
		product.Name,
		product.Description,
		product.Price,
		product.Stock,
		product.Category,
		product.Brand,
		mustJSON(product.Tags),
		product.Status,
		product.SKU,
		mustJSON(product.Variants),
		product.ImageURL,
		mustJSON(product.ImageURLs),
		product.CreatedAt,
		product.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create product: %w", err)
	}
	return nil
}

func (r *postgresProductRepository) GetByID(ctx context.Context, id string) (*model.Product, error) {
	query := `
		SELECT id, name, description, price, stock, category, brand, tags, status, sku, variants, image_url, image_urls, created_at, updated_at
		FROM products
		WHERE id = $1
	`

	product, err := r.scanProductRow(r.db.QueryRowContext(ctx, query, id))
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
		UPDATE products
		SET name = $1, description = $2, price = $3, stock = $4, category = $5, brand = $6,
		    tags = $7::jsonb, status = $8, sku = $9, variants = $10::jsonb, image_url = $11, image_urls = $12::jsonb, updated_at = $13
		WHERE id = $14
	`
	_, err := r.db.ExecContext(ctx, query,
		product.Name,
		product.Description,
		product.Price,
		product.Stock,
		product.Category,
		product.Brand,
		mustJSON(product.Tags),
		product.Status,
		product.SKU,
		mustJSON(product.Variants),
		product.ImageURL,
		mustJSON(product.ImageURLs),
		product.UpdatedAt,
		product.ID,
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

// List retrieves products with pagination plus catalog metadata filters.
//
// DESIGN PATTERN: Dynamic SQL Query Building.
// Hàm này là một ví dụ kinh điển về việc nối chuỗi an toàn trong Go:
// Do điều kiện lọc (Filters) từ người dùng có thể rỗng hoặc có, SQL Builder
// sẽ linh động build vế `WHERE` theo từng chuỗi, và gán tham số `$1`, `$2`
// vào array `args` để DB bind vào, ngăn chặn hoàn toàn lỗi SQL Injection.
func (r *postgresProductRepository) List(
	ctx context.Context,
	offset, limit int,
	category, brand, tag, status, search string,
	minPrice, maxPrice float64,
	size, color, sort string,
) ([]*model.Product, int64, error) {
	baseQuery := `FROM products WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if category != "" {
		baseQuery += fmt.Sprintf(` AND category = $%d`, argIdx)
		args = append(args, category)
		argIdx++
	}
	if brand != "" {
		baseQuery += fmt.Sprintf(` AND brand = $%d`, argIdx)
		args = append(args, brand)
		argIdx++
	}
	if tag != "" {
		baseQuery += fmt.Sprintf(` AND tags @> $%d::jsonb`, argIdx)
		args = append(args, mustJSON([]string{tag}))
		argIdx++
	}
	if status != "" {
		baseQuery += fmt.Sprintf(` AND status = $%d`, argIdx)
		args = append(args, status)
		argIdx++
	}
	if search != "" {
		baseQuery += fmt.Sprintf(` AND (name ILIKE $%d OR description ILIKE $%d OR category ILIKE $%d OR brand ILIKE $%d OR sku ILIKE $%d)`,
			argIdx, argIdx, argIdx, argIdx, argIdx,
		)
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if minPrice > 0 {
		baseQuery += fmt.Sprintf(` AND price >= $%d`, argIdx)
		args = append(args, minPrice)
		argIdx++
	}
	if maxPrice > 0 {
		baseQuery += fmt.Sprintf(` AND price <= $%d`, argIdx)
		args = append(args, maxPrice)
		argIdx++
	}
	if size != "" {
		baseQuery += fmt.Sprintf(` AND EXISTS (
			SELECT 1
			FROM jsonb_array_elements(variants) AS variant
			WHERE lower(COALESCE(variant->>'size', '')) = lower($%d)
		)`, argIdx)
		args = append(args, size)
		argIdx++
	}
	if color != "" {
		baseQuery += fmt.Sprintf(` AND EXISTS (
			SELECT 1
			FROM jsonb_array_elements(variants) AS variant
			WHERE lower(COALESCE(variant->>'color', '')) = lower($%d)
		)`, argIdx)
		args = append(args, color)
		argIdx++
	}

	var total int64
	countQuery := `SELECT COUNT(*) ` + baseQuery
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count products: %w", err)
	}

	orderByClause := "created_at DESC"
	switch sort {
	case "price_asc":
		orderByClause = "price ASC, created_at DESC"
	case "price_desc":
		orderByClause = "price DESC, created_at DESC"
	case "popular":
		// Until we add cross-service sales signals, keep "popular" deterministic
		// by ranking high-stock active products first, then newest arrivals.
		orderByClause = "stock DESC, created_at DESC"
	}

	selectQuery := fmt.Sprintf(`
		SELECT id, name, description, price, stock, category, brand, tags, status, sku, variants, image_url, image_urls, created_at, updated_at
		%s
		ORDER BY %s
		LIMIT $%d OFFSET $%d
	`, baseQuery, orderByClause, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.db.QueryContext(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list products: %w", err)
	}
	defer rows.Close()

	var products []*model.Product
	for rows.Next() {
		product, err := r.scanProductRows(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan product: %w", err)
		}
		products = append(products, product)
	}

	return products, total, nil
}

func (r *postgresProductRepository) ListByIDs(ctx context.Context, ids []string) ([]*model.Product, error) {
	if len(ids) == 0 {
		return []*model.Product{}, nil
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, description, price, stock, category, brand, tags, status, sku, variants, image_url, image_urls, created_at, updated_at
		FROM products
		WHERE id = ANY($1)
	`, pq.Array(ids))
	if err != nil {
		return nil, fmt.Errorf("failed to list products by ids: %w", err)
	}
	defer rows.Close()

	byID := make(map[string]*model.Product, len(ids))
	for rows.Next() {
		product, err := r.scanProductRows(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan product by id: %w", err)
		}
		byID[product.ID] = product
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate products by ids: %w", err)
	}

	ordered := make([]*model.Product, 0, len(ids))
	for _, id := range ids {
		if product, ok := byID[id]; ok {
			ordered = append(ordered, product)
		}
	}

	return ordered, nil
}

func (r *postgresProductRepository) ListForSearchIndex(ctx context.Context) ([]*model.Product, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, description, price, stock, category, brand, tags, status, sku, variants, image_url, image_urls, created_at, updated_at
		FROM products
		ORDER BY updated_at DESC, created_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to list products for search index: %w", err)
	}
	defer rows.Close()

	products := make([]*model.Product, 0)
	for rows.Next() {
		product, err := r.scanProductRows(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan product for search index: %w", err)
		}
		products = append(products, product)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate products for search index: %w", err)
	}

	return products, nil
}

// UpdateStock atomically decrements the stock for a product.
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

// RestoreStock atomically increments the stock for a product (used when orders are cancelled).
func (r *postgresProductRepository) RestoreStock(ctx context.Context, id string, quantity int) error {
	query := `UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2`
	result, err := r.db.ExecContext(ctx, query, quantity, id)
	if err != nil {
		return fmt.Errorf("failed to restore stock: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("product %s not found for stock restore", id)
	}
	return nil
}

func (r *postgresProductRepository) ListLowStock(ctx context.Context, threshold int) ([]*model.Product, error) {
	query := `
		SELECT id, name, description, price, stock, category, brand, tags, status, sku, variants, image_url, image_urls, created_at, updated_at
		FROM products
		WHERE status = $1 AND stock <= $2
		ORDER BY stock ASC, updated_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query, model.ProductStatusActive, threshold)
	if err != nil {
		return nil, fmt.Errorf("failed to list low stock products: %w", err)
	}
	defer rows.Close()

	var products []*model.Product
	for rows.Next() {
		product, err := r.scanProductRows(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan low stock product: %w", err)
		}
		products = append(products, product)
	}

	return products, nil
}

type productScanner interface {
	Scan(dest ...any) error
}

func (r *postgresProductRepository) scanProductRow(scanner productScanner) (*model.Product, error) {
	product := &model.Product{}
	var rawTags []byte
	var rawVariants []byte
	var rawImageURLs []byte

	err := scanner.Scan(
		&product.ID,
		&product.Name,
		&product.Description,
		&product.Price,
		&product.Stock,
		&product.Category,
		&product.Brand,
		&rawTags,
		&product.Status,
		&product.SKU,
		&rawVariants,
		&product.ImageURL,
		&rawImageURLs,
		&product.CreatedAt,
		&product.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(rawTags, &product.Tags); err != nil {
		return nil, fmt.Errorf("failed to decode product tags: %w", err)
	}
	if err := json.Unmarshal(rawVariants, &product.Variants); err != nil {
		return nil, fmt.Errorf("failed to decode product variants: %w", err)
	}
	if err := json.Unmarshal(rawImageURLs, &product.ImageURLs); err != nil {
		return nil, fmt.Errorf("failed to decode product image urls: %w", err)
	}

	return product, nil
}

func (r *postgresProductRepository) scanProductRows(rows *sql.Rows) (*model.Product, error) {
	return r.scanProductRow(rows)
}

func mustJSON(value any) string {
	body, err := json.Marshal(value)
	if err != nil {
		return "[]"
	}
	if string(body) == "null" {
		return "[]"
	}
	return string(body)
}
