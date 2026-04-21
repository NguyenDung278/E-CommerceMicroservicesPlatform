package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

type SearchAnalyticsRecord struct {
	Source      string
	Query       string
	Normalized  string
	Category    string
	ResultCount int
	OccurredAt  time.Time
}

type SearchAnalyticsEventRecord struct {
	Source      string
	EventKind   string
	Query       string
	Normalized  string
	Category    string
	FilterKey   string
	FilterValue string
	OccurredAt  time.Time
}

type SearchAnalyticsSummaryParams struct {
	Days  int
	Limit int
}

type SearchAnalyticsRepository interface {
	RecordQuery(ctx context.Context, record SearchAnalyticsRecord) error
	RecordEvent(ctx context.Context, record SearchAnalyticsEventRecord) error
	GetSummary(ctx context.Context, params SearchAnalyticsSummaryParams) (*model.ProductSearchAnalyticsSummary, error)
}

type postgresSearchAnalyticsRepository struct {
	db *sql.DB
}

func NewSearchAnalyticsRepository(db *sql.DB) SearchAnalyticsRepository {
	return &postgresSearchAnalyticsRepository{db: db}
}

func (r *postgresSearchAnalyticsRepository) RecordQuery(ctx context.Context, record SearchAnalyticsRecord) error {
	normalized := strings.TrimSpace(record.Normalized)
	if normalized == "" {
		return nil
	}

	occurredAt := record.OccurredAt
	if occurredAt.IsZero() {
		occurredAt = time.Now()
	}

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO product_search_query_metrics (
			day_bucket, source, query_normalized, query_display, category,
			request_count, zero_result_count, total_result_count, last_seen_at
		)
		VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8)
		ON CONFLICT (day_bucket, source, query_normalized, category)
		DO UPDATE SET
			query_display = EXCLUDED.query_display,
			request_count = product_search_query_metrics.request_count + 1,
			zero_result_count = product_search_query_metrics.zero_result_count + EXCLUDED.zero_result_count,
			total_result_count = product_search_query_metrics.total_result_count + EXCLUDED.total_result_count,
			last_seen_at = EXCLUDED.last_seen_at
	`,
		occurredAt.UTC().Format("2006-01-02"),
		strings.TrimSpace(record.Source),
		normalized,
		strings.TrimSpace(record.Query),
		strings.TrimSpace(record.Category),
		boolToInt(record.ResultCount == 0),
		max(record.ResultCount, 0),
		occurredAt.UTC(),
	)
	if err != nil {
		return fmt.Errorf("failed to record product search analytics: %w", err)
	}

	return nil
}

func (r *postgresSearchAnalyticsRepository) GetSummary(
	ctx context.Context,
	params SearchAnalyticsSummaryParams,
) (*model.ProductSearchAnalyticsSummary, error) {
	if params.Days <= 0 {
		params.Days = 7
	}
	if params.Limit <= 0 {
		params.Limit = 10
	}

	summary := &model.ProductSearchAnalyticsSummary{
		WindowDays:        params.Days,
		TopQueries:        []model.ProductSearchAnalyticsEntry{},
		ZeroResultQueries: []model.ProductSearchAnalyticsEntry{},
		TopClickedQueries: []model.ProductSearchClickAnalyticsEntry{},
		TopFilters:        []model.ProductSearchFilterAnalyticsEntry{},
	}

	topQueries, err := r.listSummaryEntries(ctx, params, "SUM(request_count) DESC, MAX(last_seen_at) DESC")
	if err != nil {
		return nil, err
	}
	summary.TopQueries = topQueries

	zeroResultQueries, err := r.listSummaryEntries(
		ctx,
		params,
		"SUM(zero_result_count) DESC, SUM(request_count) DESC, MAX(last_seen_at) DESC",
		"SUM(zero_result_count) > 0",
	)
	if err != nil {
		return nil, err
	}
	summary.ZeroResultQueries = zeroResultQueries

	topClickedQueries, err := r.listTopClickedQueries(ctx, params)
	if err != nil {
		return nil, err
	}
	summary.TopClickedQueries = topClickedQueries

	topFilters, err := r.listTopFilters(ctx, params)
	if err != nil {
		return nil, err
	}
	summary.TopFilters = topFilters

	return summary, nil
}

func (r *postgresSearchAnalyticsRepository) RecordEvent(ctx context.Context, record SearchAnalyticsEventRecord) error {
	source := strings.TrimSpace(record.Source)
	eventKind := strings.TrimSpace(record.EventKind)
	queryNormalized := strings.TrimSpace(record.Normalized)
	queryDisplay := strings.TrimSpace(record.Query)
	category := strings.TrimSpace(record.Category)
	filterKey := strings.TrimSpace(record.FilterKey)
	filterValue := strings.TrimSpace(record.FilterValue)

	if eventKind == "" || source == "" {
		return nil
	}
	if eventKind == "result_click" && queryNormalized == "" {
		return nil
	}
	if eventKind == "filter_apply" && (filterKey == "" || filterValue == "") {
		return nil
	}

	occurredAt := record.OccurredAt
	if occurredAt.IsZero() {
		occurredAt = time.Now()
	}

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO product_search_event_metrics (
			day_bucket, source, event_kind, query_normalized, query_display, category,
			filter_key, filter_value, event_count, last_seen_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9)
		ON CONFLICT (day_bucket, source, event_kind, query_normalized, category, filter_key, filter_value)
		DO UPDATE SET
			query_display = EXCLUDED.query_display,
			event_count = product_search_event_metrics.event_count + 1,
			last_seen_at = EXCLUDED.last_seen_at
	`,
		occurredAt.UTC().Format("2006-01-02"),
		source,
		eventKind,
		queryNormalized,
		queryDisplay,
		category,
		filterKey,
		filterValue,
		occurredAt.UTC(),
	)
	if err != nil {
		return fmt.Errorf("failed to record product search analytics event: %w", err)
	}

	return nil
}

