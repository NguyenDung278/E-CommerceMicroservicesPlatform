package service

import (
	"context"
	"fmt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/model"
)

// AddItem adds a product to the cart or increases the quantity if the product is
// already present.
//
// Inputs:
//   - ctx carries cancellation to Redis and the product-service lookup.
//   - userID identifies the cart owner.
//   - req contains the target product id and quantity delta.
//
// Returns:
//   - the updated cart.
//   - a business or dependency error when the product cannot be resolved or stock is insufficient.
//
// Edge cases:
//   - the latest product price is always reloaded from product-service, even for existing cart items.
//
// Side effects:
//   - reads the current cart from Redis.
//   - reads the authoritative product snapshot from product-service.
//   - writes the updated cart back to Redis.
//
// Performance:
//   - O(n) over cart items to find an existing line item, while total updates are applied incrementally to avoid a second O(n) recalculation pass.
func (s *CartService) AddItem(ctx context.Context, userID string, req dto.AddToCartRequest) (*model.Cart, error) {
	cart, err := s.loadCart(ctx, userID)
	if err != nil {
		return nil, err
	}

	product, err := s.getProductForCart(ctx, req.ProductID)
	if err != nil {
		return nil, err
	}

	itemIndex := findCartItemIndex(cart.Items, req.ProductID)
	if itemIndex >= 0 {
		updatedItem, delta, err := mergeCartItem(cart.Items[itemIndex], product, req.Quantity)
		if err != nil {
			return nil, err
		}
		cart.Items[itemIndex] = updatedItem
		cart.Total += delta
		return cart, s.saveCart(ctx, cart)
	}

	item, err := newCartItem(product, req)
	if err != nil {
		return nil, err
	}
	cart.Items = append(cart.Items, item)
	cart.Total += itemSubtotal(item)
	return cart, s.saveCart(ctx, cart)
}

// UpdateItem replaces the quantity of an existing cart item.
//
// Inputs:
//   - ctx carries cancellation to Redis.
//   - userID identifies the cart owner.
//   - productID identifies the cart item to update.
//   - req contains the replacement quantity.
//
// Returns:
//   - the updated cart.
//   - ErrItemNotFound when the product is not in the cart.
//   - any repository error.
//
// Edge cases:
//   - unchanged quantities short-circuit without re-saving the cart.
//
// Side effects:
//   - reads and may write the user's cart in Redis.
//
// Performance:
//   - O(n) to find the item, with total updated incrementally instead of rescanning the full cart.
func (s *CartService) UpdateItem(ctx context.Context, userID, productID string, req dto.UpdateCartItemRequest) (*model.Cart, error) {
	cart, err := s.loadCart(ctx, userID)
	if err != nil {
		return nil, err
	}

	itemIndex := findCartItemIndex(cart.Items, productID)
	if itemIndex < 0 {
		return nil, ErrItemNotFound
	}
	if cart.Items[itemIndex].Quantity == req.Quantity {
		return cart, nil
	}

	previousSubtotal := itemSubtotal(cart.Items[itemIndex])
	cart.Items[itemIndex].Quantity = req.Quantity
	cart.Total += itemSubtotal(cart.Items[itemIndex]) - previousSubtotal
	return cart, s.saveCart(ctx, cart)
}

// RemoveItem removes a product from the cart.
//
// Inputs:
//   - ctx carries cancellation to Redis.
//   - userID identifies the cart owner.
//   - productID identifies the cart item to remove.
//
// Returns:
//   - the updated cart.
//   - ErrItemNotFound when the product is not in the cart.
//   - any repository error.
//
// Edge cases:
//   - removing the final item leaves the cart with an empty item slice and zero total.
//
// Side effects:
//   - reads and writes the user's cart in Redis.
//
// Performance:
//   - O(n) to find and remove the item, while total updates avoid a second full-cart scan.
func (s *CartService) RemoveItem(ctx context.Context, userID, productID string) (*model.Cart, error) {
	cart, err := s.loadCart(ctx, userID)
	if err != nil {
		return nil, err
	}

	itemIndex := findCartItemIndex(cart.Items, productID)
	if itemIndex < 0 {
		return nil, ErrItemNotFound
	}

	removedItem := cart.Items[itemIndex]
	copy(cart.Items[itemIndex:], cart.Items[itemIndex+1:])
	cart.Items = cart.Items[:len(cart.Items)-1]
	cart.Total -= itemSubtotal(removedItem)
	if len(cart.Items) == 0 || cart.Total < 0 {
		cart.Total = 0
	}

	return cart, s.saveCart(ctx, cart)
}

// mergeCartItem applies an additive quantity change to an existing cart item
// using the latest product snapshot from product-service.
//
// Inputs:
//   - current is the existing cart item.
//   - product is the authoritative product snapshot.
//   - quantityDelta is the quantity to add.
//
// Returns:
//   - the updated cart item.
//   - the cart total delta caused by the change.
//   - an error when stock would be exceeded.
//
// Edge cases:
//   - product price changes immediately affect the stored cart item so the cart reflects the latest catalog price.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func mergeCartItem(current model.CartItem, product *productSnapshot, quantityDelta int) (model.CartItem, float64, error) {
	nextQuantity := current.Quantity + quantityDelta
	if err := ensureProductStock(product, nextQuantity); err != nil {
		return model.CartItem{}, 0, err
	}

	previousSubtotal := itemSubtotal(current)
	current.Quantity = nextQuantity
	current.Name = product.name
	current.Price = product.price

	return current, itemSubtotal(current) - previousSubtotal, nil
}

// newCartItem converts an authoritative product snapshot into a cart line item.
//
// Inputs:
//   - product is the authoritative product snapshot.
//   - req contains the product id and requested quantity.
//
// Returns:
//   - the new cart item.
//   - an error when stock would be exceeded.
//
// Edge cases:
//   - quantity validation is still enforced here even though the HTTP layer validates positive quantities.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func newCartItem(product *productSnapshot, req dto.AddToCartRequest) (model.CartItem, error) {
	if err := ensureProductStock(product, req.Quantity); err != nil {
		return model.CartItem{}, err
	}

	return model.CartItem{
		ProductID: req.ProductID,
		Name:      product.name,
		Price:     product.price,
		Quantity:  req.Quantity,
	}, nil
}

// ensureProductStock validates that the requested quantity is available for the
// current product snapshot.
//
// Inputs:
//   - product is the authoritative product snapshot.
//   - quantity is the desired quantity.
//
// Returns:
//   - nil when stock is sufficient.
//   - ErrInsufficientStock wrapped with contextual information otherwise.
//
// Edge cases:
//   - zero or negative quantities are treated as insufficient by the calling layers before reaching here.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func ensureProductStock(product *productSnapshot, quantity int) error {
	if product.stockQuantity < int32(quantity) {
		return fmt.Errorf("%w: product %s only has %d item(s)", ErrInsufficientStock, product.name, product.stockQuantity)
	}
	return nil
}
