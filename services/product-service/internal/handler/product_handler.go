package handler

import (
	producthandler "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/handler/product"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/service"
)

type ProductHandler = producthandler.ProductHandler
type StorefrontHandler = producthandler.StorefrontHandler

func NewProductHandler(productService *service.ProductService, reviewService *service.ProductReviewService) *ProductHandler {
	return producthandler.NewProductHandler(productService, reviewService)
}

func NewStorefrontHandler(storefrontService *service.StorefrontService) *StorefrontHandler {
	return producthandler.NewStorefrontHandler(storefrontService)
}
