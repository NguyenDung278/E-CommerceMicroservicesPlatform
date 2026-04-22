package userhandler

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service/account"
)

func (h *UserHandler) GetPhoneVerificationStatus(c echo.Context) error {
	claims, err := requireUserClaims(c)
	if err != nil {
		return err
	}

	statusPayload, err := h.userService.GetPhoneVerificationStatus(c.Request().Context(), claims.UserID)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "failed to load phone verification status")
	}

	return response.Success(c, http.StatusOK, "phone verification status retrieved", statusPayload)
}

func (h *UserHandler) StartPhoneSignup(c echo.Context) error {
	var req dto.StartPhoneSignupRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	result, err := h.userService.StartPhoneSignup(c.Request().Context(), c.RealIP(), req)
	if err != nil {
		return handlePhoneSignupError(c, err)
	}

	return response.Success(c, http.StatusOK, "phone signup otp sent", result)
}

func (h *UserHandler) VerifyPhoneSignupOTP(c echo.Context) error {
	var req dto.VerifyPhoneOTPRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	result, err := h.userService.VerifyPhoneSignupOTP(c.Request().Context(), req)
	if err != nil {
		return handlePhoneSignupError(c, err)
	}

	return response.Success(c, http.StatusOK, "phone signup verified", result)
}

func (h *UserHandler) ResendPhoneSignupOTP(c echo.Context) error {
	var req dto.ResendPhoneOTPRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	result, err := h.userService.ResendPhoneSignupOTP(c.Request().Context(), c.RealIP(), req)
	if err != nil {
		return handlePhoneSignupError(c, err)
	}

	return response.Success(c, http.StatusOK, "phone signup otp resent", result)
}

func (h *UserHandler) SendPhoneOTP(c echo.Context) error {
	claims, err := requireUserClaims(c)
	if err != nil {
		return err
	}

	var req dto.SendPhoneOTPRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	result, err := h.userService.StartPhoneVerification(c.Request().Context(), claims.UserID, c.RealIP(), req)
	if err != nil {
		return handlePhoneOTPError(c, err)
	}

	return response.Success(c, http.StatusOK, "phone verification otp sent", result)
}

func (h *UserHandler) VerifyPhoneOTP(c echo.Context) error {
	claims, err := requireUserClaims(c)
	if err != nil {
		return err
	}

	var req dto.VerifyPhoneOTPRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	result, err := h.userService.VerifyPhoneOTP(c.Request().Context(), claims.UserID, req)
	if err != nil {
		return handlePhoneOTPError(c, err)
	}

	return response.Success(c, http.StatusOK, "phone verification successful", result)
}

func (h *UserHandler) ResendPhoneOTP(c echo.Context) error {
	claims, err := requireUserClaims(c)
	if err != nil {
		return err
	}

	var req dto.ResendPhoneOTPRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	result, err := h.userService.ResendPhoneOTP(c.Request().Context(), claims.UserID, c.RealIP(), req)
	if err != nil {
		return handlePhoneOTPError(c, err)
	}

	return response.Success(c, http.StatusOK, "phone verification otp resent", result)
}

func handlePhoneSignupError(c echo.Context, err error) error {
	if errors.Is(err, account.ErrPasswordConfirmationMismatch) {
		return response.Error(c, http.StatusBadRequest, "validation failed", "password confirmation does not match")
	}

	return handlePhoneOTPError(c, err)
}

func handlePhoneOTPError(c echo.Context, err error) error {
	var phoneVerificationErr *account.PhoneVerificationError
	hasPhoneVerificationError := errors.As(err, &phoneVerificationErr)

	switch {
	case errors.Is(err, account.ErrUserNotFound):
		return response.Error(c, http.StatusNotFound, "not found", "user not found")
	case errors.Is(err, account.ErrInvalidPhoneNumber):
		return response.Error(c, http.StatusBadRequest, "validation failed", "invalid phone number")
	case errors.Is(err, account.ErrTelegramChatNotLinked):
		return response.Error(c, http.StatusBadRequest, "phone verification failed", "telegram chat not linked, open the bot and send /start before requesting otp")
	case errors.Is(err, account.ErrPhoneAlreadyExists):
		return response.Error(c, http.StatusConflict, "phone verification failed", "phone already exists")
	case errors.Is(err, account.ErrPhoneVerificationNotFound):
		return response.Error(c, http.StatusBadRequest, "phone verification failed", "phone verification not found")
	case errors.Is(err, account.ErrPhoneVerificationExpired):
		return response.Error(c, http.StatusBadRequest, "phone verification failed", "otp has expired")
	case errors.Is(err, account.ErrPhoneVerificationInvalidOTP):
		detail := "invalid otp code"
		if hasPhoneVerificationError && phoneVerificationErr.RemainingAttempts > 0 {
			detail = fmt.Sprintf("invalid otp code, %d attempts remaining", phoneVerificationErr.RemainingAttempts)
		}
		return response.Error(c, http.StatusBadRequest, "phone verification failed", detail)
	case errors.Is(err, account.ErrPhoneVerificationLocked):
		return response.Error(c, http.StatusTooManyRequests, "phone verification locked", "too many invalid otp attempts, challenge has been locked")
	case errors.Is(err, account.ErrPhoneVerificationResendTooSoon):
		detail := "please wait before resending otp"
		if hasPhoneVerificationError && phoneVerificationErr.ResendInSeconds > 0 {
			c.Response().Header().Set(echo.HeaderRetryAfter, strconv.FormatInt(phoneVerificationErr.ResendInSeconds, 10))
			detail = fmt.Sprintf("please wait %d seconds before resending otp", phoneVerificationErr.ResendInSeconds)
		}
		return response.Error(c, http.StatusTooManyRequests, "phone verification failed", detail)
	case errors.Is(err, account.ErrPhoneVerificationRateLimited):
		return response.Error(c, http.StatusTooManyRequests, "phone verification failed", "otp rate limit exceeded")
	case errors.Is(err, account.ErrPhoneVerificationAlreadyUsed):
		return response.Error(c, http.StatusBadRequest, "phone verification failed", "phone verification already used")
	default:
		return response.Error(c, http.StatusInternalServerError, "phone verification failed", "internal server error")
	}
}
