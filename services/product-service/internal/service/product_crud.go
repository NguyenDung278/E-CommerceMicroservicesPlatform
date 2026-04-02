package service

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

// Create validates, normalizes, and persists a new product.
//
// Inputs:
//   - ctx carries cancellation to repository and search-index calls.
//   - req contains the raw create payload from the API boundary.
//
// Returns:
//   - the persisted product aggregate.
//   - a validation or persistence error.
//
// Edge cases:
//   - when variants are present, stock is derived from the sum of variant stock values.
//
// Side effects:
//   - writes a product row to PostgreSQL.
//   - best-effort indexes the product in the search backend when configured.
//
// Performance:
//   - O(n) over tags and variants, plus one repository insert and optional index call.
func (s *ProductService) Create(ctx context.Context, req dto.CreateProductRequest) (*model.Product, error) {
	product, err := newProductFromCreateRequest(req)
	if err != nil {
		return nil, err
	}

	if err := s.repo.Create(ctx, product); err != nil {
		return nil, err
	}

	s.indexProductBestEffort(ctx, product, "failed to index product in search backend")
	return product, nil
}

// GetByID returns one product by its id.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//   - id identifies the product to load.
//
// Returns:
//   - the matching product.
//   - ErrProductNotFound when no product exists for the id.
//
// Edge cases:
//   - none beyond standard not-found handling.
//
// Side effects:
//   - none.
//
// Performance:
//   - one repository lookup.
func (s *ProductService) GetByID(ctx context.Context, id string) (*model.Product, error) {
	product, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if product == nil {
		return nil, ErrProductNotFound
	}
	return product, nil
}

// ListByIDs returns the unique products matching the supplied ids.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//   - ids contains the requested product ids.
//
// Returns:
//   - the matching products in the normalized id order.
//   - ErrTooManyProductIDs when the request exceeds the batch lookup limit.
//
// Edge cases:
//   - blank and duplicate ids are removed before hitting the repository.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) normalization plus one repository batch lookup.
func (s *ProductService) ListByIDs(ctx context.Context, ids []string) ([]*model.Product, error) {
	normalizedIDs := normalizeProductIDs(ids)
	if len(normalizedIDs) == 0 {
		return []*model.Product{}, nil
	}
	if len(normalizedIDs) > maxProductBatchLookup {
		return nil, ErrTooManyProductIDs
	}

	return s.repo.ListByIDs(ctx, normalizedIDs)
}

// Update loads, mutates, and persists a product update patch.
//
// Inputs:
//   - ctx carries cancellation to repository and search-index calls.
//   - id identifies the product to update.
//   - req contains the partial update payload.
//
// Returns:
//   - the updated product aggregate.
//   - ErrProductNotFound when the product does not exist.
//   - a validation or persistence error.
//
// Edge cases:
//   - when variants are updated, stock is recalculated from the variant list.
//   - image_url and image_urls are normalized together so the primary image stays consistent.
//
// Side effects:
//   - writes the updated product row to PostgreSQL.
//   - best-effort updates the product in the search backend when configured.
//
// Performance:
//   - O(n) over tags, variants, and image URLs plus one read and one update.
func (s *ProductService) Update(ctx context.Context, id string, req dto.UpdateProductRequest) (*model.Product, error) {
	product, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if err := applyProductUpdate(product, req); err != nil {
		return nil, err
	}
	product.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, product); err != nil {
		return nil, err
	}

	s.indexProductBestEffort(ctx, product, "failed to update product in search backend")
	return product, nil
}

// Delete removes a product and best-effort removes it from the search index.
//
// Inputs:
//   - ctx carries cancellation to repository and search-index calls.
//   - id identifies the product to delete.
//
// Returns:
//   - nil on success.
//   - ErrProductNotFound when the product does not exist.
//   - any repository error.
//
// Edge cases:
//   - search-index deletion is intentionally best-effort because PostgreSQL remains the source of truth.
//
// Side effects:
//   - deletes a product row from PostgreSQL.
//   - best-effort deletes the product from the search index.
//
// Performance:
//   - one read, one delete, and an optional index delete call.
func (s *ProductService) Delete(ctx context.Context, id string) error {
	product, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}

	s.deleteProductIndexBestEffort(ctx, product.ID)
	return nil
}

