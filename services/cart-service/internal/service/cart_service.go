package service

import (
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/repository"
	cartsvc "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/service/cart"
)

var (
	ErrItemNotFound       = cartsvc.ErrItemNotFound
	ErrProductNotFound    = cartsvc.ErrProductNotFound
	ErrProductUnavailable = cartsvc.ErrProductUnavailable
	ErrInsufficientStock  = cartsvc.ErrInsufficientStock
)

type ProductCatalog = cartsvc.ProductCatalog
type CartService = cartsvc.CartService

func NewCartService(repo repository.CartRepository, productClient ProductCatalog) *CartService {
	return cartsvc.NewCartService(repo, productClient)
}
