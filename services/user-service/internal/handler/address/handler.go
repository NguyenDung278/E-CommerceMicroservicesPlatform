package addresshandler

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service"
)

type AddressHandler struct {
	addressService *service.AddressService
}

func NewAddressHandler(addressService *service.AddressService) *AddressHandler {
	return &AddressHandler{addressService: addressService}
}

func (h *AddressHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	addresses := e.Group("/api/v1/users/addresses")
	addresses.Use(middleware.JWTAuth(jwtSecret))
	addresses.POST("", h.Create)
	addresses.GET("", h.List)
	addresses.PUT("/:id", h.Update)
	addresses.DELETE("/:id", h.Delete)
	addresses.PUT("/:id/default", h.SetDefault)
}

func requireUserClaims(c echo.Context) (*middleware.JWTClaims, error) {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return nil, response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	return claims, nil
}
