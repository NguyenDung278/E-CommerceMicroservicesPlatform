package handler

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/service"
)

type OrderHandler struct {
	orderService *service.OrderService
}

func NewOrderHandler(orderService *service.OrderService) *OrderHandler {
	return &OrderHandler{orderService: orderService}
}

func (h *OrderHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	orders := e.Group("/api/v1/orders")
	orders.Use(middleware.JWTAuth(jwtSecret))
	orders.POST("", h.CreateOrder)
	orders.GET("", h.GetUserOrders)
	orders.GET("/:id", h.GetOrder)
}

// CreateOrder handles POST /api/v1/orders (checkout).
func (h *OrderHandler) CreateOrder(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	var req dto.CreateOrderRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request", err.Error())
	}

	order, err := h.orderService.CreateOrder(c.Request().Context(), claims.UserID, req)
	if err != nil {
		if errors.Is(err, service.ErrEmptyOrder) {
			return response.Error(c, http.StatusBadRequest, "validation failed", err.Error())
		}
		return response.Error(c, http.StatusInternalServerError, "error", "failed to create order")
	}
	return response.Success(c, http.StatusCreated, "order created", order)
}

func (h *OrderHandler) GetOrder(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	id := c.Param("id")

	order, err := h.orderService.GetOrder(c.Request().Context(), id, claims.UserID)
	if err != nil {
		if errors.Is(err, service.ErrOrderNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "order not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}
	return response.Success(c, http.StatusOK, "order retrieved", order)
}

func (h *OrderHandler) GetUserOrders(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	orders, err := h.orderService.GetUserOrders(c.Request().Context(), claims.UserID)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}
	return response.Success(c, http.StatusOK, "orders retrieved", orders)
}
