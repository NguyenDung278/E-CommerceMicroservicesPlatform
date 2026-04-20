package service

import (
	"context"
	"strings"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/repository"
	"go.uber.org/zap"
)

var productSearchSynonyms = map[string][]string{
	"tee":      {"t-shirt", "tee"},
	"tshirt":   {"t-shirt", "tee"},
	"sneaker":  {"sneaker", "trainer"},
	"sneakers": {"sneaker", "trainer"},
	"trainer":  {"sneaker", "trainer"},
	"hoodie":   {"hoodie", "sweatshirt"},
	"loafer":   {"loafer", "slip-on"},
	"heel":     {"heel", "pump"},
	"coat":     {"coat", "outerwear"},
}

func (s *ProductService) GetSearchAssist(ctx context.Context, query dto.SearchAssistQuery) (*model.ProductSearchAssist, error) {
	limit := query.Limit
	if limit < 1 || limit > 12 {
		limit = 8
	}

	resolvedQuery, searchTerms, appliedSynonyms := expandSearchAssistTerms(query.Query)
	assist, err := s.repo.SearchAssist(ctx, repository.SearchAssistParams{
		Limit:           limit,
		Query:           strings.TrimSpace(query.Query),
		ResolvedQuery:   resolvedQuery,
		Category:        trimText(query.Category),
		Status:          normalizeAssistStatus(query.Status),
		SearchTerms:     searchTerms,
		AppliedSynonyms: appliedSynonyms,
	})
	if err != nil {
		return nil, err
	}

	resultCount := 0
	if assist != nil {
		resultCount = assist.ResultCount
	}
	s.recordSearchAnalyticsBestEffort(ctx, "assist", strings.TrimSpace(query.Query), trimText(query.Category), resultCount)
	return assist, nil
}

func expandSearchAssistTerms(query string) (string, []string, []string) {
	baseTerms := strings.Fields(strings.ToLower(strings.TrimSpace(query)))
	if len(baseTerms) == 0 {
		return "", []string{}, []string{}
	}

	searchTerms := make([]string, 0, len(baseTerms)*2)
	appliedSynonyms := make([]string, 0, len(baseTerms))
	seenTerms := make(map[string]struct{}, len(baseTerms)*2)
	seenSynonyms := make(map[string]struct{}, len(baseTerms))

	for _, term := range baseTerms {
		if _, exists := seenTerms[term]; !exists {
			seenTerms[term] = struct{}{}
			searchTerms = append(searchTerms, term)
		}

		synonyms := productSearchSynonyms[term]
		for _, synonym := range synonyms {
			clean := strings.TrimSpace(strings.ToLower(synonym))
			if clean == "" {
				continue
			}
			if _, exists := seenTerms[clean]; !exists {
				seenTerms[clean] = struct{}{}
				searchTerms = append(searchTerms, clean)
			}
			if clean != term {
				if _, exists := seenSynonyms[clean]; !exists {
					seenSynonyms[clean] = struct{}{}
					appliedSynonyms = append(appliedSynonyms, clean)
				}
			}
		}
	}

	return strings.Join(searchTerms, " "), searchTerms, appliedSynonyms
}

func normalizeAssistStatus(value string) string {
	status := strings.ToLower(strings.TrimSpace(value))
	if status == "" {
		return string(model.ProductStatusActive)
	}

	return status
}

func (s *ProductService) recordSearchAnalyticsBestEffort(
	ctx context.Context,
	source, query, category string,
	resultCount int,
) {
	if s.analyticsRepo == nil {
		return
	}

	trimmedQuery := strings.TrimSpace(query)
	if trimmedQuery == "" {
		return
	}

	if err := s.analyticsRepo.RecordQuery(ctx, repository.SearchAnalyticsRecord{
		Source:      source,
		Query:       trimmedQuery,
		Normalized:  strings.ToLower(trimmedQuery),
		Category:    category,
		ResultCount: resultCount,
		OccurredAt:  time.Now(),
	}); err != nil {
		s.log.Warn("failed to record product search analytics",
			zap.String("source", source),
			zap.String("query", trimmedQuery),
			zap.Error(err),
		)
	}
}
