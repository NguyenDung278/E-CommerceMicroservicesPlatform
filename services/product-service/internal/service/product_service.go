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
	ErrProductNotFound        = errors.New("product not found")
	ErrInvalidStatus          = errors.New("invalid product status")
	ErrImageStorageUnavailable = errors.New("image storage unavailable")
)

// ProductService contains business logic for product operations.
type ProductService struct {
	repo       repository.ProductRepository
	mediaStore MediaStore
}

type ProductServiceOption func(*ProductService)

func WithMediaStore(mediaStore MediaStore) ProductServiceOption {
	return func(service *ProductService) {
		service.mediaStore = mediaStore
	}
}

func NewProductService(repo repository.ProductRepository, options ...ProductServiceOption) *ProductService {
	service := &ProductService{repo: repo}
	for _, option := range options {
		option(service)
	}

	return service
}

// Create is responsible for validating and assembling a new Product domain object.
//
// FLOW HOẠT ĐỘNG:
//  1. Validate trạng thái (normalizeStatus) đảm bảo rơi vào 'active', 'inactive', 'draft'.
//  2. Resolve số lượng Stock tổng (dựa trên tồng số Variants cộng lại hoặc dùng số Stock truyền vào).
//  3. Gọi Database (repo) để insert dòng mới kèm UUID.
func (s *ProductService) Create(ctx context.Context, req dto.CreateProductRequest) (*model.Product, error) {
	status, err := normalizeStatus(req.Status)
	if err != nil {
		return nil, err
	}

	variants := normalizeVariants(req.Variants)
	imageURLs := normalizeImageURLs(req.ImageURLs, req.ImageURL)
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
		ImageURL:    resolvePrimaryImage(imageURLs),
		ImageURLs:   imageURLs,
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
	if req.ImageURLs != nil {
		product.ImageURLs = normalizeImageURLs(*req.ImageURLs, product.ImageURL)
		product.ImageURL = resolvePrimaryImage(product.ImageURLs)
	} else if req.ImageURL != nil {
		product.ImageURLs = normalizeImageURLs(product.ImageURLs, product.ImageURL)
		product.ImageURL = resolvePrimaryImage(product.ImageURLs)
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

func normalizeImageURLs(urls []string, fallback string) []string {
	normalized := make([]string, 0, len(urls)+1)
	seen := map[string]struct{}{}

	for _, imageURL := range append([]string{fallback}, urls...) {
		clean := strings.TrimSpace(imageURL)
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

func resolvePrimaryImage(urls []string) string {
	if len(urls) == 0 {
		return ""
	}

	return urls[0]
}
