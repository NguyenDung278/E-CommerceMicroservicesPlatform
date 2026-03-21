package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/grpc_client"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/repository"
	"google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"
)

var (
	ErrItemNotFound       = errors.New("item not found in cart")
	ErrProductNotFound    = errors.New("product not found")
	ErrProductUnavailable = errors.New("product is unavailable")
	ErrInsufficientStock  = errors.New("insufficient stock")
)

// CartService contains business logic for cart operations.
type CartService struct {
	repo          repository.CartRepository
	productClient *grpc_client.ProductClient
}

func NewCartService(repo repository.CartRepository, productClient *grpc_client.ProductClient) *CartService {
	return &CartService{repo: repo, productClient: productClient}
}

// GetCart retrieves the cart for a user.
func (s *CartService) GetCart(ctx context.Context, userID string) (*model.Cart, error) {
	return s.repo.Get(ctx, userID)
}

// AddItem adds a product to the cart or increments quantity if it already exists.
//
// YÊU CẦU NGHIỆP VỤ (DESIGN DECISION):
// 1. Phải gọi gRPC (productClient) sang Product Service để lấy giá gốc và Stock hiện tại, KHÔNG TỰ TIN tưởng giá do Client gửi lên.
// 2. Nếu Product ID đã có trong mảng Items, ta chỉ cộng dồn (+= quantity) chứ không Push object mới.
// 3. Trước khi add phải check: Stock >= Quantity cần mua. Nếu không đủ thì trả lỗi `ErrInsufficientStock`.
func (s *CartService) AddItem(ctx context.Context, userID string, req dto.AddToCartRequest) (*model.Cart, error) {
	cart, err := s.repo.Get(ctx, userID)
	if err != nil {
		return nil, err
	}

	product, err := s.productClient.GetProduct(ctx, req.ProductID)
	if err != nil {
		switch grpcstatus.Code(err) {
		case codes.NotFound:
			return nil, fmt.Errorf("%w: %s", ErrProductNotFound, req.ProductID)
		case codes.InvalidArgument:
			return nil, fmt.Errorf("%w: %s", ErrProductUnavailable, req.ProductID)
		default:
			return nil, fmt.Errorf("failed to fetch product %s: %w", req.ProductID, err)
		}
	}

	// Check if item already exists in cart — increment quantity if so.
	found := false
	for i, item := range cart.Items {
		if item.ProductID == req.ProductID {
			nextQuantity := cart.Items[i].Quantity + req.Quantity
			if product.StockQuantity < int32(nextQuantity) {
				return nil, fmt.Errorf("%w: product %s only has %d item(s)", ErrInsufficientStock, product.Name, product.StockQuantity)
			}

			cart.Items[i].Quantity += req.Quantity
			cart.Items[i].Name = product.Name
			cart.Items[i].Price = float64(product.Price)
			found = true
			break
		}
	}

	if !found {
		if product.StockQuantity < int32(req.Quantity) {
			return nil, fmt.Errorf("%w: product %s only has %d item(s)", ErrInsufficientStock, product.Name, product.StockQuantity)
		}

		cart.Items = append(cart.Items, model.CartItem{
			ProductID: req.ProductID,
			Name:      product.Name,
			Price:     float64(product.Price),
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
