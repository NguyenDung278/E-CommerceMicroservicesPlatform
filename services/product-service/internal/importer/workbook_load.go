// Đọc workbook Excel thành struct trung gian: mở sheet, parse từng dòng
// và validate quan hệ giữa các sheet trước khi ghi DB.

package importer

import (
	"fmt"
	"strings"

	"github.com/xuri/excelize/v2"
)

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
