// Ghi dữ liệu workbook vào PostgreSQL trong transaction của ImportWorkbook.
// Mọi câu lệnh đều là upsert idempotent (ON CONFLICT DO UPDATE).

package importer

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

func upsertCategories(ctx context.Context, tx *sql.Tx, rows []CategoryRow) error {
	for _, row := range rows {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO categories (
				slug, display_name, nav_label, status, hero, filter_config, seo, created_at, updated_at
			)
			VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9)
			ON CONFLICT (slug) DO UPDATE
			SET display_name = EXCLUDED.display_name,
			    nav_label = EXCLUDED.nav_label,
			    status = EXCLUDED.status,
			    hero = EXCLUDED.hero,
			    filter_config = EXCLUDED.filter_config,
			    seo = EXCLUDED.seo,
			    updated_at = EXCLUDED.updated_at
		`, row.Slug, row.DisplayName, row.NavLabel, row.Status, string(row.Hero), string(row.FilterConfig), string(row.SEO), row.CreatedAt, row.UpdatedAt); err != nil {
			return fmt.Errorf("failed to upsert category %q: %w", row.Slug, err)
		}
	}

	return nil
}

func upsertCategoryAliases(ctx context.Context, tx *sql.Tx, rows []CategoryAliasRow) error {
	for _, row := range rows {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO category_aliases (category_slug, alias)
			VALUES ($1, $2)
			ON CONFLICT (alias) DO UPDATE
			SET category_slug = EXCLUDED.category_slug
		`, row.CategorySlug, row.Alias); err != nil {
			return fmt.Errorf("failed to upsert category alias %q: %w", row.Alias, err)
		}
	}

	return nil
}

func upsertProducts(ctx context.Context, tx *sql.Tx, products []ProductRow, variants []VariantRow) error {
	variantsByExternalID := make(map[string][]VariantRow)
	for _, variant := range variants {
		variantsByExternalID[variant.ProductExternalID] = append(variantsByExternalID[variant.ProductExternalID], variant)
	}

	for _, product := range products {
		productVariants := buildVariantPayload(variantsByExternalID[product.ExternalID])
		variantsJSON, err := json.Marshal(productVariants.Payload)
		if err != nil {
			return fmt.Errorf("failed to encode variants for product %q: %w", product.ExternalID, err)
		}
		imageURLsJSON, err := json.Marshal(productVariants.ImageURLs)
		if err != nil {
			return fmt.Errorf("failed to encode image URLs for product %q: %w", product.ExternalID, err)
		}

		productID := product.ID
		if productID == "" {
			productID = uuid.NewString()
		}
		sku := product.ExternalID

		if _, err := tx.ExecContext(ctx, `
			INSERT INTO products (
				id, external_id, name, description, price, stock, category, category_slug, brand, tags, status, sku, variants, image_url, image_urls, material, merchandising_rank, created_at, updated_at
			)
			VALUES (
				$1, $2, $3, '', $4, $5, $6, $7, '', '[]'::jsonb, 'active', $8, $9::jsonb, $10, $11::jsonb, $12, $13, NOW(), $14
			)
			ON CONFLICT (external_id) DO UPDATE
			SET name = EXCLUDED.name,
			    price = EXCLUDED.price,
			    stock = EXCLUDED.stock,
			    category = EXCLUDED.category,
			    category_slug = EXCLUDED.category_slug,
			    material = EXCLUDED.material,
			    merchandising_rank = EXCLUDED.merchandising_rank,
			    sku = CASE WHEN products.sku = '' THEN EXCLUDED.sku ELSE products.sku END,
			    variants = CASE
			        WHEN jsonb_array_length(EXCLUDED.variants) > 0 THEN EXCLUDED.variants
			        ELSE products.variants
			    END,
			    image_url = CASE
			        WHEN EXCLUDED.image_url <> '' THEN EXCLUDED.image_url
			        ELSE products.image_url
			    END,
			    image_urls = CASE
			        WHEN jsonb_array_length(EXCLUDED.image_urls) > 0 THEN EXCLUDED.image_urls
			        ELSE products.image_urls
			    END,
			    updated_at = EXCLUDED.updated_at
		`, productID, product.ExternalID, product.Name, product.Price, product.Stock, product.Category, nullableText(product.CategorySlug), sku, string(variantsJSON), productVariants.PrimaryImage, string(imageURLsJSON), product.Material, product.MerchandisingRank, product.UpdatedAt); err != nil {
			return fmt.Errorf("failed to upsert product %q: %w", product.ExternalID, err)
		}
	}

	return nil
}

