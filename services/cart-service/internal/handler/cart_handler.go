package handler

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/service"
)

type CartHandler struct {
	cartService *service.CartService
}

func NewCartHandler(cartService *service.CartService) *CartHandler {
	return &CartHandler{cartService: cartService}
}

// RegisterRoutes registers cart routes — all require authentication.
func (h *CartHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	cart := e.Group("/api/v1/cart")
	cart.Use(middleware.JWTAuth(jwtSecret))
	cart.GET("", h.GetCart)
	cart.POST("/items", h.AddItem)
	cart.PUT("/items/:productId", h.UpdateItem)
	cart.DELETE("/items/:productId", h.RemoveItem)
	cart.DELETE("", h.ClearCart)
}

func (h *CartHandler) GetCart(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	cart, err := h.cartService.GetCart(c.Request().Context(), claims.UserID)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", err.Error())
	}
	return response.Success(c, http.StatusOK, "cart retrieved", cart)
}

func (h *CartHandler) AddItem(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	var req dto.AddToCartRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request", err.Error())
	}
	if req.ProductID == "" || req.Quantity <= 0 {
		return response.Error(c, http.StatusBadRequest, "validation failed", "product_id and quantity > 0 required")
	}

	cart, err := h.cartService.AddItem(c.Request().Context(), claims.UserID, req)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", err.Error())
	}
	return response.Success(c, http.StatusOK, "item added to cart", cart)
}

func (h *CartHandler) UpdateItem(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	productID := c.Param("productId")
	var req dto.UpdateCartItemRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request", err.Error())
	}

	cart, err := h.cartService.UpdateItem(c.Request().Context(), claims.UserID, productID, req)
	if err != nil {
		if errors.Is(err, service.ErrItemNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "item not in cart")
		}
		return response.Error(c, http.StatusInternalServerError, "error", err.Error())
	}
	return response.Success(c, http.StatusOK, "cart updated", cart)
}

func (h *CartHandler) RemoveItem(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	productID := c.Param("productId")

	cart, err := h.cartService.RemoveItem(c.Request().Context(), claims.UserID, productID)
	if err != nil {
		if errors.Is(err, service.ErrItemNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "item not in cart")
		}
		return response.Error(c, http.StatusInternalServerError, "error", err.Error())
	}
	return response.Success(c, http.StatusOK, "item removed", cart)
}

func (h *CartHandler) ClearCart(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if err := h.cartService.ClearCart(c.Request().Context(), claims.UserID); err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", err.Error())
	}
	return response.Success(c, http.StatusOK, "cart cleared", nil)
}
