package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/repository"
)

type fakeProductServiceRepo struct {
	products       map[string]*model.Product
	lastListParams repository.ListProductsParams
	listCalled     bool
	listResults    []*model.Product
	listNextCursor string
	listHasNext    bool
	listErr        error
	listByIDsInput []string
	searchProducts []*model.Product
}

type fakeProductSearchIndex struct {
	searchIDs    []string
	searchTotal  int64
	searchErr    error
	searchCalls  int
	lastQuery    dto.ListProductsQuery
	indexedIDs   []string
	deletedIDs   []string
	reindexedIDs []string
}

func newFakeProductServiceRepo() *fakeProductServiceRepo {
	return &fakeProductServiceRepo{
		products: map[string]*model.Product{},
	}
}

func (r *fakeProductServiceRepo) Create(_ context.Context, product *model.Product) error {
	copyValue := *product
	r.products[product.ID] = &copyValue
	return nil
}

func (r *fakeProductServiceRepo) GetByID(_ context.Context, id string) (*model.Product, error) {
	product, ok := r.products[id]
	if !ok {
		return nil, nil
	}
	copyValue := *product
	return &copyValue, nil
}

func (r *fakeProductServiceRepo) Update(_ context.Context, product *model.Product) error {
	copyValue := *product
	r.products[product.ID] = &copyValue
	return nil
}

func (r *fakeProductServiceRepo) Delete(_ context.Context, id string) error {
	delete(r.products, id)
	return nil
}

func (r *fakeProductServiceRepo) List(_ context.Context, params repository.ListProductsParams) ([]*model.Product, string, bool, error) {
	r.listCalled = true
	r.lastListParams = params
	if r.listErr != nil {
		return nil, "", false, r.listErr
	}

	results := make([]*model.Product, 0, len(r.listResults))
	for _, product := range r.listResults {
		copyValue := *product
		results = append(results, &copyValue)
	}
	return results, r.listNextCursor, r.listHasNext, nil
}

func (r *fakeProductServiceRepo) ListByIDs(_ context.Context, ids []string) ([]*model.Product, error) {
	r.listByIDsInput = append([]string(nil), ids...)
	results := make([]*model.Product, 0, len(ids))
	for _, id := range ids {
		if product, ok := r.products[id]; ok {
			copyValue := *product
			results = append(results, &copyValue)
		}
	}
	return results, nil
}

func (r *fakeProductServiceRepo) ListForSearchIndex(_ context.Context) ([]*model.Product, error) {
	results := make([]*model.Product, 0, len(r.searchProducts))
	for _, product := range r.searchProducts {
		copyValue := *product
		results = append(results, &copyValue)
	}
	return results, nil
}

func (r *fakeProductServiceRepo) UpdateStock(_ context.Context, _ string, _ int) error {
	return nil
}

func (r *fakeProductServiceRepo) RestoreStock(_ context.Context, id string, quantity int) error {
	product, ok := r.products[id]
	if !ok {
		return errors.New("product not found")
	}
	product.Stock += quantity
	return nil
}

func (r *fakeProductServiceRepo) ListLowStock(_ context.Context, threshold int) ([]*model.Product, error) {
	results := make([]*model.Product, 0)
	for _, product := range r.products {
		if product.Stock <= threshold {
			copyValue := *product
			results = append(results, &copyValue)
		}
	}
	return results, nil
}

func (r *fakeProductServiceRepo) CreateReview(_ context.Context, _ *model.ProductReview) error {
	return nil
}

func (r *fakeProductServiceRepo) GetReviewByProductAndUser(_ context.Context, _, _ string) (*model.ProductReview, error) {
	return nil, nil
}

func (r *fakeProductServiceRepo) UpdateReview(_ context.Context, _ *model.ProductReview) error {
	return nil
}

func (r *fakeProductServiceRepo) DeleteReviewByProductAndUser(_ context.Context, _, _ string) (bool, error) {
	return false, nil
}

func (r *fakeProductServiceRepo) ListReviewsByProduct(_ context.Context, _ string, _, _ int) ([]*model.ProductReview, int64, error) {
	return []*model.ProductReview{}, 0, nil
}

func (r *fakeProductServiceRepo) GetReviewSummary(_ context.Context, _ string) (*model.ProductReviewSummary, error) {
	return &model.ProductReviewSummary{}, nil
}

func (s *fakeProductSearchIndex) Search(_ context.Context, query dto.ListProductsQuery) ([]string, int64, error) {
	s.searchCalls++
	s.lastQuery = query
	if s.searchErr != nil {
		return nil, 0, s.searchErr
	}
	return append([]string(nil), s.searchIDs...), s.searchTotal, nil
}

func (s *fakeProductSearchIndex) Index(_ context.Context, product *model.Product) error {
	s.indexedIDs = append(s.indexedIDs, product.ID)
	return nil
}

func (s *fakeProductSearchIndex) Delete(_ context.Context, productID string) error {
	s.deletedIDs = append(s.deletedIDs, productID)
	return nil
}

func (s *fakeProductSearchIndex) Reindex(_ context.Context, products []*model.Product) error {
	s.reindexedIDs = make([]string, 0, len(products))
	for _, product := range products {
		s.reindexedIDs = append(s.reindexedIDs, product.ID)
	}
	return nil
}

