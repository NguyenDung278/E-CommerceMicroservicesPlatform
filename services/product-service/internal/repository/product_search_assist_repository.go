package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/lib/pq"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

func (r *postgresProductRepository) SearchAssist(ctx context.Context, params SearchAssistParams) (*model.ProductSearchAssist, error) {
	limit := params.Limit
	if limit < 1 || limit > 12 {
		limit = 8
	}

	total, err := r.countSearchAssistResults(ctx, params)
	if err != nil {
		return nil, err
	}

	suggestions, err := r.listSearchSuggestions(ctx, params, limit)
	if err != nil {
		return nil, err
	}

	facets, err := r.listSearchFacets(ctx, params)
	if err != nil {
		return nil, err
	}

	return &model.ProductSearchAssist{
		Query:           strings.TrimSpace(params.Query),
		ResolvedQuery:   strings.TrimSpace(params.ResolvedQuery),
		AppliedSynonyms: append([]string(nil), params.AppliedSynonyms...),
		ResultCount:     total,
		Suggestions:     suggestions,
		Facets:          facets,
		SortOptions: []model.ProductSearchSortOption{
			{Value: "latest", Label: "Newest first"},
			{Value: "merchandising", Label: "Merchandising edit"},
			{Value: "popular", Label: "Most wanted"},
			{Value: "price_asc", Label: "Price: Low to high"},
			{Value: "price_desc", Label: "Price: High to low"},
		},
	}, nil
}

