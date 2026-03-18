package service

import (
	"context"
	"errors"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/repository"
)

var ErrItemNotFound = errors.New("item not found in cart")

// CartService contains business logic for cart operations.
type CartService struct {
	repo repository.CartRepository
}

func NewCartService(repo repository.CartRepository) *CartService {
	return &CartService{repo: repo}
}

// GetCart retrieves the cart for a user.
func (s *CartService) GetCart(ctx context.Context, userID string) (*model.Cart, error) {
	return s.repo.Get(ctx, userID)
}

// AddItem adds a product to the cart or increments quantity if it already exists.
//
// DESIGN DECISION: If the same product is added twice, we increment the quantity
// rather than creating a duplicate entry. This matches user expectations.
func (s *CartService) AddItem(ctx context.Context, userID string, req dto.AddToCartRequest) (*model.Cart, error) {
	cart, err := s.repo.Get(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Check if item already exists in cart — increment quantity if so.
	found := false
	for i, item := range cart.Items {
		if item.ProductID == req.ProductID {
			cart.Items[i].Quantity += req.Quantity
			cart.Items[i].Price = req.Price // Update price in case it changed
			found = true
			break
		}
	}

	if !found {
		cart.Items = append(cart.Items, model.CartItem{
			ProductID: req.ProductID,
			Name:      req.Name,
			Price:     req.Price,
			Quantity:  req.Quantity,
		})
	}

	cart.CalculateTotal()

	if err := s.repo.Save(ctx, cart); err != nil {
		return nil, err
	}
	return cart, nil
}

// UpdateItem updates the quantity of an item in the cart.
func (s *CartService) UpdateItem(ctx context.Context, userID, productID string, req dto.UpdateCartItemRequest) (*model.Cart, error) {
	cart, err := s.repo.Get(ctx, userID)
	if err != nil {
		return nil, err
	}

	found := false
	for i, item := range cart.Items {
		if item.ProductID == productID {
			cart.Items[i].Quantity = req.Quantity
			found = true
			break
		}
	}

	if !found {
		return nil, ErrItemNotFound
	}

	cart.CalculateTotal()

	if err := s.repo.Save(ctx, cart); err != nil {
		return nil, err
	}
	return cart, nil
}

// RemoveItem removes a product from the cart.
func (s *CartService) RemoveItem(ctx context.Context, userID, productID string) (*model.Cart, error) {
	cart, err := s.repo.Get(ctx, userID)
	if err != nil {
		return nil, err
	}

	newItems := make([]model.CartItem, 0, len(cart.Items))
	found := false
	for _, item := range cart.Items {
		if item.ProductID == productID {
			found = true
			continue
		}
		newItems = append(newItems, item)
	}

	if !found {
		return nil, ErrItemNotFound
	}

	cart.Items = newItems
	cart.CalculateTotal()

	if err := s.repo.Save(ctx, cart); err != nil {
		return nil, err
	}
	return cart, nil
}

// ClearCart removes all items from a user's cart.
func (s *CartService) ClearCart(ctx context.Context, userID string) error {
	return s.repo.Delete(ctx, userID)
}
