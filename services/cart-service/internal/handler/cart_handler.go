package handler

import (
	carthandler "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/handler/cart"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/service"
)

type CartHandler = carthandler.CartHandler

func NewCartHandler(cartService *service.CartService) *CartHandler {
	return carthandler.NewCartHandler(cartService)
}
