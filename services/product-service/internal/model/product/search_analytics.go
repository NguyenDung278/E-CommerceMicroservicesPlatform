package model

import "time"

type ProductSearchAnalyticsEntry struct {
	Query              string    `json:"query"`
	Source             string    `json:"source"`
	Category           string    `json:"category,omitempty"`
	RequestCount       int       `json:"request_count"`
	ZeroResultCount    int       `json:"zero_result_count"`
	AverageResultCount float64   `json:"average_result_count"`
	LastSeenAt         time.Time `json:"last_seen_at"`
}

type ProductSearchClickAnalyticsEntry struct {
	Query      string    `json:"query"`
	Source     string    `json:"source"`
	Category   string    `json:"category,omitempty"`
	ClickCount int       `json:"click_count"`
	LastSeenAt time.Time `json:"last_seen_at"`
}

type ProductSearchFilterAnalyticsEntry struct {
	Source      string    `json:"source"`
	Category    string    `json:"category,omitempty"`
	FilterKey   string    `json:"filter_key"`
	FilterValue string    `json:"filter_value"`
	ApplyCount  int       `json:"apply_count"`
	LastSeenAt  time.Time `json:"last_seen_at"`
}

type ProductSearchAnalyticsSummary struct {
	WindowDays        int                                 `json:"window_days"`
	TopQueries        []ProductSearchAnalyticsEntry       `json:"top_queries"`
	ZeroResultQueries []ProductSearchAnalyticsEntry       `json:"zero_result_queries"`
	TopClickedQueries []ProductSearchClickAnalyticsEntry  `json:"top_clicked_queries"`
	TopFilters        []ProductSearchFilterAnalyticsEntry `json:"top_filters"`
}
