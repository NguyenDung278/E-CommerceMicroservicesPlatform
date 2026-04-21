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
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service"
)

func (h *UserHandler) StartEmailSignup(c echo.Context) error {
	var req dto.StartEmailSignupRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	result, err := h.userService.StartEmailSignup(c.Request().Context(), c.RealIP(), req)
	if err != nil {
		return handleEmailSignupError(c, err)
	}

	return response.Success(c, http.StatusOK, "email signup otp sent", result)
}

func (h *UserHandler) VerifyEmailSignupOTP(c echo.Context) error {
	var req dto.VerifyEmailOTPRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	result, err := h.userService.VerifyEmailSignupOTP(c.Request().Context(), req)
	if err != nil {
		return handleEmailSignupError(c, err)
	}

	return response.Success(c, http.StatusOK, "email signup verified", result)
}

func (h *UserHandler) ResendEmailSignupOTP(c echo.Context) error {
	var req dto.ResendEmailOTPRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	result, err := h.userService.ResendEmailSignupOTP(c.Request().Context(), c.RealIP(), req)
	if err != nil {
		return handleEmailSignupError(c, err)
	}

	return response.Success(c, http.StatusOK, "email signup otp resent", result)
}

func (h *UserHandler) GetEmailVerificationStatus(c echo.Context) error {
	claims, err := requireUserClaims(c)
	if err != nil {
		return err
	}

	statusPayload, err := h.userService.GetEmailVerificationStatus(c.Request().Context(), claims.UserID)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "failed to load email verification status")
	}

	return response.Success(c, http.StatusOK, "email verification status retrieved", statusPayload)
}

func (h *UserHandler) SendEmailVerificationOTP(c echo.Context) error {
	claims, err := requireUserClaims(c)
	if err != nil {
		return err
	}

	result, err := h.userService.StartEmailVerificationOTP(c.Request().Context(), claims.UserID, c.RealIP())
	if err != nil {
		return handleEmailOTPError(c, err)
	}

	return response.Success(c, http.StatusOK, "email verification otp sent", result)
}

func (h *UserHandler) VerifyEmailOTP(c echo.Context) error {
	claims, err := requireUserClaims(c)
	if err != nil {
		return err
	}

	var req dto.VerifyEmailOTPRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	result, err := h.userService.VerifyEmailOTP(c.Request().Context(), claims.UserID, req)
	if err != nil {
		return handleEmailOTPError(c, err)
	}

	return response.Success(c, http.StatusOK, "email verification successful", result)
}

func (h *UserHandler) ResendEmailVerificationOTP(c echo.Context) error {
	claims, err := requireUserClaims(c)
	if err != nil {
		return err
	}

	var req dto.ResendEmailOTPRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	result, err := h.userService.ResendEmailVerificationOTP(c.Request().Context(), claims.UserID, c.RealIP(), req)
	if err != nil {
		return handleEmailOTPError(c, err)
	}

	return response.Success(c, http.StatusOK, "email verification otp resent", result)
}

func handleEmailSignupError(c echo.Context, err error) error {
	if errors.Is(err, service.ErrPasswordConfirmationMismatch) {
		return response.Error(c, http.StatusBadRequest, "validation failed", "password confirmation does not match")
	}
	if errors.Is(err, service.ErrEmailAlreadyExists) {
		return response.Error(c, http.StatusConflict, "email signup failed", "email already exists")
	}

	return handleEmailOTPError(c, err)
}

func handleEmailOTPError(c echo.Context, err error) error {
	var emailVerificationErr *service.EmailVerificationError
	hasEmailVerificationError := errors.As(err, &emailVerificationErr)

	switch {
	case errors.Is(err, service.ErrEmailAlreadyExists):
		return response.Error(c, http.StatusConflict, "email verification failed", "email already exists")
	case errors.Is(err, service.ErrUserNotFound):
		return response.Error(c, http.StatusNotFound, "not found", "user not found")
	case errors.Is(err, service.ErrEmailVerificationNotFound):
		return response.Error(c, http.StatusBadRequest, "email verification failed", "email verification not found")
	case errors.Is(err, service.ErrEmailVerificationExpired):
		return response.Error(c, http.StatusBadRequest, "email verification failed", "email verification otp has expired")
	case errors.Is(err, service.ErrEmailVerificationInvalidOTP):
		detail := "invalid email verification otp"
		if hasEmailVerificationError && emailVerificationErr.RemainingAttempts > 0 {
			detail = fmt.Sprintf("invalid email verification otp, %d attempts remaining", emailVerificationErr.RemainingAttempts)
		}
		return response.Error(c, http.StatusBadRequest, "email verification failed", detail)
	case errors.Is(err, service.ErrEmailVerificationLocked):
		return response.Error(c, http.StatusTooManyRequests, "email verification locked", "too many invalid email verification attempts, challenge has been locked")
	case errors.Is(err, service.ErrEmailVerificationResendTooSoon):
		detail := "please wait before resending email verification otp"
		if hasEmailVerificationError && emailVerificationErr.ResendInSeconds > 0 {
			c.Response().Header().Set(echo.HeaderRetryAfter, strconv.FormatInt(emailVerificationErr.ResendInSeconds, 10))
			detail = fmt.Sprintf("please wait %d seconds before resending email verification otp", emailVerificationErr.ResendInSeconds)
		}
		return response.Error(c, http.StatusTooManyRequests, "email verification failed", detail)
	case errors.Is(err, service.ErrEmailVerificationRateLimited):
		return response.Error(c, http.StatusTooManyRequests, "email verification failed", "email verification otp rate limit exceeded")
	case errors.Is(err, service.ErrEmailVerificationAlreadyUsed):
		return response.Error(c, http.StatusBadRequest, "email verification failed", "email verification is invalid or already used")
	default:
		c.Logger().Errorf("email verification failed: %v", err)
		return response.Error(c, http.StatusInternalServerError, "email verification failed", "internal server error")
	}
}
