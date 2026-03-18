package handler

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
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

func (h *PaymentHandler) ProcessPayment(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	var req dto.ProcessPaymentRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request", err.Error())
	}
	if req.OrderID == "" || req.Amount <= 0 || req.PaymentMethod == "" {
		return response.Error(c, http.StatusBadRequest, "validation failed", "order_id, amount, and payment_method required")
	}

	payment, err := h.paymentService.ProcessPayment(c.Request().Context(), claims.UserID, req)
	if err != nil {
		if errors.Is(err, service.ErrDuplicatePayment) {
			return response.Error(c, http.StatusConflict, "duplicate", "payment already exists for this order")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "payment processing failed")
	}
	return response.Success(c, http.StatusCreated, "payment processed", payment)
}

func (h *PaymentHandler) GetPayment(c echo.Context) error {
	id := c.Param("id")
	payment, err := h.paymentService.GetPayment(c.Request().Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrPaymentNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "payment not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}
	return response.Success(c, http.StatusOK, "payment retrieved", payment)
}

func (h *PaymentHandler) GetPaymentByOrder(c echo.Context) error {
	orderID := c.Param("orderId")
	payment, err := h.paymentService.GetPaymentByOrder(c.Request().Context(), orderID)
	if err != nil {
		if errors.Is(err, service.ErrPaymentNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "payment not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}
	return response.Success(c, http.StatusOK, "payment retrieved", payment)
}
