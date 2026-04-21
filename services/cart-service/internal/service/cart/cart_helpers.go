package service

import (
	"context"
	"fmt"

	"google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/model"
)

type productSnapshot struct {
	name          string
	price         float64
	stockQuantity int32
}

// loadCart retrieves a cart from the repository and normalizes nil carts into
// an empty aggregate.
//
// Inputs:
//   - ctx carries cancellation to Redis.
//   - userID identifies the cart owner.
//
// Returns:
//   - the normalized cart aggregate.
//   - any repository error.
//
// Edge cases:
//   - nil repository responses are normalized to an empty cart for safety with fake implementations.
//
// Side effects:
//   - none.
//
// Performance:
//   - one repository lookup.
func (s *CartService) loadCart(ctx context.Context, userID string) (*model.Cart, error) {
	cart, err := s.repo.Get(ctx, userID)
	if err != nil {
		return nil, err
	}
	if cart == nil {
		return &model.Cart{UserID: userID, Items: []model.CartItem{}, Total: 0}, nil
	}
	if cart.Items == nil {
		cart.Items = []model.CartItem{}
	}
	return cart, nil
}

// saveCart persists the current cart aggregate.
//
// Inputs:
//   - ctx carries cancellation to Redis.
//   - cart is the cart aggregate to persist.
//
// Returns:
//   - any repository error.
//
// Edge cases:
//   - carts with nil item slices are normalized to empty slices before saving.
//
// Side effects:
//   - writes the cart to Redis.
//
// Performance:
//   - one repository save.
func (s *CartService) saveCart(ctx context.Context, cart *model.Cart) error {
	if cart.Items == nil {
		cart.Items = []model.CartItem{}
	}
	return s.repo.Save(ctx, cart)
}

// getProductForCart loads the authoritative product snapshot required for cart
// mutations.
//
// Inputs:
//   - ctx carries cancellation to product-service.
//   - productID identifies the product to load.
//
// Returns:
//   - the normalized product snapshot.
//   - a domain error when the product is missing or unavailable.
//   - any other downstream error wrapped with product context.
//
// Edge cases:
//   - callers must supply a configured product client before invoking mutations.
//
// Side effects:
//   - performs one gRPC call to product-service.
//
// Performance:
//   - dominated by one downstream gRPC request.
func (s *CartService) getProductForCart(ctx context.Context, productID string) (*productSnapshot, error) {
	if s.productClient == nil {
		return nil, fmt.Errorf("product client is not configured")
	}

	product, err := s.productClient.GetProduct(ctx, productID)
	if err != nil {
		switch grpcstatus.Code(err) {
		case codes.NotFound:
			return nil, fmt.Errorf("%w: %s", ErrProductNotFound, productID)
		case codes.InvalidArgument:
			return nil, fmt.Errorf("%w: %s", ErrProductUnavailable, productID)
		default:
			return nil, fmt.Errorf("failed to fetch product %s: %w", productID, err)
		}
	}

	return &productSnapshot{
		name:          product.Name,
		price:         float64(product.Price),
		stockQuantity: product.StockQuantity,
	}, nil
}

// findCartItemIndex returns the index of a cart item by product id.
//
// Inputs:
//   - items is the cart item slice to search.
//   - productID identifies the desired item.
//
// Returns:
//   - the zero-based index when found.
//   - -1 when the product is not present.
//
// Edge cases:
//   - empty carts return -1.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the cart size.
func findCartItemIndex(items []model.CartItem, productID string) int {
	for index, item := range items {
		if item.ProductID == productID {
			return index
		}
	}
	return -1
}

// itemSubtotal calculates the subtotal contributed by one cart item.
//
// Inputs:
//   - item is the cart line item.
//
// Returns:
//   - price multiplied by quantity.
//
// Edge cases:
//   - negative quantities are not expected from validated callers.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func itemSubtotal(item model.CartItem) float64 {
	return item.Price * float64(item.Quantity)
}
