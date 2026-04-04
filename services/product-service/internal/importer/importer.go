package importer

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"go.uber.org/zap"
)

const (
	ModeDryRun = "dry-run"
	ModeCommit = "commit"
)

type Workbook struct {
	Categories        []CategoryRow
	CategoryAliases   []CategoryAliasRow
	Products          []ProductRow
	Variants          []VariantRow
	EditorialSections []EditorialSectionRow
	FeaturedProducts  []FeaturedProductRow
}

type CategoryRow struct {
	Slug         string
	DisplayName  string
	NavLabel     string
	Status       string
	Hero         json.RawMessage
	FilterConfig json.RawMessage
	SEO          json.RawMessage
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type CategoryAliasRow struct {
	CategorySlug string
	Alias        string
}

type ProductRow struct {
	ID                string
	ExternalID        string
	Name              string
	CategorySlug      string
	Category          string
	Price             float64
	Stock             int
	Material          string
	MerchandisingRank int
	UpdatedAt         time.Time
}

type VariantRow struct {
	ID                string
	ProductExternalID string
	SKU               string
	Size              string
	Color             string
	Stock             int
	Price             float64
	ImageURL          string
}

type EditorialSectionRow struct {
	ID           string
	CategorySlug string
	SectionType  string
	Position     int
	Payload      json.RawMessage
	Published    bool
}

type FeaturedProductRow struct {
	ID                string
	ProductExternalID string
	CategorySlug      string
	Position          int
}

type ImportReport struct {
	Mode              string
	Categories        int
	CategoryAliases   int
	Products          int
	Variants          int
	EditorialSections int
	FeaturedProducts  int
}

type Importer struct {
	db  *sql.DB
	log *zap.Logger
}

type ValidationErrors struct {
	items []string
}

func (e *ValidationErrors) Add(format string, args ...any) {
	e.items = append(e.items, fmt.Sprintf(format, args...))
}

func (e *ValidationErrors) Empty() bool {
	return len(e.items) == 0
}

func (e *ValidationErrors) Error() string {
	return strings.Join(e.items, "\n")
}

func New(db *sql.DB, log *zap.Logger) *Importer {
	return &Importer{db: db, log: log}
}

func (i *Importer) ImportWorkbook(ctx context.Context, workbookPath string, mode string) (*ImportReport, error) {
	normalizedMode := strings.TrimSpace(strings.ToLower(mode))
	if normalizedMode != ModeDryRun && normalizedMode != ModeCommit {
		return nil, fmt.Errorf("unsupported mode %q", mode)
	}

	workbook, err := LoadWorkbook(workbookPath)
	if err != nil {
		return nil, err
	}

	tx, err := i.db.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to start import transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if err := i.applyWorkbook(ctx, tx, workbook); err != nil {
		return nil, err
	}

	report := &ImportReport{
		Mode:              normalizedMode,
		Categories:        len(workbook.Categories),
		CategoryAliases:   len(workbook.CategoryAliases),
		Products:          len(workbook.Products),
		Variants:          len(workbook.Variants),
		EditorialSections: len(workbook.EditorialSections),
		FeaturedProducts:  len(workbook.FeaturedProducts),
	}

	if normalizedMode == ModeDryRun {
		i.log.Info("catalog import dry-run completed",
			zap.Int("categories", report.Categories),
			zap.Int("aliases", report.CategoryAliases),
			zap.Int("products", report.Products),
			zap.Int("variants", report.Variants),
			zap.Int("editorial_sections", report.EditorialSections),
			zap.Int("featured_products", report.FeaturedProducts),
		)
		return report, nil
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit import transaction: %w", err)
	}

	i.log.Info("catalog import committed",
		zap.Int("categories", report.Categories),
		zap.Int("aliases", report.CategoryAliases),
		zap.Int("products", report.Products),
		zap.Int("variants", report.Variants),
		zap.Int("editorial_sections", report.EditorialSections),
		zap.Int("featured_products", report.FeaturedProducts),
	)
	return report, nil
}

func LoadWorkbook(path string) (*Workbook, error) {
	file, err := excelize.OpenFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to open workbook: %w", err)
	}
	defer func() {
		_ = file.Close()
	}()

	workbook := &Workbook{}
	validation := &ValidationErrors{}

	requiredSheets := map[string][]string{
		"categories":         {"slug", "display_name", "nav_label", "status", "hero", "filter_config", "seo", "created_at", "updated_at"},
		"category_aliases":   {"category_slug", "alias"},
		"products":           {"id", "external_id", "name", "category_slug", "category", "price", "stock", "material", "merchandising_rank", "updated_at"},
		"editorial_sections": {"id", "category_slug", "section_type", "position", "payload", "published"},
	}

	optionalSheets := map[string][]string{
		"variants":          {"id", "product_external_id", "sku", "size", "color", "stock", "price", "image_url"},
		"featured_products": {"id", "product_external_id", "category_slug", "position"},
	}

	for sheetName, headers := range requiredSheets {
		rows, sheetErr := readSheet(file, sheetName, headers, true)
		if sheetErr != nil {
			return nil, sheetErr
		}
		switch sheetName {
		case "categories":
			workbook.Categories = parseCategories(rows, validation)
		case "category_aliases":
			workbook.CategoryAliases = parseCategoryAliases(rows, validation)
		case "products":
			workbook.Products = parseProducts(rows, validation)
		case "editorial_sections":
			workbook.EditorialSections = parseEditorialSections(rows, validation)
		}
	}

	for sheetName, headers := range optionalSheets {
		rows, sheetErr := readSheet(file, sheetName, headers, false)
		if sheetErr != nil {
			return nil, sheetErr
		}
		switch sheetName {
		case "variants":
			workbook.Variants = parseVariants(rows, validation)
		case "featured_products":
			workbook.FeaturedProducts = parseFeaturedProducts(rows, validation)
		}
	}

	validateWorkbookRelations(workbook, validation)
	if !validation.Empty() {
		return nil, validation
	}

	return workbook, nil
}

