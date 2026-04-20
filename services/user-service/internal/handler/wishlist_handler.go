package handler

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service"
)

type WishlistHandler struct {
	wishlistService *service.WishlistService
}

func NewWishlistHandler(wishlistService *service.WishlistService) *WishlistHandler {
	return &WishlistHandler{wishlistService: wishlistService}
}

func (h *WishlistHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	wishlist := e.Group("/api/v1/users/wishlist")
	wishlist.Use(middleware.JWTAuth(jwtSecret))
	wishlist.GET("", h.List)
	wishlist.GET("/alerts", h.ListAlerts)
	wishlist.POST("", h.Add)
	wishlist.POST("/sync", h.Sync)
	wishlist.DELETE("/:productId", h.Remove)

	adminWishlist := e.Group("/api/v1/admin/wishlist-alerts")
	adminWishlist.Use(middleware.JWTAuth(jwtSecret))
	adminWishlist.Use(middleware.RequireRole(middleware.RoleAdmin, middleware.RoleStaff))
	adminWishlist.GET("", h.ListDispatchableAlerts)
}

func (h *WishlistHandler) List(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	items, err := h.wishlistService.ListWishlist(c.Request().Context(), claims.UserID)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "failed to list wishlist")
	}
	if items == nil {
		items = []*model.WishlistItem{}
	}

	return response.Success(c, http.StatusOK, "wishlist retrieved", items)
}

func (h *WishlistHandler) ListAlerts(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	alerts, err := h.wishlistService.ListAlerts(c.Request().Context(), claims.UserID)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "failed to list wishlist alerts")
	}
	if alerts == nil {
		alerts = []model.WishlistAlert{}
	}

	return response.Success(c, http.StatusOK, "wishlist alerts retrieved", alerts)
}

func (h *WishlistHandler) ListDispatchableAlerts(c echo.Context) error {
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	deliveries, err := h.wishlistService.ListDispatchableAlerts(c.Request().Context(), limit)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "failed to list dispatchable wishlist alerts")
	}
	if deliveries == nil {
		deliveries = []model.WishlistAlertDelivery{}
	}

	return response.Success(c, http.StatusOK, "dispatchable wishlist alerts retrieved", deliveries)
}

func (h *WishlistHandler) Add(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	var req dto.AddWishlistItemRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	item, err := h.wishlistService.AddToWishlist(c.Request().Context(), claims.UserID, req)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "failed to update wishlist")
	}

	return response.Success(c, http.StatusCreated, "wishlist item saved", item)
}

func (h *WishlistHandler) Sync(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	var req dto.SyncWishlistRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	items, err := h.wishlistService.SyncWishlist(c.Request().Context(), claims.UserID, req)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "failed to sync wishlist")
	}
	if items == nil {
		items = []*model.WishlistItem{}
	}

	return response.Success(c, http.StatusOK, "wishlist synced", items)
}

func (h *WishlistHandler) Remove(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	if err := h.wishlistService.RemoveFromWishlist(c.Request().Context(), claims.UserID, c.Param("productId")); err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "failed to remove wishlist item")
	}

	return response.Success(c, http.StatusOK, "wishlist item removed", nil)
}
