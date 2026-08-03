package handler

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
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
	cart.POST("/merge", h.MergeCart)
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

// MergeCart handles POST /api/v1/cart/merge
//
// Muc dich: hop nhat guest cart vao server-side cart cua user da dang nhap
// trong mot lan goi API duy nhat.
func (h *CartHandler) MergeCart(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	var req dto.MergeCartRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	cart, err := h.cartService.MergeCart(c.Request().Context(), claims.UserID, req)
	if err != nil {
		if errors.Is(err, service.ErrProductNotFound) {
			return response.Error(c, http.StatusNotFound, "product not found", err.Error())
		}
		if errors.Is(err, service.ErrProductUnavailable) {
			return response.Error(c, http.StatusBadRequest, "invalid product", err.Error())
		}
		if errors.Is(err, service.ErrVariantNotFound) {
			return response.Error(c, http.StatusNotFound, "variant not found", err.Error())
		}
		if errors.Is(err, service.ErrVariantRequired) {
			return response.Error(c, http.StatusBadRequest, "variant required", err.Error())
		}
		if errors.Is(err, service.ErrInsufficientStock) {
			return response.Error(c, http.StatusConflict, "insufficient stock", err.Error())
		}
		return response.Error(c, http.StatusInternalServerError, "error", err.Error())
	}

	return response.Success(c, http.StatusOK, "guest cart merged", cart)
}

// AddItem handles POST /api/v1/cart/items
//
// Mục đích: Thêm 1 sản phẩm vào giỏ hàng. Nếu sản phẩm đã có, tự động tăng số lượng.
// API này gọi gRPC sang Product Service để lấy thông tin giá mới nhất và check tồn kho (Stock).
func (h *CartHandler) AddItem(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	var req dto.AddToCartRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	cart, err := h.cartService.AddItem(c.Request().Context(), claims.UserID, req)
	if err != nil {
		if errors.Is(err, service.ErrProductNotFound) {
			return response.Error(c, http.StatusNotFound, "product not found", err.Error())
		}
		if errors.Is(err, service.ErrProductUnavailable) {
			return response.Error(c, http.StatusBadRequest, "invalid product", err.Error())
		}
		if errors.Is(err, service.ErrVariantNotFound) {
			return response.Error(c, http.StatusNotFound, "variant not found", err.Error())
		}
		if errors.Is(err, service.ErrVariantRequired) {
			return response.Error(c, http.StatusBadRequest, "variant required", err.Error())
		}
		if errors.Is(err, service.ErrInsufficientStock) {
			return response.Error(c, http.StatusConflict, "insufficient stock", err.Error())
		}
		return response.Error(c, http.StatusInternalServerError, "error", err.Error())
	}
	return response.Success(c, http.StatusOK, "item added to cart", cart)
}

// UpdateItem handles PUT /api/v1/cart/items/:productId
//
// SKU đi qua query param `?sku=` chứ không nằm trong path: một sản phẩm có
// nhiều variant là nhiều dòng giỏ hàng khác nhau, nhưng client cũ gọi không kèm
// sku vẫn trỏ đúng dòng của sản phẩm không có variant.
func (h *CartHandler) UpdateItem(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	productID := c.Param("productId")
	sku := c.QueryParam("sku")
	var req dto.UpdateCartItemRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	cart, err := h.cartService.UpdateItem(c.Request().Context(), claims.UserID, productID, sku, req)
	if err != nil {
		if errors.Is(err, service.ErrItemNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "item not in cart")
		}
		return response.Error(c, http.StatusInternalServerError, "error", err.Error())
	}
	return response.Success(c, http.StatusOK, "cart updated", cart)
}

// RemoveItem handles DELETE /api/v1/cart/items/:productId
//
// Giống UpdateItem, variant được chọn qua query param `?sku=`.
func (h *CartHandler) RemoveItem(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	productID := c.Param("productId")
	sku := c.QueryParam("sku")

	cart, err := h.cartService.RemoveItem(c.Request().Context(), claims.UserID, productID, sku)
	if err != nil {
		if errors.Is(err, service.ErrItemNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "item not in cart")
		}
		return response.Error(c, http.StatusInternalServerError, "error", err.Error())
	}
	return response.Success(c, http.StatusOK, "item removed", cart)
}

// ClearCart handles DELETE /api/v1/cart
//
// Mục đích: Xóa trắng toàn bộ giỏ hàng (thường được tự động gọi sau quá trình Checkout/Thanh toán thành công).
func (h *CartHandler) ClearCart(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if err := h.cartService.ClearCart(c.Request().Context(), claims.UserID); err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", err.Error())
	}
	return response.Success(c, http.StatusOK, "cart cleared", nil)
}
