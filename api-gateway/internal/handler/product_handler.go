package handler

import (
	"net/http"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/api-gateway/internal/proxy"
	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/labstack/echo/v4"
)

// ProductHandler handles product service requests
type ProductHandler struct {
	proxy *proxy.ServiceProxy
}

// NewProductHandler creates a new product handler
func NewProductHandler(p *proxy.ServiceProxy) *ProductHandler {
	return &ProductHandler{
		proxy: p,
	}
}

// RegisterRoutes registers product service routes
func (h *ProductHandler) RegisterRoutes(g *echo.Group, jwtSecret string) {
	// Public endpoints
	g.GET("/", h.forwardRequest)
	g.GET("/:id", h.forwardRequest)

	// Protected endpoints (admin)
	protected := g.Group("")
	protected.Use(appmw.JWTAuth(jwtSecret))
	
	protected.POST("/", h.forwardRequest)
	protected.PUT("/:id", h.forwardRequest)
	protected.DELETE("/:id", h.forwardRequest)
}

// forwardRequest proxies the request to the product service
func (h *ProductHandler) forwardRequest(c echo.Context) error {
	req := c.Request()
	resp, err := h.proxy.Do(c.Request().Context(), req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to proxy request to product service",
		})
	}

	if err := h.proxy.ForwardResponse(c.Response(), resp); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to forward response from product service",
		})
	}

	return nil
}
