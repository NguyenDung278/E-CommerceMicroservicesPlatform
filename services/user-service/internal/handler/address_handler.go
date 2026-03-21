package handler

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service"
)

// AddressHandler handles HTTP requests for address operations.
type AddressHandler struct {
	addressService *service.AddressService
}

func NewAddressHandler(addressService *service.AddressService) *AddressHandler {
	return &AddressHandler{addressService: addressService}
}

// RegisterRoutes registers address-related routes.
//
// ROUTE DESIGN:
//   - POST   /api/v1/users/addresses            — Create address
//   - GET    /api/v1/users/addresses            — List addresses
//   - PUT    /api/v1/users/addresses/:id         — Update address
//   - DELETE /api/v1/users/addresses/:id         — Delete address
//   - PUT    /api/v1/users/addresses/:id/default — Set as default
func (h *AddressHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	addresses := e.Group("/api/v1/users/addresses")
	addresses.Use(middleware.JWTAuth(jwtSecret))
	addresses.POST("", h.Create)
	addresses.GET("", h.List)
	addresses.PUT("/:id", h.Update)
	addresses.DELETE("/:id", h.Delete)
	addresses.PUT("/:id/default", h.SetDefault)
}

func (h *AddressHandler) Create(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	var req dto.CreateAddressRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	addr, err := h.addressService.CreateAddress(c.Request().Context(), claims.UserID, req)
	if err != nil {
		if errors.Is(err, service.ErrTooManyAddresses) {
			return response.Error(c, http.StatusBadRequest, "limit reached", "maximum 10 addresses allowed")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "failed to create address")
	}

	return response.Success(c, http.StatusCreated, "address created", addr)
}

func (h *AddressHandler) List(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	addresses, err := h.addressService.GetAddresses(c.Request().Context(), claims.UserID)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "failed to list addresses")
	}

	return response.Success(c, http.StatusOK, "addresses retrieved", addresses)
}

func (h *AddressHandler) Update(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	id := c.Param("id")
	var req dto.UpdateAddressRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	addr, err := h.addressService.UpdateAddress(c.Request().Context(), claims.UserID, id, req)
	if err != nil {
		if errors.Is(err, service.ErrAddressNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "address not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "failed to update address")
	}

	return response.Success(c, http.StatusOK, "address updated", addr)
}

func (h *AddressHandler) Delete(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	id := c.Param("id")
	err := h.addressService.DeleteAddress(c.Request().Context(), claims.UserID, id)
	if err != nil {
		if errors.Is(err, service.ErrAddressNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "address not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "failed to delete address")
	}

	return response.Success(c, http.StatusOK, "address deleted", nil)
}

func (h *AddressHandler) SetDefault(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	id := c.Param("id")
	addr, err := h.addressService.SetDefault(c.Request().Context(), claims.UserID, id)
	if err != nil {
		if errors.Is(err, service.ErrAddressNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "address not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "failed to set default address")
	}

	return response.Success(c, http.StatusOK, "default address updated", addr)
}
