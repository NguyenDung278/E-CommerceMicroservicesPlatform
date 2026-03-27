package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/repository"
)

var (
	ErrProductNotFound         = errors.New("product not found")
	ErrInvalidStatus           = errors.New("invalid product status")
	ErrInvalidCursor           = errors.New("invalid cursor")
	ErrImageStorageUnavailable = errors.New("image storage unavailable")
)

type ProductListPageInfo struct {
	NextCursor string
	HasNext    bool
}

// ProductService contains business logic for product operations.
type ProductService struct {
	repo       repository.ProductRepository
	mediaStore MediaStore
	search     ProductSearchIndex
	log        *zap.Logger
}

type ProductSearchIndex interface {
	Search(ctx context.Context, query dto.ListProductsQuery) ([]string, int64, error)
	Index(ctx context.Context, product *model.Product) error
	Delete(ctx context.Context, productID string) error
	Reindex(ctx context.Context, products []*model.Product) error
}

type ProductServiceOption func(*ProductService)

func WithMediaStore(mediaStore MediaStore) ProductServiceOption {
	return func(service *ProductService) {
		service.mediaStore = mediaStore
	}
}

func WithSearchIndex(search ProductSearchIndex) ProductServiceOption {
	return func(service *ProductService) {
		service.search = search
	}
}

func WithLogger(log *zap.Logger) ProductServiceOption {
	return func(service *ProductService) {
		service.log = log
	}
}

func NewProductService(repo repository.ProductRepository, options ...ProductServiceOption) *ProductService {
	service := &ProductService{
		repo: repo,
		log:  zap.NewNop(),
	}
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
	if s.search != nil {
		if err := s.search.Index(ctx, product); err != nil {
			s.log.Warn("failed to index product in search backend", zap.String("product_id", product.ID), zap.Error(err))
		}
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
	if s.search != nil {
		if err := s.search.Index(ctx, product); err != nil {
			s.log.Warn("failed to update product in search backend", zap.String("product_id", product.ID), zap.Error(err))
		}
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
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	if s.search != nil {
		if err := s.search.Delete(ctx, id); err != nil {
			s.log.Warn("failed to delete product from search backend", zap.String("product_id", id), zap.Error(err))
		}
	}
	return nil
}

// List returns products using cursor pagination for PostgreSQL-backed catalog browsing.
func (s *ProductService) List(ctx context.Context, query dto.ListProductsQuery) ([]*model.Product, *ProductListPageInfo, error) {
	if query.Limit < 1 || query.Limit > 100 {
		query.Limit = 20
	}
	query.Cursor = strings.TrimSpace(query.Cursor)

	if s.search != nil && shouldUseSearchBackend(query) && query.Cursor == "" {
		ids, total, err := s.search.Search(ctx, query)
		if err != nil {
			s.log.Warn("search backend failed, falling back to PostgreSQL", zap.String("search", strings.TrimSpace(query.Search)), zap.Error(err))
		} else {
			if len(ids) == 0 {
				return []*model.Product{}, &ProductListPageInfo{}, nil
			}
			products, listErr := s.repo.ListByIDs(ctx, ids)
			if listErr != nil {
				return nil, nil, listErr
			}

			hasNext := int64(query.Limit) < total
			return products, &ProductListPageInfo{HasNext: hasNext}, nil
		}
	}

	products, nextCursor, hasNext, err := s.repo.List(ctx, repository.ListProductsParams{
		Limit:    query.Limit,
		Cursor:   query.Cursor,
		Category: strings.TrimSpace(query.Category),
		Brand:    strings.TrimSpace(query.Brand),
		Tag:      strings.TrimSpace(query.Tag),
		Status:   strings.TrimSpace(query.Status),
		Search:   strings.TrimSpace(query.Search),
		MinPrice: query.MinPrice,
		MaxPrice: query.MaxPrice,
		Size:     strings.TrimSpace(query.Size),
		Color:    strings.TrimSpace(query.Color),
		Sort:     normalizeSort(query.Sort),
	})
	if err != nil {
		if errors.Is(err, repository.ErrInvalidCursor) {
			return nil, nil, ErrInvalidCursor
		}
		return nil, nil, err
	}

	return products, &ProductListPageInfo{NextCursor: nextCursor, HasNext: hasNext}, nil
}

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
			Size:  strings.TrimSpace(variant.Size),
			Color: strings.TrimSpace(variant.Color),
			Price: variant.Price,
			Stock: variant.Stock,
		})
	}
	return normalized
}

func shouldUseSearchBackend(query dto.ListProductsQuery) bool {
	if strings.TrimSpace(query.Search) == "" {
		return false
	}

	return normalizeSort(query.Sort) != "popular"
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

func normalizeSort(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "price_asc", "price_desc", "popular":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "latest"
	}
}