func (i *Importer) applyWorkbook(ctx context.Context, tx *sql.Tx, workbook *Workbook) error {
	if err := upsertCategories(ctx, tx, workbook.Categories); err != nil {
		return err
	}
	if err := upsertCategoryAliases(ctx, tx, workbook.CategoryAliases); err != nil {
		return err
	}
	if err := upsertProducts(ctx, tx, workbook.Products, workbook.Variants); err != nil {
		return err
	}
	if err := upsertEditorialSections(ctx, tx, workbook.EditorialSections); err != nil {
		return err
	}
	if err := upsertFeaturedProducts(ctx, tx, workbook.FeaturedProducts); err != nil {
		return err
	}

	return nil
}

func readSheet(file *excelize.File, sheetName string, expectedHeaders []string, required bool) ([][]string, error) {
	sheetIndex, err := file.GetSheetIndex(sheetName)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve sheet %q: %w", sheetName, err)
	}
	if sheetIndex == -1 {
		if required {
			return nil, fmt.Errorf("missing required sheet %q", sheetName)
		}
		return nil, nil
	}

	rows, err := file.GetRows(sheetName)
	if err != nil {
		return nil, fmt.Errorf("failed to read sheet %q: %w", sheetName, err)
	}
	if len(rows) == 0 {
		if required {
			return nil, fmt.Errorf("sheet %q is empty", sheetName)
		}
		return [][]string{}, nil
	}

	headers := padRow(rows[0], len(expectedHeaders))
	for index, expected := range expectedHeaders {
		if strings.TrimSpace(headers[index]) != expected {
			return nil, fmt.Errorf("sheet %q has invalid header at column %d: expected %q, got %q", sheetName, index+1, expected, headers[index])
		}
	}

	return rows[1:], nil
}