func (r *postgresSearchAnalyticsRepository) listSummaryEntries(
	ctx context.Context,
	params SearchAnalyticsSummaryParams,
	orderBy string,
	having ...string,
) ([]model.ProductSearchAnalyticsEntry, error) {
	havingClause := ""
	if len(having) > 0 && strings.TrimSpace(having[0]) != "" {
		havingClause = "HAVING " + having[0]
	}

	query := fmt.Sprintf(`
		SELECT
			query_display,
			source,
			category,
			COALESCE(SUM(request_count), 0) AS request_count,
			COALESCE(SUM(zero_result_count), 0) AS zero_result_count,
			COALESCE(SUM(total_result_count), 0) AS total_result_count,
			MAX(last_seen_at) AS last_seen_at
		FROM product_search_query_metrics
		WHERE day_bucket >= CURRENT_DATE - ($1::integer - 1)
		GROUP BY query_display, source, category
		%s
		ORDER BY %s
		LIMIT $2
	`, havingClause, orderBy)

	rows, err := r.db.QueryContext(ctx, query, params.Days, params.Limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query product search analytics summary: %w", err)
	}
	defer rows.Close()

	entries := make([]model.ProductSearchAnalyticsEntry, 0)
	for rows.Next() {
		var entry model.ProductSearchAnalyticsEntry
		var totalResultCount int
		if err := rows.Scan(
			&entry.Query,
			&entry.Source,
			&entry.Category,
			&entry.RequestCount,
			&entry.ZeroResultCount,
			&totalResultCount,
			&entry.LastSeenAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan product search analytics summary row: %w", err)
		}
		if entry.RequestCount > 0 {
			entry.AverageResultCount = float64(totalResultCount) / float64(entry.RequestCount)
		}
		entries = append(entries, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate product search analytics summary rows: %w", err)
	}

	return entries, nil
}

func (r *postgresSearchAnalyticsRepository) listTopClickedQueries(
	ctx context.Context,
	params SearchAnalyticsSummaryParams,
) ([]model.ProductSearchClickAnalyticsEntry, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			query_display,
			source,
			category,
			COALESCE(SUM(event_count), 0) AS click_count,
			MAX(last_seen_at) AS last_seen_at
		FROM product_search_event_metrics
		WHERE day_bucket >= CURRENT_DATE - ($1::integer - 1)
		  AND event_kind = 'result_click'
		  AND query_normalized <> ''
		GROUP BY query_display, source, category
		ORDER BY SUM(event_count) DESC, MAX(last_seen_at) DESC
		LIMIT $2
	`, params.Days, params.Limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query top clicked search queries: %w", err)
	}
	defer rows.Close()

	entries := make([]model.ProductSearchClickAnalyticsEntry, 0)
	for rows.Next() {
		var entry model.ProductSearchClickAnalyticsEntry
		if err := rows.Scan(
			&entry.Query,
			&entry.Source,
			&entry.Category,
			&entry.ClickCount,
			&entry.LastSeenAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan top clicked search query row: %w", err)
		}
		entries = append(entries, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate top clicked search query rows: %w", err)
	}

	return entries, nil
}

func (r *postgresSearchAnalyticsRepository) listTopFilters(
	ctx context.Context,
	params SearchAnalyticsSummaryParams,
) ([]model.ProductSearchFilterAnalyticsEntry, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			source,
			category,
			filter_key,
			filter_value,
			COALESCE(SUM(event_count), 0) AS apply_count,
			MAX(last_seen_at) AS last_seen_at
		FROM product_search_event_metrics
		WHERE day_bucket >= CURRENT_DATE - ($1::integer - 1)
		  AND event_kind = 'filter_apply'
		  AND filter_key <> ''
		  AND filter_value <> ''
		GROUP BY source, category, filter_key, filter_value
		ORDER BY SUM(event_count) DESC, MAX(last_seen_at) DESC
		LIMIT $2
	`, params.Days, params.Limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query top search filters: %w", err)
	}
	defer rows.Close()

	entries := make([]model.ProductSearchFilterAnalyticsEntry, 0)
	for rows.Next() {
		var entry model.ProductSearchFilterAnalyticsEntry
		if err := rows.Scan(
			&entry.Source,
			&entry.Category,
			&entry.FilterKey,
			&entry.FilterValue,
			&entry.ApplyCount,
			&entry.LastSeenAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan top search filter row: %w", err)
		}
		entries = append(entries, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate top search filter rows: %w", err)
	}

	return entries, nil
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}
