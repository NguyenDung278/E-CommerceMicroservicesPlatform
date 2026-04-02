package service

import (
	"context"
	"errors"

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
	ErrTooManyProductIDs       = errors.New("too many product ids")
)

const maxProductBatchLookup = 100

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

// WithMediaStore injects the media store used by image upload flows.
//
// Inputs:
//   - mediaStore is the object storage implementation.
//
// Returns:
//   - an option that mutates the service during construction.
//
// Edge cases:
//   - nil media stores are allowed until image-upload flows are used.
//
// Side effects:
//   - none until the option is applied.
//
// Performance:
//   - O(1).
func WithMediaStore(mediaStore MediaStore) ProductServiceOption {
	return func(service *ProductService) {
		service.mediaStore = mediaStore
	}
}

// WithSearchIndex injects the optional search backend used for catalog search.
//
// Inputs:
//   - search is the search index implementation.
//
// Returns:
//   - an option that mutates the service during construction.
//
// Edge cases:
//   - nil search backends are allowed and make List fall back to PostgreSQL only.
//
// Side effects:
//   - none until the option is applied.
//
// Performance:
//   - O(1).
func WithSearchIndex(search ProductSearchIndex) ProductServiceOption {
	return func(service *ProductService) {
		service.search = search
	}
}

// WithLogger injects the structured logger used for best-effort integration failures.
//
// Inputs:
//   - log is the logger implementation.
//
// Returns:
//   - an option that mutates the service during construction.
//
// Edge cases:
//   - nil loggers are allowed only if callers also accept a nil logger; NewProductService defaults to zap.NewNop.
//
// Side effects:
//   - none until the option is applied.
//
// Performance:
//   - O(1).
func WithLogger(log *zap.Logger) ProductServiceOption {
	return func(service *ProductService) {
		service.log = log
	}
}

// NewProductService wires the dependencies required by the product domain.
//
// Inputs:
//   - repo persists product state.
//   - options optionally inject search, media, and logging dependencies.
//
// Returns:
//   - a ready-to-use product service.
//
// Edge cases:
//   - optional integrations may remain nil until the relevant flow is exercised.
//
// Side effects:
//   - none during construction.
//
// Performance:
//   - O(k) over the number of options.
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
