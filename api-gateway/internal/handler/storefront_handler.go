package handler

import (
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/api-gateway/internal/proxy"
	"github.com/labstack/echo/v4"
)

// StorefrontHandler proxies public storefront category/editorial requests.
type StorefrontHandler struct {
	forward echo.HandlerFunc
}

// NewStorefrontHandler creates a new storefront proxy handler.
func NewStorefrontHandler(p *proxy.ServiceProxy) *StorefrontHandler {
	return &StorefrontHandler{
		forward: forwardWithProxy("product service", p),
	}
}

// RegisterRoutes registers public storefront routes.
func (h *StorefrontHandler) RegisterRoutes(e *echo.Echo) {
	public := e.Group("/api/v1/storefront")
	public.GET("/home", h.forward)
	public.GET("/categories", h.forward)
	public.GET("/categories/:identifier", h.forward)
}
