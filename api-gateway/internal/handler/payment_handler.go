package handler

import (
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/api-gateway/internal/proxy"
	appmw "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/labstack/echo/v4"
)

// PaymentHandler handles payment service requests
type PaymentHandler struct {
	forward echo.HandlerFunc
}

// NewPaymentHandler creates a new payment handler
func NewPaymentHandler(p *proxy.ServiceProxy) *PaymentHandler {
	return &PaymentHandler{
		forward: forwardWithProxy("payment service", p),
	}
}

// RegisterRoutes registers payment service routes.
func (h *PaymentHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	payments := e.Group("/api/v1/payments")
	payments.Use(appmw.JWTAuth(jwtSecret))
	payments.POST("", h.forward)
	payments.GET("/history", h.forward)
	payments.GET("/:id", h.forward)
	payments.GET("/order/:orderId", h.forward)
	payments.GET("/order/:orderId/history", h.forward)

	adminPayments := e.Group("/api/v1/admin/payments")
	adminPayments.Use(appmw.JWTAuth(jwtSecret))
	adminPayments.Use(appmw.RequireRole(appmw.RoleAdmin, appmw.RoleStaff))
	adminPayments.GET("/history", h.forward)
	adminPayments.GET("/order/:orderId/history", h.forward)
	adminPayments.POST("/:id/refunds", h.forward)

	// Webhook không gắn JWT: cổng thanh toán không có token của khách. Việc xác
	// thực do payment-service làm bằng chữ ký HMAC của từng cổng.
	webhooks := e.Group("/api/v1/payments/webhooks")
	webhooks.POST("/momo", h.forward)
	webhooks.POST("/vnpay", h.forward)
	webhooks.GET("/vnpay", h.forward)
}
