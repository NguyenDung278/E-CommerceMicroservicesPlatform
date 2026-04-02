package service

import (
	"context"
	"errors"

	pb "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/proto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/repository"
)

var (
	ErrItemNotFound       = errors.New("item not found in cart")
	ErrProductNotFound    = errors.New("product not found")
	ErrProductUnavailable = errors.New("product is unavailable")
	ErrInsufficientStock  = errors.New("insufficient stock")
)

// productCatalog describes the product-service lookup capability required by
// cart mutations.
type productCatalog interface {
	GetProduct(ctx context.Context, productID string) (*pb.Product, error)
}

// CartService contains business logic for cart operations.
type CartService struct {
	repo          repository.CartRepository
	productClient productCatalog
}

// NewCartService wires the dependencies required by the cart domain.
//
// Inputs:
//   - repo persists cart state in Redis.
//   - productClient loads authoritative product pricing and stock.
//
// Returns:
//   - a ready-to-use cart service.
//
// Edge cases:
//   - productClient may be nil only if callers never invoke mutation methods.
//
// Side effects:
//   - none during construction.
//
// Performance:
//   - O(1); the constructor stores references only.
func NewCartService(repo repository.CartRepository, productClient productCatalog) *CartService {
	return &CartService{repo: repo, productClient: productClient}
}

// GetCart retrieves the current cart for a user.
//
// Inputs:
//   - ctx carries cancellation to Redis.
//   - userID identifies the owning user.
//
// Returns:
//   - the user's cart, or an empty cart if the repository has no stored cart.
//   - any repository error.
//
// Edge cases:
//   - nil carts returned by custom repository implementations are normalized into empty carts.
//
// Side effects:
//   - none.
//
// Performance:
//   - one repository lookup.
func (s *CartService) GetCart(ctx context.Context, userID string) (*model.Cart, error) {
	return s.loadCart(ctx, userID)
}

// ClearCart removes all cart state for a user.
//
// Inputs:
//   - ctx carries cancellation to Redis.
//   - userID identifies the owning user.
//
// Returns:
//   - nil on success.
//   - any repository error.
//
// Edge cases:
//   - deleting an already-empty cart is delegated to the repository.
//
// Side effects:
//   - deletes cart state from Redis.
//
// Performance:
//   - one repository delete.
func (s *CartService) ClearCart(ctx context.Context, userID string) error {
	return s.repo.Delete(ctx, userID)
}