func parseCategories(rows [][]string, validation *ValidationErrors) []CategoryRow {
	result := make([]CategoryRow, 0, len(rows))
	for rowIndex, raw := range rows {
		row := padRow(raw, 9)
		if isBlankRow(row) {
			continue
		}

		hero, ok := parseJSONCell("categories", rowIndex+2, "hero", row[4], validation)
		if !ok {
			continue
		}
		filterConfig, ok := parseJSONCell("categories", rowIndex+2, "filter_config", row[5], validation)
		if !ok {
			continue
		}
		seo, ok := parseJSONCell("categories", rowIndex+2, "seo", row[6], validation)
		if !ok {
			continue
		}
		createdAt, ok := parseTimestampCell("categories", rowIndex+2, "created_at", row[7], validation)
		if !ok {
			continue
		}
		updatedAt, ok := parseTimestampCell("categories", rowIndex+2, "updated_at", row[8], validation)
		if !ok {
			continue
		}

		status := strings.TrimSpace(row[3])
		if status == "" {
			status = "active"
		}

		category := CategoryRow{
			Slug:         strings.TrimSpace(row[0]),
			DisplayName:  strings.TrimSpace(row[1]),
			NavLabel:     strings.TrimSpace(row[2]),
			Status:       status,
			Hero:         hero,
			FilterConfig: filterConfig,
			SEO:          seo,
			CreatedAt:    createdAt,
			UpdatedAt:    updatedAt,
		}

		if category.Slug == "" {
			validation.Add("categories row %d: slug is required", rowIndex+2)
			continue
		}
		if category.DisplayName == "" {
			validation.Add("categories row %d: display_name is required", rowIndex+2)
			continue
		}
		if category.NavLabel == "" {
			validation.Add("categories row %d: nav_label is required", rowIndex+2)
			continue
		}

		result = append(result, category)
	}

	return result
}

func parseCategoryAliases(rows [][]string, validation *ValidationErrors) []CategoryAliasRow {
	result := make([]CategoryAliasRow, 0, len(rows))
	for rowIndex, raw := range rows {
		row := padRow(raw, 2)
		if isBlankRow(row) {
			continue
		}

		item := CategoryAliasRow{
			CategorySlug: strings.TrimSpace(row[0]),
			Alias:        strings.TrimSpace(row[1]),
		}

		if item.CategorySlug == "" {
			validation.Add("category_aliases row %d: category_slug is required", rowIndex+2)
			continue
		}
		if item.Alias == "" {
			validation.Add("category_aliases row %d: alias is required", rowIndex+2)
			continue
		}

		result = append(result, item)
	}

	return result
}

func parseProducts(rows [][]string, validation *ValidationErrors) []ProductRow {
	result := make([]ProductRow, 0, len(rows))
	for rowIndex, raw := range rows {
		row := padRow(raw, 10)
		if isBlankRow(row) {
			continue
		}

		price, ok := parseFloatCell("products", rowIndex+2, "price", row[5], validation)
		if !ok {
			continue
		}
		stock, ok := parseIntCell("products", rowIndex+2, "stock", row[6], validation)
		if !ok {
			continue
		}
		rank, ok := parseIntCell("products", rowIndex+2, "merchandising_rank", row[8], validation)
		if !ok {
			continue
		}
		updatedAt, ok := parseTimestampCell("products", rowIndex+2, "updated_at", row[9], validation)
		if !ok {
			continue
		}

		item := ProductRow{
			ID:                normalizeOptionalID(row[0]),
			ExternalID:        strings.TrimSpace(row[1]),
			Name:              strings.TrimSpace(row[2]),
			CategorySlug:      strings.TrimSpace(row[3]),
			Category:          strings.TrimSpace(row[4]),
			Price:             price,
			Stock:             stock,
			Material:          strings.TrimSpace(row[7]),
			MerchandisingRank: rank,
			UpdatedAt:         updatedAt,
		}

		if item.ExternalID == "" {
			validation.Add("products row %d: external_id is required", rowIndex+2)
			continue
		}
		if item.Name == "" {
			validation.Add("products row %d: name is required", rowIndex+2)
			continue
		}
		if item.CategorySlug == "" {
			validation.Add("products row %d: category_slug is required", rowIndex+2)
			continue
		}
		if item.Category == "" {
			item.Category = item.CategorySlug
		}
		if item.Material == "" {
			item.Material = ""
		}
		if item.Price < 0 {
			validation.Add("products row %d: price must be non-negative", rowIndex+2)
			continue
		}
		if item.Stock < 0 {
			validation.Add("products row %d: stock must be non-negative", rowIndex+2)
			continue
		}

		result = append(result, item)
	}

	return result
}

