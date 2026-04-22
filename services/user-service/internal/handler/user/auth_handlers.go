package userhandler

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service/account"
)

func (h *UserHandler) Register(c echo.Context) error {
	var req dto.RegisterRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	result, err := h.userService.Register(c.Request().Context(), req)
	if err != nil {
		if errors.Is(err, account.ErrEmailAlreadyExists) {
			return response.Error(c, http.StatusConflict, "registration failed", "email already exists")
		}
		if errors.Is(err, account.ErrPhoneAlreadyExists) {
			return response.Error(c, http.StatusConflict, "registration failed", "phone already exists")
		}
		return response.Error(c, http.StatusInternalServerError, "registration failed", "internal server error")
	}

	if user, ok := result.User.(*model.User); ok && user != nil && user.Email != "" && !user.EmailVerified {
		if _, otpErr := h.userService.StartEmailVerificationOTP(c.Request().Context(), user.ID, c.RealIP()); otpErr != nil {
			c.Logger().Warnf("register email otp dispatch deferred for user=%s: %v", user.ID, otpErr)
		}
	}

	return response.Success(c, http.StatusCreated, "user registered successfully", result)
}

func (h *UserHandler) Login(c echo.Context) error {
	var req dto.LoginRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}
	if strings.TrimSpace(req.Identifier) == "" && strings.TrimSpace(req.Email) == "" {
		return response.Error(c, http.StatusBadRequest, "validation failed", "identifier is required")
	}

	attemptKeys := loginAttemptKeys(req, c.RealIP())
	if retryAfter, blocked := h.loginProtector.Check(attemptKeys...); blocked {
		appobs.IncEvent("user-service", "login_protection", appobs.OutcomeBusinessError)
		retryAfterSeconds := int(retryAfter.Seconds())
		c.Response().Header().Set(echo.HeaderRetryAfter, strconv.Itoa(retryAfterSeconds))
		return response.Error(
			c,
			http.StatusTooManyRequests,
			"login temporarily locked",
			fmt.Sprintf("too many failed login attempts, try again in %d seconds", retryAfterSeconds),
		)
	}

	result, err := h.userService.Login(c.Request().Context(), req)
	if err != nil {
		if errors.Is(err, account.ErrInvalidCredentials) {
			if retryAfter, blocked := h.loginProtector.RecordFailure(attemptKeys...); blocked {
				appobs.IncEvent("user-service", "login_protection", appobs.OutcomeBusinessError)
				retryAfterSeconds := int(retryAfter.Seconds())
				c.Response().Header().Set(echo.HeaderRetryAfter, strconv.Itoa(retryAfterSeconds))
				return response.Error(
					c,
					http.StatusTooManyRequests,
					"login temporarily locked",
					fmt.Sprintf("too many failed login attempts, try again in %d seconds", retryAfterSeconds),
				)
			}
			return response.Error(c, http.StatusUnauthorized, "login failed", "invalid email/phone or password")
		}
		return response.Error(c, http.StatusInternalServerError, "login failed", "internal server error")
	}

	h.loginProtector.RecordSuccess(attemptKeys...)
	return response.Success(c, http.StatusOK, "login successful", result)
}

func (h *UserHandler) RefreshToken(c echo.Context) error {
	var req dto.RefreshTokenRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	result, err := h.userService.RefreshToken(c.Request().Context(), req.RefreshToken)
	if err != nil {
		if errors.Is(err, account.ErrInvalidToken) {
			return response.Error(c, http.StatusUnauthorized, "refresh failed", "invalid or expired refresh token")
		}
		if errors.Is(err, account.ErrUserNotFound) {
			return response.Error(c, http.StatusUnauthorized, "refresh failed", "user no longer exists")
		}
		c.Logger().Errorf("refresh token failed: %v", err)
		return response.Error(c, http.StatusInternalServerError, "refresh failed", "internal server error")
	}

	return response.Success(c, http.StatusOK, "token refreshed", result)
}

func (h *UserHandler) VerifyEmail(c echo.Context) error {
	var req dto.VerifyEmailRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	if err := h.userService.VerifyEmail(c.Request().Context(), req.Token); err != nil {
		if errors.Is(err, account.ErrInvalidToken) {
			return response.Error(c, http.StatusUnauthorized, "verification failed", "invalid or expired verification token")
		}
		return response.Error(c, http.StatusInternalServerError, "verification failed", "internal server error")
	}

	return response.Success(c, http.StatusOK, "email verified successfully", nil)
}

func (h *UserHandler) ForgotPassword(c echo.Context) error {
	var req dto.ForgotPasswordRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	if err := h.userService.ForgotPassword(c.Request().Context(), req.Email); err != nil {
		return response.Error(c, http.StatusInternalServerError, "forgot password failed", "internal server error")
	}

	return response.Success(c, http.StatusOK, "password reset instructions queued", nil)
}

func (h *UserHandler) ResetPassword(c echo.Context) error {
	var req dto.ResetPasswordRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	if err := h.userService.ResetPassword(c.Request().Context(), req.Token, req.NewPassword); err != nil {
		if errors.Is(err, account.ErrInvalidToken) {
			return response.Error(c, http.StatusUnauthorized, "reset failed", "invalid or expired reset token")
		}
		return response.Error(c, http.StatusInternalServerError, "reset failed", "internal server error")
	}

	return response.Success(c, http.StatusOK, "password reset successfully", nil)
}

func (h *UserHandler) ChangePassword(c echo.Context) error {
	claims, err := requireUserClaims(c)
	if err != nil {
		return err
	}

	var req dto.ChangePasswordRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	err = h.userService.ChangePassword(c.Request().Context(), claims.UserID, req)
	if err != nil {
		if errors.Is(err, account.ErrInvalidCredentials) {
			return response.Error(c, http.StatusUnauthorized, "change password failed", "current password is incorrect")
		}
		if errors.Is(err, account.ErrUserNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "user not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}

	return response.Success(c, http.StatusOK, "password changed successfully", nil)
}

func (h *UserHandler) ResendVerificationEmail(c echo.Context) error {
	claims, err := requireUserClaims(c)
	if err != nil {
		return err
	}

	if err := h.userService.ResendVerificationEmail(c.Request().Context(), claims.UserID); err != nil {
		if errors.Is(err, account.ErrUserNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "user not found")
		}
		return response.Error(c, http.StatusInternalServerError, "resend verification failed", "internal server error")
	}

	return response.Success(c, http.StatusOK, "verification email sent", nil)
}

func (h *UserHandler) ListUsers(c echo.Context) error {
	users, err := h.userService.ListUsers(c.Request().Context())
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}

	return response.Success(c, http.StatusOK, "users retrieved", users)
}

func (h *UserHandler) UpdateUserRole(c echo.Context) error {
	var req dto.UpdateUserRoleRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	user, err := h.userService.UpdateUserRole(c.Request().Context(), c.Param("id"), req.Role)
	if err != nil {
		if errors.Is(err, account.ErrUserNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "user not found")
		}
		if errors.Is(err, account.ErrInvalidRole) {
			return response.Error(c, http.StatusBadRequest, "validation failed", "role must be user, staff or admin")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}

	return response.Success(c, http.StatusOK, "user role updated", user)
}
