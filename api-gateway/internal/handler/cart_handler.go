package handler

import (
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/api-gateway/internal/proxy"
	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/labstack/echo/v4"
)

// CartHandler handles cart service requests
type CartHandler struct {
	forward echo.HandlerFunc
}

// NewCartHandler creates a new cart handler
func NewCartHandler(p *proxy.ServiceProxy) *CartHandler {
	return &CartHandler{
		forward: forwardWithProxy("cart service", p),
	}
}

// RegisterRoutes registers cart service routes.
func (h *CartHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	cart := e.Group("/api/v1/cart")
	cart.Use(appmw.JWTAuth(jwtSecret))

	cart.GET("", h.forward)
	cart.DELETE("", h.forward)
	cart.POST("/items", h.forward)
	cart.PUT("/items/:productId", h.forward)
	cart.DELETE("/items/:productId", h.forward)
}
