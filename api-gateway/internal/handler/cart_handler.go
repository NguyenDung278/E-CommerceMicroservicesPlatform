package handler

import (
	"net/http"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/api-gateway/internal/proxy"
	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/labstack/echo/v4"
)

// CartHandler handles cart service requests
type CartHandler struct {
	proxy *proxy.ServiceProxy
}

// NewCartHandler creates a new cart handler
func NewCartHandler(p *proxy.ServiceProxy) *CartHandler {
	return &CartHandler{
		proxy: p,
	}
}

// RegisterRoutes registers cart service routes
func (h *CartHandler) RegisterRoutes(g *echo.Group, jwtSecret string) {
	// All cart endpoints require authentication
	g.Use(appmw.JWTAuth(jwtSecret))

	g.GET("/", h.forwardRequest)
	g.POST("/", h.forwardRequest)
	g.DELETE("/", h.forwardRequest)
	g.POST("/items", h.forwardRequest)
	g.PUT("/items/:itemID", h.forwardRequest)
	g.DELETE("/items/:itemID", h.forwardRequest)
}

// forwardRequest proxies the request to the cart service
func (h *CartHandler) forwardRequest(c echo.Context) error {
	req := c.Request()
	resp, err := h.proxy.Do(c.Request().Context(), req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to proxy request to cart service",
		})
	}

	if err := h.proxy.ForwardResponse(c.Response(), resp); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to forward response from cart service",
		})
	}

	return nil
}