func parseVariants(rows [][]string, validation *ValidationErrors) []VariantRow {
	result := make([]VariantRow, 0, len(rows))
	for rowIndex, raw := range rows {
		row := padRow(raw, 8)
		if isBlankRow(row) {
			continue
		}

		stock, ok := parseIntCell("variants", rowIndex+2, "stock", row[5], validation)
		if !ok {
			continue
		}
		price, ok := parseFloatCell("variants", rowIndex+2, "price", row[6], validation)
		if !ok {
			continue
		}

		item := VariantRow{
			ID:                normalizeOptionalID(row[0]),
			ProductExternalID: strings.TrimSpace(row[1]),
			SKU:               strings.TrimSpace(row[2]),
			Size:              strings.TrimSpace(row[3]),
			Color:             strings.TrimSpace(row[4]),
			Stock:             stock,
			Price:             price,
			ImageURL:          strings.TrimSpace(row[7]),
		}

		if item.ProductExternalID == "" {
			validation.Add("variants row %d: product_external_id is required", rowIndex+2)
			continue
		}
		if item.SKU == "" {
			validation.Add("variants row %d: sku is required", rowIndex+2)
			continue
		}
		if item.Stock < 0 {
			validation.Add("variants row %d: stock must be non-negative", rowIndex+2)
			continue
		}
		if item.Price < 0 {
			validation.Add("variants row %d: price must be non-negative", rowIndex+2)
			continue
		}

		result = append(result, item)
	}

	return result
}

func parseEditorialSections(rows [][]string, validation *ValidationErrors) []EditorialSectionRow {
	result := make([]EditorialSectionRow, 0, len(rows))
	for rowIndex, raw := range rows {
		row := padRow(raw, 6)
		if isBlankRow(row) {
			continue
		}

		position, ok := parseIntCell("editorial_sections", rowIndex+2, "position", row[3], validation)
		if !ok {
			continue
		}
		payload, ok := parseJSONCell("editorial_sections", rowIndex+2, "payload", row[4], validation)
		if !ok {
			continue
		}
		published, ok := parseBoolCell("editorial_sections", rowIndex+2, "published", row[5], validation)
		if !ok {
			continue
		}

		item := EditorialSectionRow{
			ID:           normalizeOptionalID(row[0]),
			CategorySlug: strings.TrimSpace(row[1]),
			SectionType:  strings.TrimSpace(row[2]),
			Position:     position,
			Payload:      payload,
			Published:    published,
		}

		if item.CategorySlug == "" {
			validation.Add("editorial_sections row %d: category_slug is required", rowIndex+2)
			continue
		}
		if item.SectionType == "" {
			validation.Add("editorial_sections row %d: section_type is required", rowIndex+2)
			continue
		}

		result = append(result, item)
	}

	return result
}

