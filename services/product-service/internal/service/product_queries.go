package service

import (
	"context"
	"errors"

	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/repository"
)

type normalizedListProductsQuery struct {
	limit    int
	cursor   string
	category string
	brand    string
	tag      string
	status   string
	search   string
	minPrice float64
	maxPrice float64
	size     string
	color    string
	sort     string
}

// List returns catalog products using the search backend when appropriate and
// PostgreSQL cursor pagination otherwise.
//
// Inputs:
//   - ctx carries cancellation to repository and search calls.
//   - query contains the raw list query parameters from the API boundary.
//
// Returns:
//   - the matching products.
//   - page information for cursor-based pagination.
//   - ErrInvalidCursor when the supplied cursor is malformed or incompatible with the sort.
//
// Edge cases:
//   - the search backend is only used for first-page searchable sorts; paginated cursors stay on PostgreSQL for consistency.
//
// Side effects:
//   - none beyond repository and optional search reads.
//
// Performance:
//   - query normalization happens once up front to avoid repeated trimming and sort normalization across the search and database paths.
func (s *ProductService) List(ctx context.Context, query dto.ListProductsQuery) ([]*model.Product, *ProductListPageInfo, error) {
	normalized := normalizeListProductsQuery(query)

	if s.search != nil && shouldUseSearchBackend(normalized) {
		ids, total, err := s.search.Search(ctx, normalized.toDTO())
		if err != nil {
			s.log.Warn("search backend failed, falling back to PostgreSQL", zap.String("search", normalized.search), zap.Error(err))
		} else {
			normalizedIDs := normalizeProductIDs(ids)
			if len(normalizedIDs) == 0 {
				return []*model.Product{}, &ProductListPageInfo{}, nil
			}

			products, listErr := s.repo.ListByIDs(ctx, normalizedIDs)
			if listErr != nil {
				return nil, nil, listErr
			}

			hasNext := int64(normalized.limit) < total
			return products, &ProductListPageInfo{HasNext: hasNext}, nil
		}
	}

	products, nextCursor, hasNext, err := s.repo.List(ctx, normalized.toRepositoryParams())
	if err != nil {
		if errors.Is(err, repository.ErrInvalidCursor) {
			return nil, nil, ErrInvalidCursor
		}
		return nil, nil, err
	}

	return products, &ProductListPageInfo{NextCursor: nextCursor, HasNext: hasNext}, nil
}

// SyncSearchIndex rebuilds the configured search index from the PostgreSQL
// source of truth.
//
// Inputs:
//   - ctx carries cancellation to repository and search calls.
//
// Returns:
//   - nil on success.
//   - any repository or search-index error.
//
// Edge cases:
//   - nil search backends make this a no-op so local environments can run without search.
//
// Side effects:
//   - may perform a full search reindex.
//
// Performance:
//   - dominated by loading the full searchable product set and one bulk reindex call.
func (s *ProductService) SyncSearchIndex(ctx context.Context) error {
	if s.search == nil {
		return nil
	}

	products, err := s.repo.ListForSearchIndex(ctx)
	if err != nil {
		return err
	}

	return s.search.Reindex(ctx, products)
}

// CheckStock verifies whether a product currently has at least the requested quantity.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//   - productID identifies the product.
//   - quantity is the required amount.
//
// Returns:
//   - true when the product has sufficient stock.
//   - ErrProductNotFound when the product does not exist.
//   - any repository error.
//
// Edge cases:
//   - negative quantities are treated according to the simple comparison rule and may return true if the product exists.
//
// Side effects:
//   - none.
//
// Performance:
//   - one repository lookup.
func (s *ProductService) CheckStock(ctx context.Context, productID string, quantity int) (bool, error) {
	product, err := s.GetByID(ctx, productID)
	if err != nil {
		return false, err
	}
	return product.Stock >= quantity, nil
}

// ListLowStock returns active products at or below the supplied stock threshold.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//   - threshold is the low-stock cutoff.
//
// Returns:
//   - the matching low-stock products.
//   - any repository error.
//
// Edge cases:
//   - negative thresholds are normalized to zero.
//
// Side effects:
//   - none.
//
// Performance:
//   - one repository query.
func (s *ProductService) ListLowStock(ctx context.Context, threshold int) ([]*model.Product, error) {
	if threshold < 0 {
		threshold = 0
	}

	return s.repo.ListLowStock(ctx, threshold)
}

// RestoreStock atomically increments product stock, typically after order cancellation.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//   - productID identifies the product to restore.
//   - quantity is the number of units to add back.
//
// Returns:
//   - nil on success.
//   - an error when the quantity is invalid or the repository update fails.
//
// Edge cases:
//   - non-positive quantities are rejected immediately to avoid accidental no-op or decrement semantics.
//
// Side effects:
//   - writes stock changes to PostgreSQL.
//
// Performance:
//   - O(1) application work plus one repository update.
func (s *ProductService) RestoreStock(ctx context.Context, productID string, quantity int) error {
	if quantity <= 0 {
		return errors.New("quantity must be positive")
	}
	return s.repo.RestoreStock(ctx, productID, quantity)
}

