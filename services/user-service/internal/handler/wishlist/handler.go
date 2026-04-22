package wishlisthandler

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service/engagement"
)

type WishlistHandler struct {
	wishlistService *engagement.WishlistService
}

func NewWishlistHandler(wishlistService *engagement.WishlistService) *WishlistHandler {
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

func requireUserClaims(c echo.Context) (*middleware.JWTClaims, error) {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return nil, response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	return claims, nil
}
