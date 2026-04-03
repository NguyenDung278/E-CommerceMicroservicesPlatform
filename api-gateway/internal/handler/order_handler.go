package handler

import (
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/api-gateway/internal/proxy"
	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/labstack/echo/v4"
)

// OrderHandler handles order service requests.
type OrderHandler struct {
	forward echo.HandlerFunc
}

func NewOrderHandler(p *proxy.ServiceProxy) *OrderHandler {
	return &OrderHandler{
		forward: forwardWithProxy("order service", p),
	}
}

func (h *OrderHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	catalog := e.Group("/api/v1/catalog")
	catalog.GET("/popularity", h.forward)

	orders := e.Group("/api/v1/orders")
	orders.Use(appmw.JWTAuth(jwtSecret))
	orders.POST("/preview", h.forward)
	orders.POST("", h.forward)
	orders.GET("/summary", h.forward)
	orders.GET("", h.forward)
	orders.GET("/:id/events", h.forward)
	orders.GET("/:id", h.forward)
	orders.PUT("/:id/cancel", h.forward)

	legacyAdmin := orders.Group("/admin")
	legacyAdmin.Use(appmw.RequireRole(appmw.RoleAdmin, appmw.RoleStaff))
	legacyAdmin.GET("/report", h.forward)

	adminOrders := e.Group("/api/v1/admin/orders")
	adminOrders.Use(appmw.JWTAuth(jwtSecret))
	adminOrders.Use(appmw.RequireRole(appmw.RoleAdmin, appmw.RoleStaff))
	adminOrders.GET("/report", h.forward)
	adminOrders.GET("", h.forward)
	adminOrders.GET("/:id/events", h.forward)
	adminOrders.GET("/:id", h.forward)
	adminOrders.PUT("/:id/cancel", h.forward)
	adminOrders.PUT("/:id/status", h.forward)

	adminCoupons := e.Group("/api/v1/admin/coupons")
	adminCoupons.Use(appmw.JWTAuth(jwtSecret))
	adminCoupons.Use(appmw.RequireRole(appmw.RoleAdmin, appmw.RoleStaff))
	adminCoupons.POST("", h.forward)
	adminCoupons.GET("", h.forward)
}
