package handler

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/payment-service/internal/dto"
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
	payments.GET("/:id", h.GetPayment)
	payments.GET("/order/:orderId", h.GetPaymentByOrder)
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
		if errors.Is(err, service.ErrDuplicatePayment) {
			return response.Error(c, http.StatusConflict, "duplicate", "payment already exists for this order")
		}
		if errors.Is(err, service.ErrOrderNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "order not found")
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
