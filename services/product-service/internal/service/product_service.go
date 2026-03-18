package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/repository"
)

var (
	ErrProductNotFound = errors.New("product not found")
)

// ProductService contains business logic for product operations.
type ProductService struct {
	repo repository.ProductRepository
}

func NewProductService(repo repository.ProductRepository) *ProductService {
	return &ProductService{repo: repo}
}

func (s *ProductService) Create(ctx context.Context, req dto.CreateProductRequest) (*model.Product, error) {
	now := time.Now()
	product := &model.Product{
		ID:          uuid.New().String(),
		Name:        req.Name,
		Description: req.Description,
		Price:       req.Price,
		Stock:       req.Stock,
		Category:    req.Category,
		ImageURL:    req.ImageURL,
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

	// Apply partial updates — only non-nil fields are updated.
	// WHY POINTER FIELDS: Distinguishes between "not provided" (nil) and "set to zero value".
	if req.Name != nil {
		product.Name = *req.Name
	}
	if req.Description != nil {
		product.Description = *req.Description
	}
	if req.Price != nil {
		product.Price = *req.Price
	}
	if req.Stock != nil {
		product.Stock = *req.Stock
	}
	if req.Category != nil {
		product.Category = *req.Category
	}
	if req.ImageURL != nil {
		product.ImageURL = *req.ImageURL
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

// List returns paginated products with optional category/search filtering.
func (s *ProductService) List(ctx context.Context, query dto.ListProductsQuery) ([]*model.Product, int64, error) {
	// Apply defaults for pagination.
	if query.Page < 1 {
		query.Page = 1
	}
	if query.Limit < 1 || query.Limit > 100 {
		query.Limit = 20
	}
	offset := (query.Page - 1) * query.Limit

	return s.repo.List(ctx, offset, query.Limit, query.Category, query.Search)
}

// CheckStock verifies if a product has sufficient stock.
// Used by Order Service via gRPC before creating an order.
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