func parseFeaturedProducts(rows [][]string, validation *ValidationErrors) []FeaturedProductRow {
	result := make([]FeaturedProductRow, 0, len(rows))
	for rowIndex, raw := range rows {
		row := padRow(raw, 4)
		if isBlankRow(row) {
			continue
		}

		position, ok := parseIntCell("featured_products", rowIndex+2, "position", row[3], validation)
		if !ok {
			continue
		}

		item := FeaturedProductRow{
			ID:                normalizeOptionalID(row[0]),
			ProductExternalID: strings.TrimSpace(row[1]),
			CategorySlug:      strings.TrimSpace(row[2]),
			Position:          position,
		}

		if item.ProductExternalID == "" {
			validation.Add("featured_products row %d: product_external_id is required", rowIndex+2)
			continue
		}
		if item.CategorySlug == "" {
			validation.Add("featured_products row %d: category_slug is required", rowIndex+2)
			continue
		}

		result = append(result, item)
	}

	return result
}

func validateWorkbookRelations(workbook *Workbook, validation *ValidationErrors) {
	if len(workbook.Categories) == 0 {
		validation.Add("categories sheet must contain at least one row")
	}
	if len(workbook.Products) == 0 {
		validation.Add("products sheet must contain at least one row")
	}

	categorySlugs := make(map[string]struct{}, len(workbook.Categories))
	for _, category := range workbook.Categories {
		if _, exists := categorySlugs[category.Slug]; exists {
			validation.Add("duplicate categories.slug %q", category.Slug)
			continue
		}
		categorySlugs[category.Slug] = struct{}{}
	}

	aliases := make(map[string]struct{}, len(workbook.CategoryAliases))
	for _, alias := range workbook.CategoryAliases {
		if _, exists := categorySlugs[alias.CategorySlug]; !exists {
			validation.Add("category_aliases alias %q references unknown category_slug %q", alias.Alias, alias.CategorySlug)
		}
		key := strings.ToLower(alias.Alias)
		if _, exists := aliases[key]; exists {
			validation.Add("duplicate category_aliases.alias %q", alias.Alias)
			continue
		}
		aliases[key] = struct{}{}
	}

	productExternalIDs := make(map[string]ProductRow, len(workbook.Products))
	for _, product := range workbook.Products {
		if _, exists := categorySlugs[product.CategorySlug]; !exists {
			validation.Add("products external_id %q references unknown category_slug %q", product.ExternalID, product.CategorySlug)
		}
		if _, exists := productExternalIDs[product.ExternalID]; exists {
			validation.Add("duplicate products.external_id %q", product.ExternalID)
			continue
		}
		productExternalIDs[product.ExternalID] = product
	}

	variantsByProduct := make(map[string][]VariantRow)
	skuSet := map[string]struct{}{}
	for _, variant := range workbook.Variants {
		if _, exists := productExternalIDs[variant.ProductExternalID]; !exists {
			validation.Add("variants sku %q references unknown product_external_id %q", variant.SKU, variant.ProductExternalID)
		}
		if _, exists := skuSet[variant.SKU]; exists {
			validation.Add("duplicate variants.sku %q", variant.SKU)
			continue
		}
		skuSet[variant.SKU] = struct{}{}
		variantsByProduct[variant.ProductExternalID] = append(variantsByProduct[variant.ProductExternalID], variant)
	}

	for externalID, product := range productExternalIDs {
		variants := variantsByProduct[externalID]
		if len(variants) == 0 {
			continue
		}
		sumStock := 0
		for _, variant := range variants {
			sumStock += variant.Stock
		}
		if product.Stock != sumStock {
			validation.Add("products external_id %q has stock %d but variants sum to %d", externalID, product.Stock, sumStock)
		}
	}

	editorialSlots := map[string]struct{}{}
	for _, section := range workbook.EditorialSections {
		if _, exists := categorySlugs[section.CategorySlug]; !exists {
			validation.Add("editorial_sections id %q references unknown category_slug %q", section.ID, section.CategorySlug)
		}
		slot := fmt.Sprintf("%s:%d", section.CategorySlug, section.Position)
		if _, exists := editorialSlots[slot]; exists {
			validation.Add("duplicate editorial section position for category_slug %q at position %d", section.CategorySlug, section.Position)
			continue
		}
		editorialSlots[slot] = struct{}{}
	}

	featuredSlots := map[string]struct{}{}
	for _, product := range workbook.FeaturedProducts {
		if _, exists := categorySlugs[product.CategorySlug]; !exists {
			validation.Add("featured_products row for product_external_id %q references unknown category_slug %q", product.ProductExternalID, product.CategorySlug)
		}
		if _, exists := productExternalIDs[product.ProductExternalID]; !exists {
			validation.Add("featured_products row references unknown product_external_id %q", product.ProductExternalID)
		}
		slot := fmt.Sprintf("%s:%d", product.CategorySlug, product.Position)
		if _, exists := featuredSlots[slot]; exists {
			validation.Add("duplicate featured product position for category_slug %q at position %d", product.CategorySlug, product.Position)
			continue
		}
		featuredSlots[slot] = struct{}{}
	}
}

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

