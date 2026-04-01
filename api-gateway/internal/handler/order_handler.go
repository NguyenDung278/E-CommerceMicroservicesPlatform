package handler

import (
	"net/http"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/api-gateway/internal/proxy"
	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/labstack/echo/v4"
)

// OrderHandler handles order service requests.
type OrderHandler struct {
	proxy *proxy.ServiceProxy
}

func NewOrderHandler(p *proxy.ServiceProxy) *OrderHandler {
	return &OrderHandler{
		proxy: p,
	}
}

func (h *OrderHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	catalog := e.Group("/api/v1/catalog")
	catalog.GET("/popularity", h.forwardRequest)

	orders := e.Group("/api/v1/orders")
	orders.Use(appmw.JWTAuth(jwtSecret))
	orders.POST("/preview", h.forwardRequest)
	orders.POST("", h.forwardRequest)
	orders.GET("/summary", h.forwardRequest)
	orders.GET("", h.forwardRequest)
	orders.GET("/:id/events", h.forwardRequest)
	orders.GET("/:id", h.forwardRequest)

	legacyAdmin := orders.Group("/admin")
	legacyAdmin.Use(appmw.RequireRole(appmw.RoleAdmin, appmw.RoleStaff))
	legacyAdmin.GET("/report", h.forwardRequest)

	adminOrders := e.Group("/api/v1/admin/orders")
	adminOrders.Use(appmw.JWTAuth(jwtSecret))
	adminOrders.Use(appmw.RequireRole(appmw.RoleAdmin, appmw.RoleStaff))
	adminOrders.GET("/report", h.forwardRequest)
	adminOrders.GET("", h.forwardRequest)
	adminOrders.GET("/:id/events", h.forwardRequest)
	adminOrders.GET("/:id", h.forwardRequest)
	adminOrders.PUT("/:id/cancel", h.forwardRequest)
	adminOrders.PUT("/:id/status", h.forwardRequest)

	adminCoupons := e.Group("/api/v1/admin/coupons")
	adminCoupons.Use(appmw.JWTAuth(jwtSecret))
	adminCoupons.Use(appmw.RequireRole(appmw.RoleAdmin, appmw.RoleStaff))
	adminCoupons.POST("", h.forwardRequest)
	adminCoupons.GET("", h.forwardRequest)
}

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