func upsertEditorialSections(ctx context.Context, tx *sql.Tx, rows []EditorialSectionRow) error {
	for _, row := range rows {
		sectionID := row.ID
		if sectionID == "" {
			sectionID = uuid.NewString()
		}

		if _, err := tx.ExecContext(ctx, `
			INSERT INTO editorial_sections (
				id, category_slug, section_type, position, payload, published
			)
			VALUES ($1, $2, $3, $4, $5::jsonb, $6)
			ON CONFLICT (id) DO UPDATE
			SET category_slug = EXCLUDED.category_slug,
			    section_type = EXCLUDED.section_type,
			    position = EXCLUDED.position,
			    payload = EXCLUDED.payload,
			    published = EXCLUDED.published
		`, sectionID, row.CategorySlug, row.SectionType, row.Position, string(row.Payload), row.Published); err != nil {
			return fmt.Errorf("failed to upsert editorial section %q: %w", sectionID, err)
		}
	}

	return nil
}

func upsertFeaturedProducts(ctx context.Context, tx *sql.Tx, rows []FeaturedProductRow) error {
	for _, row := range rows {
		featuredID := row.ID
		if featuredID == "" {
			featuredID = uuid.NewString()
		}

		if _, err := tx.ExecContext(ctx, `
			INSERT INTO featured_products (
				id, product_external_id, category_slug, position
			)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (category_slug, position) DO UPDATE
			SET product_external_id = EXCLUDED.product_external_id
		`, featuredID, row.ProductExternalID, row.CategorySlug, row.Position); err != nil {
			return fmt.Errorf("failed to upsert featured product %q/%d: %w", row.CategorySlug, row.Position, err)
		}
	}

	return nil
}

type productVariantsPayload struct {
	Payload      []map[string]any
	ImageURLs    []string
	PrimaryImage string
}

func buildVariantPayload(rows []VariantRow) productVariantsPayload {
	if len(rows) == 0 {
		return productVariantsPayload{
			Payload:   []map[string]any{},
			ImageURLs: []string{},
		}
	}

	imageSeen := map[string]struct{}{}
	imageURLs := make([]string, 0, len(rows))
	payload := make([]map[string]any, 0, len(rows))

	for _, row := range rows {
		label := deriveVariantLabel(row)
		payload = append(payload, map[string]any{
			"sku":   row.SKU,
			"label": label,
			"size":  row.Size,
			"color": row.Color,
			"price": row.Price,
			"stock": row.Stock,
		})

		if row.ImageURL == "" {
			continue
		}
		if _, exists := imageSeen[row.ImageURL]; exists {
			continue
		}
		imageSeen[row.ImageURL] = struct{}{}
		imageURLs = append(imageURLs, row.ImageURL)
	}

	return productVariantsPayload{
		Payload:      payload,
		ImageURLs:    imageURLs,
		PrimaryImage: firstOrEmpty(imageURLs),
	}
}

func deriveVariantLabel(row VariantRow) string {
	parts := make([]string, 0, 2)
	if row.Size != "" {
		parts = append(parts, row.Size)
	}
	if row.Color != "" {
		parts = append(parts, row.Color)
	}
	if len(parts) > 0 {
		return strings.Join(parts, " / ")
	}
	return row.SKU
}
