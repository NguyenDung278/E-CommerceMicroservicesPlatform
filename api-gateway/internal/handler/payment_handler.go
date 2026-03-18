package handler

import (
	"net/http"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/api-gateway/internal/proxy"
	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/labstack/echo/v4"
)

// PaymentHandler handles payment service requests
type PaymentHandler struct {
	proxy *proxy.ServiceProxy
}

// NewPaymentHandler creates a new payment handler
func NewPaymentHandler(p *proxy.ServiceProxy) *PaymentHandler {
	return &PaymentHandler{
		proxy: p,
	}
}

// RegisterRoutes registers payment service routes
func (h *PaymentHandler) RegisterRoutes(g *echo.Group, jwtSecret string) {
	// All payment endpoints require authentication
	g.Use(appmw.JWTAuth(jwtSecret))

	// Payment endpoints
	g.POST("/", h.forwardRequest)
	g.GET("/:id", h.forwardRequest)
	g.GET("/", h.forwardRequest)
}

// forwardRequest proxies the request to the payment service
func (h *PaymentHandler) forwardRequest(c echo.Context) error {
	req := c.Request()
	resp, err := h.proxy.Do(c.Request().Context(), req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to proxy request to payment service",
		})
	}

	if err := h.proxy.ForwardResponse(c.Response(), resp); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to forward response from payment service",
		})
	}

	return nil
}
