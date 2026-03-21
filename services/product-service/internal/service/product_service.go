package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/repository"
)

var (
	ErrProductNotFound = errors.New("product not found")
	ErrInvalidStatus   = errors.New("invalid product status")
)

// ProductService contains business logic for product operations.
type ProductService struct {
	repo repository.ProductRepository
}

func NewProductService(repo repository.ProductRepository) *ProductService {
	return &ProductService{repo: repo}
}

func (s *ProductService) Create(ctx context.Context, req dto.CreateProductRequest) (*model.Product, error) {
	status, err := normalizeStatus(req.Status)
	if err != nil {
		return nil, err
	}

	variants := normalizeVariants(req.Variants)
	now := time.Now()
	product := &model.Product{
		ID:          uuid.New().String(),
		Name:        strings.TrimSpace(req.Name),
		Description: strings.TrimSpace(req.Description),
		Price:       req.Price,
		Stock:       resolveStock(req.Stock, variants),
		Category:    strings.TrimSpace(req.Category),
		Brand:       strings.TrimSpace(req.Brand),
		Tags:        normalizeTags(req.Tags),
		Status:      status,
		SKU:         strings.TrimSpace(req.SKU),
		Variants:    variants,
		ImageURL:    strings.TrimSpace(req.ImageURL),
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.repo.Create(ctx, product); err != nil {
		return nil, err
	}
	return product, nil
}

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

func (s *ProductService) Update(ctx context.Context, id string, req dto.UpdateProductRequest) (*model.Product, error) {
	product, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if product == nil {
		return nil, ErrProductNotFound
	}

	if req.Name != nil {
		product.Name = strings.TrimSpace(*req.Name)
	}
	if req.Description != nil {
		product.Description = strings.TrimSpace(*req.Description)
	}
	if req.Price != nil {
		product.Price = *req.Price
	}
	if req.Stock != nil {
		product.Stock = *req.Stock
	}
	if req.Category != nil {
		product.Category = strings.TrimSpace(*req.Category)
	}
	if req.Brand != nil {
		product.Brand = strings.TrimSpace(*req.Brand)
	}
	if req.Tags != nil {
		product.Tags = normalizeTags(*req.Tags)
	}
	if req.Status != nil {
		status, err := normalizeStatus(*req.Status)
		if err != nil {
			return nil, err
		}
		product.Status = status
	}
	if req.SKU != nil {
		product.SKU = strings.TrimSpace(*req.SKU)
	}
	if req.Variants != nil {
		product.Variants = normalizeVariants(*req.Variants)
		product.Stock = resolveStock(product.Stock, product.Variants)
	}
	if req.ImageURL != nil {
		product.ImageURL = strings.TrimSpace(*req.ImageURL)
	}
	product.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, product); err != nil {
		return nil, err
	}
	return product, nil
}

func (s *ProductService) Delete(ctx context.Context, id string) error {
	product, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if product == nil {
		return ErrProductNotFound
	}
	return s.repo.Delete(ctx, id)
}

// List returns paginated products with optional catalog metadata filters.
func (s *ProductService) List(ctx context.Context, query dto.ListProductsQuery) ([]*model.Product, int64, error) {
	if query.Page < 1 {
		query.Page = 1
	}
	if query.Limit < 1 || query.Limit > 100 {
		query.Limit = 20
	}
	offset := (query.Page - 1) * query.Limit

	return s.repo.List(
		ctx,
		offset,
		query.Limit,
		strings.TrimSpace(query.Category),
		strings.TrimSpace(query.Brand),
		strings.TrimSpace(query.Tag),
		strings.TrimSpace(query.Status),
		strings.TrimSpace(query.Search),
	)
}

// CheckStock verifies if a product has sufficient stock.
func (s *ProductService) CheckStock(ctx context.Context, productID string, quantity int) (bool, error) {
	product, err := s.repo.GetByID(ctx, productID)
	if err != nil {
		return false, err
	}
	if product == nil {
		return false, ErrProductNotFound
	}
	return product.Stock >= quantity, nil
}

func (s *ProductService) ListLowStock(ctx context.Context, threshold int) ([]*model.Product, error) {
	if threshold < 0 {
		threshold = 0
	}

	return s.repo.ListLowStock(ctx, threshold)
}

// RestoreStock atomically increments stock for a product (used on order cancellation).
func (s *ProductService) RestoreStock(ctx context.Context, productID string, quantity int) error {
	if quantity <= 0 {
		return errors.New("quantity must be positive")
	}
	return s.repo.RestoreStock(ctx, productID, quantity)
}

func normalizeTags(tags []string) []string {
	if len(tags) == 0 {
		return []string{}
	}

	seen := make(map[string]struct{}, len(tags))
	normalized := make([]string, 0, len(tags))
	for _, tag := range tags {
		clean := strings.ToLower(strings.TrimSpace(tag))
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

func normalizeVariants(variants []dto.ProductVariantRequest) []model.ProductVariant {
	if len(variants) == 0 {
		return []model.ProductVariant{}
	}

	normalized := make([]model.ProductVariant, 0, len(variants))
	for _, variant := range variants {
		normalized = append(normalized, model.ProductVariant{
			SKU:   strings.TrimSpace(variant.SKU),
			Label: strings.TrimSpace(variant.Label),
			Price: variant.Price,
			Stock: variant.Stock,
		})
	}
	return normalized
}

func resolveStock(baseStock int, variants []model.ProductVariant) int {
	if len(variants) == 0 {
		return baseStock
	}

	total := 0
	for _, variant := range variants {
		total += variant.Stock
	}
	return total
}

func normalizeStatus(value string) (string, error) {
	status := strings.ToLower(strings.TrimSpace(value))
	if status == "" {
		return string(model.ProductStatusActive), nil
	}

	switch status {
	case string(model.ProductStatusDraft), string(model.ProductStatusActive), string(model.ProductStatusInactive):
		return status, nil
	default:
		return "", ErrInvalidStatus
	}
}