func (r *postgresProductRepository) countSearchAssistResults(ctx context.Context, params SearchAssistParams) (int, error) {
	whereClause, args := buildSearchAssistWhereClause("p", params)

	query := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM products p
		%s
	`, whereClause)

	var total int
	if err := r.db.QueryRowContext(ctx, query, args...).Scan(&total); err != nil {
		return 0, fmt.Errorf("failed to count search assist results: %w", err)
	}

	return total, nil
}

func (r *postgresProductRepository) listSearchSuggestions(ctx context.Context, params SearchAssistParams, limit int) ([]model.ProductSearchSuggestion, error) {
	patterns := buildSearchAssistPatterns(params.SearchTerms)
	if len(patterns) == 0 {
		return []model.ProductSearchSuggestion{}, nil
	}

	productSuggestions, err := r.querySearchSuggestions(ctx, params, limit, "name", "product")
	if err != nil {
		return nil, err
	}

	brandSuggestions, err := r.querySearchSuggestions(ctx, params, max(2, limit/3), "brand", "brand")
	if err != nil {
		return nil, err
	}

	categorySuggestions, err := r.querySearchSuggestions(ctx, params, max(2, limit/3), "category", "category")
	if err != nil {
		return nil, err
	}

	combined := make([]model.ProductSearchSuggestion, 0, len(productSuggestions)+len(brandSuggestions)+len(categorySuggestions))
	seen := make(map[string]struct{})
	for _, suggestion := range append(append(productSuggestions, brandSuggestions...), categorySuggestions...) {
		key := suggestion.Kind + "::" + strings.ToLower(strings.TrimSpace(suggestion.Value))
		if _, exists := seen[key]; exists {
			continue
		}

		seen[key] = struct{}{}
		combined = append(combined, suggestion)
		if len(combined) == limit {
			break
		}
	}

	return combined, nil
}

func (r *postgresProductRepository) querySearchSuggestions(
	ctx context.Context,
	params SearchAssistParams,
	limit int,
	column string,
	kind string,
) ([]model.ProductSearchSuggestion, error) {
	whereClause, args := buildSearchAssistWhereClause("p", params)
	args = append(args, limit)

	query := fmt.Sprintf(`
		SELECT p.%s AS value, COUNT(*) AS match_count
		FROM products p
		%s
		AND NULLIF(TRIM(p.%s), '') IS NOT NULL
		GROUP BY p.%s
		ORDER BY MIN(p.merchandising_rank) ASC, COUNT(*) DESC, p.%s ASC
		LIMIT $%d
	`, column, whereClause, column, column, column, len(args))

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query %s search suggestions: %w", kind, err)
	}
	defer rows.Close()

	suggestions := make([]model.ProductSearchSuggestion, 0)
	for rows.Next() {
		var suggestion model.ProductSearchSuggestion
		suggestion.Kind = kind
		if err := rows.Scan(&suggestion.Value, &suggestion.MatchCount); err != nil {
			return nil, fmt.Errorf("failed to scan %s suggestion: %w", kind, err)
		}
		suggestions = append(suggestions, suggestion)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate %s suggestions: %w", kind, err)
	}

	return suggestions, nil
}

func (r *postgresProductRepository) listSearchFacets(ctx context.Context, params SearchAssistParams) ([]model.ProductSearchFacet, error) {
	categoryValues, err := r.querySimpleFacet(ctx, params, "category", "p.category")
	if err != nil {
		return nil, err
	}
	brandValues, err := r.querySimpleFacet(ctx, params, "brand", "p.brand")
	if err != nil {
		return nil, err
	}
	sizeValues, err := r.queryVariantFacet(ctx, params, "size")
	if err != nil {
		return nil, err
	}
	colorValues, err := r.queryVariantFacet(ctx, params, "color")
	if err != nil {
		return nil, err
	}

	return []model.ProductSearchFacet{
		{Key: "category", Label: "Category", Values: categoryValues},
		{Key: "brand", Label: "Brand", Values: brandValues},
		{Key: "size", Label: "Size", Values: sizeValues},
		{Key: "color", Label: "Color", Values: colorValues},
	}, nil
}

func (r *postgresProductRepository) querySimpleFacet(
	ctx context.Context,
	params SearchAssistParams,
	kind string,
	column string,
) ([]model.ProductSearchFacetValue, error) {
	whereClause, args := buildSearchAssistWhereClause("p", params)
	args = append(args, 8)

	query := fmt.Sprintf(`
		SELECT TRIM(%s) AS value, COUNT(*) AS count
		FROM products p
		%s
		AND NULLIF(TRIM(%s), '') IS NOT NULL
		GROUP BY TRIM(%s)
		ORDER BY COUNT(*) DESC, TRIM(%s) ASC
		LIMIT $%d
	`, column, whereClause, column, column, column, len(args))

	return scanFacetValues(r.db.QueryContext(ctx, query, args...), kind)
}

func (r *postgresProductRepository) queryVariantFacet(
	ctx context.Context,
	params SearchAssistParams,
	key string,
) ([]model.ProductSearchFacetValue, error) {
	whereClause, args := buildSearchAssistWhereClause("p", params)
	args = append(args, key, 8)

	query := fmt.Sprintf(`
		SELECT value, COUNT(*) AS count
		FROM (
			SELECT DISTINCT p.id, TRIM(variant->>$%d) AS value
			FROM products p
			JOIN LATERAL jsonb_array_elements(p.variants) AS variant ON true
			%s
		) facet_values
		WHERE NULLIF(value, '') IS NOT NULL
		GROUP BY value
		ORDER BY COUNT(*) DESC, value ASC
		LIMIT $%d
	`, len(args)-1, whereClause, len(args))

	return scanFacetValues(r.db.QueryContext(ctx, query, args...), key)
}

func scanFacetValues(rows *sql.Rows, err error, kind string) ([]model.ProductSearchFacetValue, error) {
	if err != nil {
		return nil, fmt.Errorf("failed to query %s facet counts: %w", kind, err)
	}
	defer rows.Close()

	values := make([]model.ProductSearchFacetValue, 0)
	for rows.Next() {
		var value model.ProductSearchFacetValue
		if err := rows.Scan(&value.Value, &value.Count); err != nil {
			return nil, fmt.Errorf("failed to scan %s facet count: %w", kind, err)
		}
		values = append(values, value)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate %s facet counts: %w", kind, err)
	}

	return values, nil
}

func buildSearchAssistWhereClause(alias string, params SearchAssistParams) (string, []interface{}) {
	clauses := []string{"1=1"}
	args := make([]interface{}, 0, 4)
	argIdx := 1

	status := strings.TrimSpace(params.Status)
	if status != "" {
		clauses = append(clauses, fmt.Sprintf("%s.status = $%d", alias, argIdx))
		args = append(args, status)
		argIdx++
	}

	category := strings.TrimSpace(params.Category)
	if category != "" {
		clauses = append(clauses, fmt.Sprintf("lower(%s.category) = lower($%d)", alias, argIdx))
		args = append(args, category)
		argIdx++
	}

	patterns := buildSearchAssistPatterns(params.SearchTerms)
	if len(patterns) > 0 {
		placeholder := fmt.Sprintf("$%d", argIdx)
		clauses = append(clauses, fmt.Sprintf(`(
			lower(%s.name) LIKE ANY(%s)
			OR lower(%s.brand) LIKE ANY(%s)
			OR lower(%s.category) LIKE ANY(%s)
			OR lower(%s.description) LIKE ANY(%s)
			OR lower(%s.sku) LIKE ANY(%s)
			OR EXISTS (
				SELECT 1
				FROM jsonb_array_elements_text(%s.tags) AS tag
				WHERE lower(tag) LIKE ANY(%s)
			)
			OR EXISTS (
				SELECT 1
				FROM jsonb_array_elements(%s.variants) AS variant
				WHERE lower(COALESCE(variant->>'label', '')) LIKE ANY(%s)
					OR lower(COALESCE(variant->>'size', '')) LIKE ANY(%s)
					OR lower(COALESCE(variant->>'color', '')) LIKE ANY(%s)
					OR lower(COALESCE(variant->>'badge', '')) LIKE ANY(%s)
			)
		)`,
			alias, placeholder,
			alias, placeholder,
			alias, placeholder,
			alias, placeholder,
			alias, placeholder,
			alias, placeholder,
			alias, placeholder, placeholder, placeholder, placeholder,
		))
		args = append(args, pq.Array(patterns))
	}

	return "WHERE " + strings.Join(clauses, " AND "), args
}

func buildSearchAssistPatterns(terms []string) []string {
	if len(terms) == 0 {
		return nil
	}

	patterns := make([]string, 0, len(terms))
	seen := make(map[string]struct{}, len(terms))
	for _, term := range terms {
		clean := strings.ToLower(strings.TrimSpace(term))
		if clean == "" {
			continue
		}
		if _, exists := seen[clean]; exists {
			continue
		}

		seen[clean] = struct{}{}
		patterns = append(patterns, "%"+clean+"%")
	}

	return patterns
}

func max(left, right int) int {
	if left > right {
		return left
	}

	return right
}
