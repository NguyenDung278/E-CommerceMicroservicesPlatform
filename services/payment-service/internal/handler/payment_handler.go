package handler

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/service"
)

type PaymentHandler struct {
	paymentService *service.PaymentService
}

func NewPaymentHandler(paymentService *service.PaymentService) *PaymentHandler {
	return &PaymentHandler{paymentService: paymentService}
}

func (h *PaymentHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	payments := e.Group("/api/v1/payments")
	payments.Use(middleware.JWTAuth(jwtSecret))
	payments.POST("", h.ProcessPayment)
	payments.GET("/history", h.ListPaymentHistory)
	payments.GET("/:id", h.GetPayment)
	payments.GET("/order/:orderId", h.GetPaymentByOrder)
	payments.GET("/order/:orderId/history", h.ListPaymentsByOrder)

	adminPayments := e.Group("/api/v1/admin/payments")
	adminPayments.Use(middleware.JWTAuth(jwtSecret))
	adminPayments.Use(middleware.RequireRole(middleware.RoleAdmin, middleware.RoleStaff))
	adminPayments.GET("/order/:orderId/history", h.ListPaymentsByOrderAdmin)
	adminPayments.POST("/:id/refunds", h.RefundPayment)

	webhooks := e.Group("/api/v1/payments/webhooks")
	webhooks.POST("/momo", h.HandleMomoWebhook)
}

// ProcessPayment handles POST /api/v1/payments
//
// Mục đích: Tiếp nhận HTTP request thanh toán cho 1 Order cụ thể.
// Hiện tại đây chỉ là API giả lập (Mock). Trong thực tế, nó sẽ nhận Webhook từ Stripe/PayPal.
func (h *PaymentHandler) ProcessPayment(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	var req dto.ProcessPaymentRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	payment, err := h.paymentService.ProcessPayment(
		c.Request().Context(),
		claims.UserID,
		claims.Email,
		c.Request().Header.Get(echo.HeaderAuthorization),
		req,
	)
	if err != nil {
		if errors.Is(err, service.ErrOrderNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "order not found")
		}
		if errors.Is(err, service.ErrOrderNotPayable) {
			return response.Error(c, http.StatusBadRequest, "not payable", "order is not payable in its current status")
		}
		if errors.Is(err, service.ErrPaymentAlreadySettled) {
			return response.Error(c, http.StatusConflict, "already settled", "order is already fully paid")
		}
		if errors.Is(err, service.ErrInvalidPaymentAmount) {
			return response.Error(c, http.StatusBadRequest, "validation failed", "payment amount must be positive and not exceed the outstanding balance")
		}
		if errors.Is(err, service.ErrUnsupportedPaymentMethod) {
			return response.Error(c, http.StatusBadRequest, "validation failed", "payment method is not supported")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "payment processing failed")
	}
	return response.Success(c, http.StatusCreated, "payment processed", payment)
}

func (h *PaymentHandler) GetPayment(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	id := c.Param("id")
	payment, err := h.paymentService.GetPayment(c.Request().Context(), id, claims.UserID)
	if err != nil {
		if errors.Is(err, service.ErrPaymentNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "payment not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}
	return response.Success(c, http.StatusOK, "payment retrieved", payment)
}

func (h *PaymentHandler) GetPaymentByOrder(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	orderID := c.Param("orderId")
	payment, err := h.paymentService.GetPaymentByOrder(c.Request().Context(), orderID, claims.UserID)
	if err != nil {
		if errors.Is(err, service.ErrPaymentNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "payment not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}
	return response.Success(c, http.StatusOK, "payment retrieved", payment)
}

func (h *PaymentHandler) ListPaymentsByOrder(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	payments, err := h.paymentService.ListPaymentsByOrder(c.Request().Context(), c.Param("orderId"), claims.UserID)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}
	if payments == nil {
		payments = []*model.Payment{}
	}
	return response.Success(c, http.StatusOK, "payments retrieved", payments)
}

func (h *PaymentHandler) ListPaymentHistory(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	payments, err := h.paymentService.ListPaymentHistory(c.Request().Context(), claims.UserID)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}
	if payments == nil {
		payments = []*model.Payment{}
	}
	return response.Success(c, http.StatusOK, "payments retrieved", payments)
}

func (h *PaymentHandler) RefundPayment(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	var req dto.RefundPaymentRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	refund, err := h.paymentService.RefundPayment(c.Request().Context(), c.Param("id"), claims.UserID, claims.Role, claims.Email, req)
	if err != nil {
		if errors.Is(err, service.ErrPaymentNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "payment not found")
		}
		if errors.Is(err, service.ErrRefundNotAllowed) {
			return response.Error(c, http.StatusBadRequest, "refund not allowed", "this payment cannot be refunded")
		}
		if errors.Is(err, service.ErrRefundAmountExceeded) {
			return response.Error(c, http.StatusBadRequest, "refund exceeded", "refund amount exceeds refundable balance")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "refund failed")
	}

	return response.Success(c, http.StatusCreated, "refund processed", refund)
}

func (h *PaymentHandler) ListPaymentsByOrderAdmin(c echo.Context) error {
	payments, err := h.paymentService.ListPaymentsByOrderAdmin(c.Request().Context(), c.Param("orderId"))
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}
	if payments == nil {
		payments = []*model.Payment{}
	}

	return response.Success(c, http.StatusOK, "payments retrieved", payments)
}

func (h *PaymentHandler) HandleMomoWebhook(c echo.Context) error {
	var req dto.MomoWebhookRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request", err.Error())
	}

	payment, err := h.paymentService.HandleMomoWebhook(c.Request().Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrPaymentNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "payment not found")
		}
		if errors.Is(err, service.ErrInvalidWebhookSignature) {
			return response.Error(c, http.StatusUnauthorized, "signature invalid", "invalid webhook signature")
		}
		if errors.Is(err, service.ErrPaymentAmountMismatch) {
			return response.Error(c, http.StatusBadRequest, "amount mismatch", "payment amount does not match pending request")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "webhook processing failed")
	}

	return response.Success(c, http.StatusOK, "webhook processed", payment)
}