// normalizeListProductsQuery trims and canonicalizes raw query parameters once
// so downstream logic can reuse the normalized values.
//
// Inputs:
//   - query is the raw list query.
//
// Returns:
//   - the normalized query structure.
//
// Edge cases:
//   - out-of-range limits fall back to 20.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) across the combined length of string query fields.
func normalizeListProductsQuery(query dto.ListProductsQuery) normalizedListProductsQuery {
	limit := query.Limit
	if limit < 1 || limit > 100 {
		limit = 20
	}

	return normalizedListProductsQuery{
		limit:    limit,
		cursor:   trimText(query.Cursor),
		category: trimText(query.Category),
		brand:    trimText(query.Brand),
		tag:      trimText(query.Tag),
		status:   trimText(query.Status),
		search:   trimText(query.Search),
		minPrice: query.MinPrice,
		maxPrice: query.MaxPrice,
		size:     trimText(query.Size),
		color:    trimText(query.Color),
		sort:     normalizeSort(query.Sort),
	}
}

// toDTO converts the normalized query back into the DTO expected by the optional
// search backend.
//
// Inputs:
//   - q is the normalized query structure.
//
// Returns:
//   - the DTO with canonicalized values.
//
// Edge cases:
//   - page remains zero because cursor pagination is used in this service path.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func (q normalizedListProductsQuery) toDTO() dto.ListProductsQuery {
	return dto.ListProductsQuery{
		Limit:    q.limit,
		Cursor:   q.cursor,
		Category: q.category,
		Brand:    q.brand,
		Tag:      q.tag,
		Status:   q.status,
		Search:   q.search,
		MinPrice: q.minPrice,
		MaxPrice: q.maxPrice,
		Size:     q.size,
		Color:    q.color,
		Sort:     q.sort,
	}
}

// toRepositoryParams converts the normalized query into repository parameters.
//
// Inputs:
//   - q is the normalized query structure.
//
// Returns:
//   - the repository parameter object.
//
// Edge cases:
//   - none.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func (q normalizedListProductsQuery) toRepositoryParams() repository.ListProductsParams {
	return repository.ListProductsParams{
		Limit:    q.limit,
		Cursor:   q.cursor,
		Category: q.category,
		Brand:    q.brand,
		Tag:      q.tag,
		Status:   q.status,
		Search:   q.search,
		MinPrice: q.minPrice,
		MaxPrice: q.maxPrice,
		Size:     q.size,
		Color:    q.color,
		Sort:     q.sort,
	}
}

// shouldUseSearchBackend reports whether the normalized query is eligible for
// the optional search backend path.
//
// Inputs:
//   - query is the normalized list query.
//
// Returns:
//   - true when the search backend should handle the request.
//
// Edge cases:
//   - cursor-based pages stay on PostgreSQL to preserve cursor semantics.
//   - the `popular` sort intentionally stays on PostgreSQL.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func shouldUseSearchBackend(query normalizedListProductsQuery) bool {
	return query.search != "" && query.sort != "popular" && query.cursor == ""
}

// indexProductBestEffort updates the optional search backend without failing the
// primary PostgreSQL write flow.
//
// Inputs:
//   - ctx carries cancellation to the search index.
//   - product is the product to index.
//   - message is the warning log message to emit on failure.
//
// Returns:
//   - none.
//
// Edge cases:
//   - nil search backends make this a no-op.
//
// Side effects:
//   - may call the external search backend.
//   - emits a warning log on failure.
//
// Performance:
//   - O(1) application work plus one optional network or storage call.
func (s *ProductService) indexProductBestEffort(ctx context.Context, product *model.Product, message string) {
	if s.search == nil {
		return
	}
	if err := s.search.Index(ctx, product); err != nil {
		s.log.Warn(message, zap.String("product_id", product.ID), zap.Error(err))
	}
}

// deleteProductIndexBestEffort removes a product from the optional search backend
// without failing the primary PostgreSQL delete flow.
//
// Inputs:
//   - ctx carries cancellation to the search index.
//   - productID identifies the product to delete.
//
// Returns:
//   - none.
//
// Edge cases:
//   - nil search backends make this a no-op.
//
// Side effects:
//   - may call the external search backend.
//   - emits a warning log on failure.
//
// Performance:
//   - O(1) application work plus one optional network or storage call.
func (s *ProductService) deleteProductIndexBestEffort(ctx context.Context, productID string) {
	if s.search == nil {
		return
	}
	if err := s.search.Delete(ctx, productID); err != nil {
		s.log.Warn("failed to delete product from search backend", zap.String("product_id", productID), zap.Error(err))
	}
}