// newProductFromCreateRequest normalizes a create payload into a persisted
// product aggregate.
//
// Inputs:
//   - req contains the raw create payload.
//
// Returns:
//   - the normalized product aggregate.
//   - ErrInvalidStatus when the requested status is unsupported.
//
// Edge cases:
//   - blank status defaults to active.
//
// Side effects:
//   - allocates the new product aggregate plus normalized slices.
//
// Performance:
//   - O(n) over tags, variants, and image URLs.
func newProductFromCreateRequest(req dto.CreateProductRequest) (*model.Product, error) {
	status, err := normalizeStatus(req.Status)
	if err != nil {
		return nil, err
	}

	variants := normalizeVariants(req.Variants)
	imageURLs := normalizeImageURLs(req.ImageURLs, req.ImageURL)
	now := time.Now()

	return &model.Product{
		ID:          uuid.New().String(),
		Name:        trimText(req.Name),
		Description: trimText(req.Description),
		Price:       req.Price,
		Stock:       resolveStock(req.Stock, variants),
		Category:    trimText(req.Category),
		Brand:       trimText(req.Brand),
		Tags:        normalizeTags(req.Tags),
		Status:      status,
		SKU:         trimText(req.SKU),
		Variants:    variants,
		ImageURL:    resolvePrimaryImage(imageURLs),
		ImageURLs:   imageURLs,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

// applyProductUpdate mutates a loaded product using a partial update request.
//
// Inputs:
//   - product is the loaded product aggregate to mutate.
//   - req contains the partial update payload.
//
// Returns:
//   - ErrInvalidStatus when the requested status is unsupported.
//
// Edge cases:
//   - image_url and image_urls are normalized together so the primary image stays in sync.
//
// Side effects:
//   - mutates the supplied product aggregate in place.
//
// Performance:
//   - O(n) over the supplied tags, variants, and image URLs.
func applyProductUpdate(product *model.Product, req dto.UpdateProductRequest) error {
	if req.Name != nil {
		product.Name = trimText(*req.Name)
	}
	if req.Description != nil {
		product.Description = trimText(*req.Description)
	}
	if req.Price != nil {
		product.Price = *req.Price
	}
	if req.Stock != nil {
		product.Stock = *req.Stock
	}
	if req.Category != nil {
		product.Category = trimText(*req.Category)
	}
	if req.Brand != nil {
		product.Brand = trimText(*req.Brand)
	}
	if req.Tags != nil {
		product.Tags = normalizeTags(*req.Tags)
	}
	if req.Status != nil {
		status, err := normalizeStatus(*req.Status)
		if err != nil {
			return err
		}
		product.Status = status
	}
	if req.SKU != nil {
		product.SKU = trimText(*req.SKU)
	}
	if req.Variants != nil {
		product.Variants = normalizeVariants(*req.Variants)
		product.Stock = resolveStock(product.Stock, product.Variants)
	}

	applyProductImagePatch(product, req)
	return nil
}

// applyProductImagePatch updates a product's image_url and image_urls fields
// while keeping them consistent.
//
// Inputs:
//   - product is the loaded product aggregate to mutate.
//   - req contains the partial image patch fields.
//
// Returns:
//   - none.
//
// Edge cases:
//   - image_url-only updates still rebuild image_urls so the first image remains the primary one.
//
// Side effects:
//   - mutates the supplied product aggregate in place.
//
// Performance:
//   - O(n) over the resulting image URL count.
func applyProductImagePatch(product *model.Product, req dto.UpdateProductRequest) {
	if req.ImageURL != nil {
		product.ImageURL = trimText(*req.ImageURL)
	}
	if req.ImageURLs != nil {
		product.ImageURLs = normalizeImageURLs(*req.ImageURLs, product.ImageURL)
		product.ImageURL = resolvePrimaryImage(product.ImageURLs)
		return
	}
	if req.ImageURL != nil {
		product.ImageURLs = normalizeImageURLs(product.ImageURLs, product.ImageURL)
		product.ImageURL = resolvePrimaryImage(product.ImageURLs)
	}
}
