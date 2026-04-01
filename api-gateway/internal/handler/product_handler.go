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

// RegisterRoutes registers product service routes.
func (h *ProductHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	public := e.Group("/api/v1/products")
	public.GET("", h.forwardRequest)
	public.GET("/batch", h.forwardRequest)
	public.GET("/:id", h.forwardRequest)
	public.GET("/:id/reviews", h.forwardRequest)

	protected := e.Group("/api/v1/products")
	protected.Use(appmw.JWTAuth(jwtSecret))
	protected.Use(appmw.RequireRole(appmw.RoleAdmin, appmw.RoleStaff))
	protected.POST("", h.forwardRequest)
	protected.POST("/uploads", h.forwardRequest)
	protected.PUT("/:id", h.forwardRequest)
	protected.DELETE("/:id", h.forwardRequest)

	reviews := e.Group("/api/v1/products/:id/reviews")
	reviews.Use(appmw.JWTAuth(jwtSecret))
	reviews.GET("/me", h.forwardRequest)
	reviews.POST("", h.forwardRequest)
	reviews.PUT("/me", h.forwardRequest)
	reviews.DELETE("/me", h.forwardRequest)
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
