package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/lib/pq"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

type storefrontScanner interface {
	Scan(dest ...interface{}) error
}

// StorefrontRepository provides read access for public category/editorial
// storefront pages.
type StorefrontRepository interface {
	ListCategories(ctx context.Context) ([]*model.StorefrontCategory, error)
	GetCategoryByIdentifier(ctx context.Context, identifier string) (*model.StorefrontCategory, error)
	ListEditorialSections(ctx context.Context, categorySlug string) ([]*model.StorefrontEditorialSection, error)
	ListEditorialSectionsByCategorySlugs(ctx context.Context, categorySlugs []string) (map[string][]*model.StorefrontEditorialSection, error)
	ListFeaturedProducts(ctx context.Context, categorySlug string) ([]*model.StorefrontFeaturedProduct, error)
	ListFeaturedProductsByCategorySlugs(ctx context.Context, categorySlugs []string) (map[string][]*model.StorefrontFeaturedProduct, error)
}

type postgresStorefrontRepository struct {
	db *sql.DB
}

// NewStorefrontRepository creates a PostgreSQL-backed storefront repository.
func NewStorefrontRepository(db *sql.DB) StorefrontRepository {
	return &postgresStorefrontRepository{db: db}
}

func (r *postgresStorefrontRepository) ListCategories(ctx context.Context) ([]*model.StorefrontCategory, error) {
	const query = `
		SELECT
			c.slug,
			c.display_name,
			c.nav_label,
			c.status,
			c.hero,
			c.filter_config,
			c.seo,
			c.created_at,
			c.updated_at,
			COALESCE(array_remove(array_agg(ca.alias ORDER BY ca.alias), NULL), '{}') AS aliases
		FROM categories c
		LEFT JOIN category_aliases ca ON ca.category_slug = c.slug
		WHERE c.status = 'active'
		GROUP BY c.slug, c.display_name, c.nav_label, c.status, c.hero, c.filter_config, c.seo, c.created_at, c.updated_at
		ORDER BY c.display_name ASC, c.slug ASC
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list storefront categories: %w", err)
	}
	defer rows.Close()

	categories := make([]*model.StorefrontCategory, 0)
	for rows.Next() {
		category, scanErr := scanStorefrontCategory(rows)
		if scanErr != nil {
			return nil, fmt.Errorf("failed to scan storefront category: %w", scanErr)
		}
		categories = append(categories, category)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate storefront categories: %w", err)
	}

	return categories, nil
}

func (r *postgresStorefrontRepository) GetCategoryByIdentifier(ctx context.Context, identifier string) (*model.StorefrontCategory, error) {
	const query = `
		WITH matched_category AS (
			SELECT c.slug
			FROM categories c
			WHERE c.status = 'active' AND lower(c.slug) = lower($1)
			UNION
			SELECT ca.category_slug
			FROM category_aliases ca
			JOIN categories c ON c.slug = ca.category_slug
			WHERE c.status = 'active' AND lower(ca.alias) = lower($1)
		)
		SELECT
			c.slug,
			c.display_name,
			c.nav_label,
			c.status,
			c.hero,
			c.filter_config,
			c.seo,
			c.created_at,
			c.updated_at,
			COALESCE(array_remove(array_agg(ca.alias ORDER BY ca.alias), NULL), '{}') AS aliases
		FROM categories c
		LEFT JOIN category_aliases ca ON ca.category_slug = c.slug
		JOIN matched_category mc ON mc.slug = c.slug
		WHERE c.status = 'active'
		GROUP BY c.slug, c.display_name, c.nav_label, c.status, c.hero, c.filter_config, c.seo, c.created_at, c.updated_at
		ORDER BY c.display_name ASC, c.slug ASC
		LIMIT 1
	`

	category, err := scanStorefrontCategory(r.db.QueryRowContext(ctx, query, strings.TrimSpace(identifier)))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get storefront category by identifier: %w", err)
	}

	return category, nil
}

func (r *postgresStorefrontRepository) ListEditorialSections(ctx context.Context, categorySlug string) ([]*model.StorefrontEditorialSection, error) {
	sectionsBySlug, err := r.ListEditorialSectionsByCategorySlugs(ctx, []string{categorySlug})
	if err != nil {
		return nil, err
	}

	return sectionsBySlug[strings.TrimSpace(categorySlug)], nil
}

func (r *postgresStorefrontRepository) ListEditorialSectionsByCategorySlugs(ctx context.Context, categorySlugs []string) (map[string][]*model.StorefrontEditorialSection, error) {
	normalizedSlugs := normalizeCategorySlugs(categorySlugs)
	sectionsBySlug := make(map[string][]*model.StorefrontEditorialSection, len(normalizedSlugs))
	for _, slug := range normalizedSlugs {
		sectionsBySlug[slug] = []*model.StorefrontEditorialSection{}
	}
	if len(normalizedSlugs) == 0 {
		return sectionsBySlug, nil
	}

	const query = `
		SELECT id, category_slug, section_type, position, payload, published
		FROM editorial_sections
		WHERE category_slug = ANY($1) AND published = true
		ORDER BY category_slug ASC, position ASC, id ASC
	`

	rows, err := r.db.QueryContext(ctx, query, pq.Array(normalizedSlugs))
	if err != nil {
		return nil, fmt.Errorf("failed to list editorial sections: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		section, scanErr := scanStorefrontEditorialSection(rows)
		if scanErr != nil {
			return nil, fmt.Errorf("failed to scan editorial section: %w", scanErr)
		}
		sectionsBySlug[section.CategorySlug] = append(sectionsBySlug[section.CategorySlug], section)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate editorial sections: %w", err)
	}

	return sectionsBySlug, nil
}

func (r *postgresStorefrontRepository) ListFeaturedProducts(ctx context.Context, categorySlug string) ([]*model.StorefrontFeaturedProduct, error) {
	productsBySlug, err := r.ListFeaturedProductsByCategorySlugs(ctx, []string{categorySlug})
	if err != nil {
		return nil, err
	}

	return productsBySlug[strings.TrimSpace(categorySlug)], nil
}

func (r *postgresStorefrontRepository) ListFeaturedProductsByCategorySlugs(ctx context.Context, categorySlugs []string) (map[string][]*model.StorefrontFeaturedProduct, error) {
	normalizedSlugs := normalizeCategorySlugs(categorySlugs)
	productsBySlug := make(map[string][]*model.StorefrontFeaturedProduct, len(normalizedSlugs))
	for _, slug := range normalizedSlugs {
		productsBySlug[slug] = []*model.StorefrontFeaturedProduct{}
	}
	if len(normalizedSlugs) == 0 {
		return productsBySlug, nil
	}

	const query = `
		SELECT
			fp.id,
			fp.product_external_id,
			fp.category_slug,
			fp.position,
			p.id,
			COALESCE(p.external_id, ''),
			p.name,
			p.description,
			p.price,
			p.stock,
			p.category,
			COALESCE(p.category_slug, ''),
			p.brand,
			p.material,
			p.tags,
			p.status,
			p.sku,
			p.variants,
			p.image_url,
			p.image_urls,
			p.merchandising_rank,
			p.created_at,
			p.updated_at
		FROM featured_products fp
		JOIN products p ON p.external_id = fp.product_external_id
		WHERE fp.category_slug = ANY($1) AND p.status = 'active'
		ORDER BY fp.category_slug ASC, fp.position ASC, p.updated_at DESC, p.id DESC
	`

	rows, err := r.db.QueryContext(ctx, query, pq.Array(normalizedSlugs))
	if err != nil {
		return nil, fmt.Errorf("failed to list featured storefront products: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		product, scanErr := scanStorefrontFeaturedProduct(rows)
		if scanErr != nil {
			return nil, fmt.Errorf("failed to scan featured storefront product: %w", scanErr)
		}
		productsBySlug[product.CategorySlug] = append(productsBySlug[product.CategorySlug], product)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate featured storefront products: %w", err)
	}

	return productsBySlug, nil
}

func scanStorefrontCategory(scanner storefrontScanner) (*model.StorefrontCategory, error) {
	var (
		category     model.StorefrontCategory
		hero         []byte
		filterConfig []byte
		seo          []byte
		aliases      pq.StringArray
	)

	if err := scanner.Scan(
		&category.Slug,
		&category.DisplayName,
		&category.NavLabel,
		&category.Status,
		&hero,
		&filterConfig,
		&seo,
		&category.CreatedAt,
		&category.UpdatedAt,
		&aliases,
	); err != nil {
		return nil, err
	}

	category.Hero = normalizeStorefrontJSON(hero, `{}`)
	category.FilterConfig = normalizeStorefrontJSON(filterConfig, `[]`)
	category.SEO = normalizeStorefrontJSON(seo, `{}`)
	category.Aliases = normalizeStringSlice(aliases)

	return &category, nil
}

func scanStorefrontEditorialSection(scanner storefrontScanner) (*model.StorefrontEditorialSection, error) {
	var (
		section model.StorefrontEditorialSection
		payload []byte
	)

	if err := scanner.Scan(
		&section.ID,
		&section.CategorySlug,
		&section.SectionType,
		&section.Position,
		&payload,
		&section.Published,
	); err != nil {
		return nil, err
	}

	section.Payload = normalizeStorefrontJSON(payload, `{}`)

	return &section, nil
}

func scanStorefrontFeaturedProduct(scanner storefrontScanner) (*model.StorefrontFeaturedProduct, error) {
	var (
		featured   model.StorefrontFeaturedProduct
		product    model.StorefrontProduct
		categoryID sql.NullString
		tagsJSON   []byte
		variants   []byte
		imageURLs  []byte
	)

	if err := scanner.Scan(
		&featured.ID,
		&featured.ProductExternalID,
		&featured.CategorySlug,
		&featured.Position,
		&product.ID,
		&product.ExternalID,
		&product.Name,
		&product.Description,
		&product.Price,
		&product.Stock,
		&product.Category,
		&categoryID,
		&product.Brand,
		&product.Material,
		&tagsJSON,
		&product.Status,
		&product.SKU,
		&variants,
		&product.ImageURL,
		&imageURLs,
		&product.MerchandisingRank,
		&product.CreatedAt,
		&product.UpdatedAt,
	); err != nil {
		return nil, err
	}

	product.CategorySlug = categoryID.String
	if err := json.Unmarshal(tagsJSON, &product.Tags); err != nil {
		return nil, fmt.Errorf("failed to unmarshal storefront product tags: %w", err)
	}
	if err := json.Unmarshal(variants, &product.Variants); err != nil {
		return nil, fmt.Errorf("failed to unmarshal storefront product variants: %w", err)
	}
	if err := json.Unmarshal(imageURLs, &product.ImageURLs); err != nil {
		return nil, fmt.Errorf("failed to unmarshal storefront product image_urls: %w", err)
	}

	featured.Product = &product

	return &featured, nil
}

func normalizeStorefrontJSON(raw []byte, fallback string) json.RawMessage {
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" {
		return json.RawMessage(fallback)
	}

	return json.RawMessage(trimmed)
}

func normalizeStringSlice(values []string) []string {
	normalized := make([]string, 0, len(values))
	for _, value := range values {
		if clean := strings.TrimSpace(value); clean != "" {
			normalized = append(normalized, clean)
		}
	}
	return normalized
}

func normalizeCategorySlugs(values []string) []string {
	normalized := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		clean := strings.TrimSpace(value)
		if clean == "" {
			continue
		}
		if _, exists := seen[clean]; exists {
			continue
		}
		seen[clean] = struct{}{}
		normalized = append(normalized, clean)
	}

	return normalized
}
