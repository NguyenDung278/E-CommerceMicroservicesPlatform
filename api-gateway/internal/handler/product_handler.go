package handler

import (
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/api-gateway/internal/proxy"
	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/labstack/echo/v4"
)

// ProductHandler handles product service requests
type ProductHandler struct {
	forward echo.HandlerFunc
}

// NewProductHandler creates a new product handler
func NewProductHandler(p *proxy.ServiceProxy) *ProductHandler {
	return &ProductHandler{
		forward: forwardWithProxy("product service", p),
	}
}

// RegisterRoutes registers product service routes.
func (h *ProductHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	public := e.Group("/api/v1/products")
	public.GET("", h.forward)
	public.GET("/batch", h.forward)
	public.GET("/:id", h.forward)
	public.GET("/:id/reviews", h.forward)

	protected := e.Group("/api/v1/products")
	protected.Use(appmw.JWTAuth(jwtSecret))
	protected.Use(appmw.RequireRole(appmw.RoleAdmin, appmw.RoleStaff))
	protected.POST("", h.forward)
	protected.POST("/uploads", h.forward)
	protected.PUT("/:id", h.forward)
	protected.DELETE("/:id", h.forward)

	reviews := e.Group("/api/v1/products/:id/reviews")
	reviews.Use(appmw.JWTAuth(jwtSecret))
	reviews.GET("/me", h.forward)
	reviews.POST("", h.forward)
	reviews.PUT("/me", h.forward)
	reviews.DELETE("/me", h.forward)
}