func TestCreateNormalizesFieldsAndIndexesProduct(t *testing.T) {
	repo := newFakeProductServiceRepo()
	search := &fakeProductSearchIndex{}
	svc := NewProductService(repo, WithSearchIndex(search), WithLogger(zap.NewNop()))

	product, err := svc.Create(context.Background(), dto.CreateProductRequest{
		Name:        "  Running Shoe  ",
		Description: "  Lightweight trainer  ",
		Price:       120,
		Stock:       3,
		Category:    "  Footwear ",
		Brand:       "  ACME ",
		Tags:        []string{"Sport", " sport ", "RUN"},
		Status:      " ACTIVE ",
		SKU:         " SHOE-1 ",
		Variants: []dto.ProductVariantRequest{
			{SKU: " SHOE-1-42 ", Label: " Size 42 ", Size: " 42 ", Color: " Blue ", Price: 120, Stock: 4},
			{SKU: " SHOE-1-43 ", Label: " Size 43 ", Size: " 43 ", Color: " Blue ", Price: 120, Stock: 6},
		},
		ImageURL:  " https://cdn.example.com/primary.jpg ",
		ImageURLs: []string{"https://cdn.example.com/primary.jpg", " https://cdn.example.com/alt.jpg "},
	})
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}

	if product.Name != "Running Shoe" || product.Brand != "ACME" {
		t.Fatalf("expected trimmed fields, got %#v", product)
	}
	if product.Status != "active" {
		t.Fatalf("expected normalized status active, got %q", product.Status)
	}
	if product.Stock != 10 {
		t.Fatalf("expected variant-derived stock 10, got %d", product.Stock)
	}
	if len(product.Tags) != 2 || product.Tags[0] != "sport" || product.Tags[1] != "run" {
		t.Fatalf("expected normalized tags, got %#v", product.Tags)
	}
	if len(product.ImageURLs) != 2 || product.ImageURL != "https://cdn.example.com/primary.jpg" {
		t.Fatalf("expected normalized image URLs, got primary=%q urls=%#v", product.ImageURL, product.ImageURLs)
	}
	if len(search.indexedIDs) != 1 || search.indexedIDs[0] != product.ID {
		t.Fatalf("expected search index to receive product %q, got %#v", product.ID, search.indexedIDs)
	}
}

func TestListUsesSearchBackendWithNormalizedQuery(t *testing.T) {
	repo := newFakeProductServiceRepo()
	repo.products["product-2"] = &model.Product{ID: "product-2", Name: "Beta", CreatedAt: time.Now(), UpdatedAt: time.Now()}
	repo.products["product-1"] = &model.Product{ID: "product-1", Name: "Alpha", CreatedAt: time.Now(), UpdatedAt: time.Now()}
	search := &fakeProductSearchIndex{
		searchIDs:   []string{"  product-2 ", "product-2", "product-1", ""},
		searchTotal: 5,
	}
	svc := NewProductService(repo, WithSearchIndex(search), WithLogger(zap.NewNop()))

	products, pageInfo, err := svc.List(context.Background(), dto.ListProductsQuery{
		Limit:  2,
		Search: "  sneaker ",
		Sort:   " Price_ASC ",
	})
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}

	if search.searchCalls != 1 {
		t.Fatalf("expected one search call, got %d", search.searchCalls)
	}
	if search.lastQuery.Search != "sneaker" || search.lastQuery.Sort != "price_asc" {
		t.Fatalf("expected normalized search query, got %#v", search.lastQuery)
	}
	if repo.listCalled {
		t.Fatal("expected search-backed request to skip repository List")
	}
	if len(repo.listByIDsInput) != 2 || repo.listByIDsInput[0] != "product-2" || repo.listByIDsInput[1] != "product-1" {
		t.Fatalf("expected normalized id order, got %#v", repo.listByIDsInput)
	}
	if len(products) != 2 || products[0].ID != "product-2" || products[1].ID != "product-1" {
		t.Fatalf("expected products to preserve search ordering, got %#v", products)
	}
	if !pageInfo.HasNext || pageInfo.NextCursor != "" {
		t.Fatalf("expected search path page info with HasNext only, got %#v", pageInfo)
	}
}

func TestListFallsBackToRepositoryOnSearchError(t *testing.T) {
	repo := newFakeProductServiceRepo()
	repo.listResults = []*model.Product{
		{ID: "product-3", Name: "Fallback", CreatedAt: time.Now(), UpdatedAt: time.Now()},
	}
	repo.listNextCursor = "cursor-2"
	repo.listHasNext = true
	search := &fakeProductSearchIndex{searchErr: errors.New("search unavailable")}
	svc := NewProductService(repo, WithSearchIndex(search), WithLogger(zap.NewNop()))

	products, pageInfo, err := svc.List(context.Background(), dto.ListProductsQuery{
		Limit:    101,
		Cursor:   "  ",
		Category: "  Shoes ",
		Brand:    " ACME ",
		Tag:      " Sport ",
		Status:   " ACTIVE ",
		Search:   " trail ",
		Size:     " 42 ",
		Color:    " Blue ",
		Sort:     " newest ",
	})
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}

	if !repo.listCalled {
		t.Fatal("expected repository List to be used after search fallback")
	}
	if repo.lastListParams.Limit != 20 {
		t.Fatalf("expected normalized default limit 20, got %d", repo.lastListParams.Limit)
	}
	if repo.lastListParams.Category != "Shoes" || repo.lastListParams.Brand != "ACME" || repo.lastListParams.Search != "trail" {
		t.Fatalf("expected trimmed repository params, got %#v", repo.lastListParams)
	}
	if repo.lastListParams.Sort != "latest" {
		t.Fatalf("expected fallback sort latest, got %q", repo.lastListParams.Sort)
	}
	if len(products) != 1 || products[0].ID != "product-3" {
		t.Fatalf("expected fallback products, got %#v", products)
	}
	if pageInfo.NextCursor != "cursor-2" || !pageInfo.HasNext {
		t.Fatalf("unexpected page info %#v", pageInfo)
	}
}
