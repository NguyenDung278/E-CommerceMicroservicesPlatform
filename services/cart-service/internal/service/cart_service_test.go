package service

import (
	"context"
	"errors"
	"testing"

	pb "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/proto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/model"
	"google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"
)

type fakeCartRepo struct {
	carts     map[string]*model.Cart
	saveCount int
	delCount  int
}

type fakeProductCatalog struct {
	products map[string]*pb.Product
	errs     map[string]error
}

func newFakeCartRepo() *fakeCartRepo {
	return &fakeCartRepo{carts: map[string]*model.Cart{}}
}

func (r *fakeCartRepo) Get(_ context.Context, userID string) (*model.Cart, error) {
	if cart, ok := r.carts[userID]; ok {
		copyCart := *cart
		copyCart.Items = append([]model.CartItem(nil), cart.Items...)
		return &copyCart, nil
	}
	return &model.Cart{UserID: userID, Items: []model.CartItem{}, Total: 0}, nil
}

func (r *fakeCartRepo) Save(_ context.Context, cart *model.Cart) error {
	copyCart := *cart
	copyCart.Items = append([]model.CartItem(nil), cart.Items...)
	r.carts[cart.UserID] = &copyCart
	r.saveCount++
	return nil
}

func (r *fakeCartRepo) Delete(_ context.Context, userID string) error {
	delete(r.carts, userID)
	r.delCount++
	return nil
}

func (c *fakeProductCatalog) GetProduct(_ context.Context, productID string) (*pb.Product, error) {
	if err, ok := c.errs[productID]; ok {
		return nil, err
	}
	product, ok := c.products[productID]
	if !ok {
		return nil, grpcstatus.Error(codes.NotFound, "product not found")
	}
	copyProduct := *product
	return &copyProduct, nil
}

func TestAddItemAddsNewProductAndUpdatesTotal(t *testing.T) {
	repo := newFakeCartRepo()
	catalog := &fakeProductCatalog{
		products: map[string]*pb.Product{
			"product-1": {Id: "product-1", Name: "Keyboard", Price: 50, StockQuantity: 8},
		},
	}
	svc := NewCartService(repo, catalog)

	cart, err := svc.AddItem(context.Background(), "user-1", dto.AddToCartRequest{ProductID: "product-1", Quantity: 2})
	if err != nil {
		t.Fatalf("AddItem returned error: %v", err)
	}

	if len(cart.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(cart.Items))
	}
	if cart.Total != 100 {
		t.Fatalf("expected total 100, got %.2f", cart.Total)
	}
	if repo.saveCount != 1 {
		t.Fatalf("expected one save, got %d", repo.saveCount)
	}
}

func TestAddItemMergesExistingItemAndUsesLatestPrice(t *testing.T) {
	repo := newFakeCartRepo()
	repo.carts["user-1"] = &model.Cart{
		UserID: "user-1",
		Items: []model.CartItem{
			{ProductID: "product-1", Name: "Keyboard", Price: 40, Quantity: 1},
		},
		Total: 40,
	}
	catalog := &fakeProductCatalog{
		products: map[string]*pb.Product{
			"product-1": {Id: "product-1", Name: "Mechanical Keyboard", Price: 55, StockQuantity: 5},
		},
	}
	svc := NewCartService(repo, catalog)

	cart, err := svc.AddItem(context.Background(), "user-1", dto.AddToCartRequest{ProductID: "product-1", Quantity: 2})
	if err != nil {
		t.Fatalf("AddItem returned error: %v", err)
	}

	if len(cart.Items) != 1 {
		t.Fatalf("expected merged item, got %d items", len(cart.Items))
	}
	if cart.Items[0].Quantity != 3 {
		t.Fatalf("expected quantity 3, got %d", cart.Items[0].Quantity)
	}
	if cart.Items[0].Price != 55 {
		t.Fatalf("expected refreshed price 55, got %.2f", cart.Items[0].Price)
	}
	if cart.Total != 165 {
		t.Fatalf("expected total 165 after delta update, got %.2f", cart.Total)
	}
}

func TestAddItemReturnsInsufficientStock(t *testing.T) {
	repo := newFakeCartRepo()
	catalog := &fakeProductCatalog{
		products: map[string]*pb.Product{
			"product-1": {Id: "product-1", Name: "Mouse", Price: 25, StockQuantity: 1},
		},
	}
	svc := NewCartService(repo, catalog)

	_, err := svc.AddItem(context.Background(), "user-1", dto.AddToCartRequest{ProductID: "product-1", Quantity: 2})
	if !errors.Is(err, ErrInsufficientStock) {
		t.Fatalf("expected ErrInsufficientStock, got %v", err)
	}
}

func TestUpdateItemSkipsSaveWhenQuantityUnchanged(t *testing.T) {
	repo := newFakeCartRepo()
	repo.carts["user-1"] = &model.Cart{
		UserID: "user-1",
		Items: []model.CartItem{
			{ProductID: "product-1", Name: "Keyboard", Price: 50, Quantity: 2},
		},
		Total: 100,
	}
	svc := NewCartService(repo, &fakeProductCatalog{})

	cart, err := svc.UpdateItem(context.Background(), "user-1", "product-1", dto.UpdateCartItemRequest{Quantity: 2})
	if err != nil {
		t.Fatalf("UpdateItem returned error: %v", err)
	}
	if cart.Total != 100 {
		t.Fatalf("expected total to stay 100, got %.2f", cart.Total)
	}
	if repo.saveCount != 0 {
		t.Fatalf("expected no save when quantity is unchanged, got %d", repo.saveCount)
	}
}

func TestRemoveItemSubtractsSubtotal(t *testing.T) {
	repo := newFakeCartRepo()
	repo.carts["user-1"] = &model.Cart{
		UserID: "user-1",
		Items: []model.CartItem{
			{ProductID: "product-1", Name: "Keyboard", Price: 50, Quantity: 2},
			{ProductID: "product-2", Name: "Mouse", Price: 25, Quantity: 1},
		},
		Total: 125,
	}
	svc := NewCartService(repo, &fakeProductCatalog{})

	cart, err := svc.RemoveItem(context.Background(), "user-1", "product-1")
	if err != nil {
		t.Fatalf("RemoveItem returned error: %v", err)
	}
	if len(cart.Items) != 1 || cart.Items[0].ProductID != "product-2" {
		t.Fatalf("unexpected cart items after removal: %#v", cart.Items)
	}
	if cart.Total != 25 {
		t.Fatalf("expected total 25, got %.2f", cart.Total)
	}
	if repo.saveCount != 1 {
		t.Fatalf("expected one save, got %d", repo.saveCount)
	}
}

func TestAddItemMapsProductNotFound(t *testing.T) {
	repo := newFakeCartRepo()
	catalog := &fakeProductCatalog{
		errs: map[string]error{
			"missing": grpcstatus.Error(codes.NotFound, "missing"),
		},
	}
	svc := NewCartService(repo, catalog)

	_, err := svc.AddItem(context.Background(), "user-1", dto.AddToCartRequest{ProductID: "missing", Quantity: 1})
	if !errors.Is(err, ErrProductNotFound) {
		t.Fatalf("expected ErrProductNotFound, got %v", err)
	}
}
