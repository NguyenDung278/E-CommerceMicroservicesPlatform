package addresshandler

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service/account"
)

func (h *AddressHandler) Create(c echo.Context) error {
	claims, err := requireUserClaims(c)
	if err != nil {
		return err
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
		if errors.Is(err, account.ErrTooManyAddresses) {
			return response.Error(c, http.StatusBadRequest, "limit reached", "maximum 10 addresses allowed")
		}
		if errors.Is(err, account.ErrInvalidAddress) {
			return response.Error(c, http.StatusBadRequest, "validation failed", "invalid address")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "failed to create address")
	}

	return response.Success(c, http.StatusCreated, "address created", addr)
}

func (h *AddressHandler) List(c echo.Context) error {
	claims, err := requireUserClaims(c)
	if err != nil {
		return err
	}

	addresses, err := h.addressService.GetAddresses(c.Request().Context(), claims.UserID)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "failed to list addresses")
	}
	if addresses == nil {
		addresses = []*model.Address{}
	}

	return response.Success(c, http.StatusOK, "addresses retrieved", addresses)
}

func (h *AddressHandler) Update(c echo.Context) error {
	claims, err := requireUserClaims(c)
	if err != nil {
		return err
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
		if errors.Is(err, account.ErrAddressNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "address not found")
		}
		if errors.Is(err, account.ErrInvalidAddress) {
			return response.Error(c, http.StatusBadRequest, "validation failed", "invalid address")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "failed to update address")
	}

	return response.Success(c, http.StatusOK, "address updated", addr)
}

func (h *AddressHandler) Delete(c echo.Context) error {
	claims, err := requireUserClaims(c)
	if err != nil {
		return err
	}

	err = h.addressService.DeleteAddress(c.Request().Context(), claims.UserID, c.Param("id"))
	if err != nil {
		if errors.Is(err, account.ErrAddressNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "address not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "failed to delete address")
	}

	return response.Success(c, http.StatusOK, "address deleted", nil)
}

func (h *AddressHandler) SetDefault(c echo.Context) error {
	claims, err := requireUserClaims(c)
	if err != nil {
		return err
	}

	addr, err := h.addressService.SetDefault(c.Request().Context(), claims.UserID, c.Param("id"))
	if err != nil {
		if errors.Is(err, account.ErrAddressNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "address not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "failed to set default address")
	}

	return response.Success(c, http.StatusOK, "default address updated", addr)
}
