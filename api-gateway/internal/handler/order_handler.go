package handler

import (
	"net/http"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/api-gateway/internal/proxy"
	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/labstack/echo/v4"
)

// OrderHandler handles order service requests
type OrderHandler struct {
	proxy *proxy.ServiceProxy
}

// NewOrderHandler creates a new order handler
func NewOrderHandler(p *proxy.ServiceProxy) *OrderHandler {
	return &OrderHandler{
		proxy: p,
	}
}

// RegisterRoutes registers order service routes
func (h *OrderHandler) RegisterRoutes(g *echo.Group, jwtSecret string) {
	// All order endpoints require authentication
	g.Use(appmw.JWTAuth(jwtSecret))

	// Order endpoints
	g.POST("/", h.forwardRequest)
	g.GET("/:id", h.forwardRequest)
	g.GET("/user", h.forwardRequest)
	g.PUT("/:id/status", h.forwardRequest)
	g.DELETE("/:id", h.forwardRequest)
}

// forwardRequest proxies the request to the order service
func (h *OrderHandler) forwardRequest(c echo.Context) error {
	req := c.Request()
	resp, err := h.proxy.Do(c.Request().Context(), req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to proxy request to order service",
		})
	}

	if err := h.proxy.ForwardResponse(c.Response(), resp); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to forward response from order service",
		})
	}

	return nil
}
