package service

import (
	"context"
	"fmt"

	"google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"

	pb "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/proto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/model"
)

// productSnapshot is the authoritative pricing and stock view for one
// purchasable line, already narrowed down to a specific variant when the
// product has any.
type productSnapshot struct {
	name          string
	sku           string
	variantLabel  string
	price         float64
	stockQuantity int32
}

// displayName names the exact thing that ran out, so an out-of-stock message
// says which size is unavailable instead of blaming the whole product.
func (p *productSnapshot) displayName() string {
	if p.variantLabel == "" {
		return p.name
	}
	return p.name + " (" + p.variantLabel + ")"
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

// getProductForCart loads the authoritative snapshot required for cart
// mutations, narrowed to the requested variant.
//
// Inputs:
//   - ctx carries cancellation to product-service.
//   - productID identifies the product to load.
//   - sku selects the variant, and is empty for products without variants.
//
// Returns:
//   - the normalized snapshot carrying the price and stock that actually apply
//     to the requested line.
//   - a domain error when the product is missing, unavailable, or the sku does
//     not resolve to a declared variant.
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
func (s *CartService) getProductForCart(ctx context.Context, productID, sku string) (*productSnapshot, error) {
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

	return resolveProductSnapshot(product, productID, sku)
}

// resolveProductSnapshot picks the price and stock pool a line item draws from.
//
// A product that declares variants has no meaningful product-level stock to buy
// against — its `stock_quantity` is only the aggregate across sizes — so a blank
// sku is rejected instead of being silently charged to that aggregate.
func resolveProductSnapshot(product *pb.Product, productID, sku string) (*productSnapshot, error) {
	variants := product.GetVariants()

	if sku == "" {
		if len(variants) > 0 {
			return nil, fmt.Errorf("%w: product %s", ErrVariantRequired, productID)
		}
		return &productSnapshot{
			name:          product.GetName(),
			price:         float64(product.GetPrice()),
			stockQuantity: product.GetStockQuantity(),
		}, nil
	}

	for _, variant := range variants {
		if variant.GetSku() != sku {
			continue
		}
		return &productSnapshot{
			name:          product.GetName(),
			sku:           variant.GetSku(),
			variantLabel:  variant.GetLabel(),
			price:         float64(variant.GetPrice()),
			stockQuantity: variant.GetStock(),
		}, nil
	}

	return nil, fmt.Errorf("%w: product %s sku %s", ErrVariantNotFound, productID, sku)
}

// findCartItemIndex returns the index of a cart line item.
//
// Inputs:
//   - items is the cart item slice to search.
//   - productID and sku together identify the desired line item.
//
// Returns:
//   - the zero-based index when found.
//   - -1 when the line item is not present.
//
// Edge cases:
//   - empty carts return -1.
//   - two variants of one product are distinct lines, so the sku must match too.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the cart size.
func findCartItemIndex(items []model.CartItem, productID, sku string) int {
	for index, item := range items {
		if item.ProductID == productID && item.SKU == sku {
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