func parseJSONCell(sheet string, row int, column, value string, validation *ValidationErrors) (json.RawMessage, bool) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		validation.Add("%s row %d: %s is required", sheet, row, column)
		return nil, false
	}

	var parsed any
	if err := json.Unmarshal([]byte(trimmed), &parsed); err != nil {
		validation.Add("%s row %d: %s contains invalid JSON: %v", sheet, row, column, err)
		return nil, false
	}

	return json.RawMessage(trimmed), true
}

func parseTimestampCell(sheet string, row int, column, value string, validation *ValidationErrors) (time.Time, bool) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		validation.Add("%s row %d: %s is required", sheet, row, column)
		return time.Time{}, false
	}

	parsed, err := time.ParseInLocation("2006-01-02 15:04:05", trimmed, time.Local)
	if err != nil {
		validation.Add("%s row %d: %s must use YYYY-MM-DD HH:MM:SS", sheet, row, column)
		return time.Time{}, false
	}

	return parsed, true
}

func parseFloatCell(sheet string, row int, column, value string, validation *ValidationErrors) (float64, bool) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		validation.Add("%s row %d: %s is required", sheet, row, column)
		return 0, false
	}

	parsed, err := strconv.ParseFloat(trimmed, 64)
	if err != nil {
		validation.Add("%s row %d: %s must be numeric", sheet, row, column)
		return 0, false
	}
	if math.IsNaN(parsed) || math.IsInf(parsed, 0) {
		validation.Add("%s row %d: %s must be a finite number", sheet, row, column)
		return 0, false
	}

	return parsed, true
}

func parseIntCell(sheet string, row int, column, value string, validation *ValidationErrors) (int, bool) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		validation.Add("%s row %d: %s is required", sheet, row, column)
		return 0, false
	}

	parsed, err := strconv.Atoi(trimmed)
	if err != nil {
		validation.Add("%s row %d: %s must be an integer", sheet, row, column)
		return 0, false
	}

	return parsed, true
}

func parseBoolCell(sheet string, row int, column, value string, validation *ValidationErrors) (bool, bool) {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	if trimmed == "" {
		return true, true
	}

	switch trimmed {
	case "true", "1", "yes":
		return true, true
	case "false", "0", "no":
		return false, true
	default:
		validation.Add("%s row %d: %s must be true or false", sheet, row, column)
		return false, false
	}
}

func normalizeOptionalID(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	if _, err := uuid.Parse(trimmed); err != nil {
		return trimmed
	}
	return trimmed
}

func padRow(row []string, width int) []string {
	if len(row) >= width {
		return row[:width]
	}

	padded := make([]string, width)
	copy(padded, row)
	return padded
}

func isBlankRow(row []string) bool {
	return slices.IndexFunc(row, func(value string) bool {
		return strings.TrimSpace(value) != ""
	}) == -1
}

func firstOrEmpty(values []string) string {
	if len(values) == 0 {
		return ""
	}
	return values[0]
}

func nullableText(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func IsValidationError(err error) bool {
	var validation *ValidationErrors
	return errors.As(err, &validation)
}
