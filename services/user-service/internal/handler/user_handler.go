package handler

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service"
)

// UserHandler handles HTTP requests for user operations.
type UserHandler struct {
	userService    *service.UserService
	loginProtector *LoginAttemptProtector
}

// NewUserHandler creates a new user handler.
func NewUserHandler(userService *service.UserService) *UserHandler {
	return NewUserHandlerWithLoginProtector(userService, NewLoginAttemptProtector(defaultMaxLoginFailures, defaultLoginLockDuration, defaultLoginAttemptTTL))
}

func NewUserHandlerWithLoginProtector(userService *service.UserService, loginProtector *LoginAttemptProtector) *UserHandler {
	if loginProtector == nil {
		loginProtector = NewLoginAttemptProtector(defaultMaxLoginFailures, defaultLoginLockDuration, defaultLoginAttemptTTL)
	}

	return &UserHandler{
		userService:    userService,
		loginProtector: loginProtector,
	}
}

// RegisterRoutes registers all user-related routes on the Echo instance.
//
// ROUTE DESIGN:
//   - POST /api/v1/auth/register — Public (no auth required)
//   - POST /api/v1/auth/login    — Public
//   - POST /api/v1/auth/refresh  — Public (validated by refresh token itself)
//   - GET  /api/v1/users/profile — Protected (requires valid JWT)
//   - PUT  /api/v1/users/profile — Protected
//   - PUT  /api/v1/users/password — Protected
func (h *UserHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	// Public routes — no authentication required.
	auth := e.Group("/api/v1/auth")
	auth.POST("/register", h.Register)
	auth.POST("/login", h.Login)
	auth.POST("/refresh", h.RefreshToken)
	auth.POST("/verify-email", h.VerifyEmail)
	auth.POST("/forgot-password", h.ForgotPassword)
	auth.POST("/reset-password", h.ResetPassword)
	auth.GET("/oauth/google/start", h.StartGoogleOAuth)
	auth.GET("/oauth/google/callback", h.GoogleOAuthCallback)
	auth.POST("/oauth/exchange", h.ExchangeOAuthTicket)

	// Protected routes — require valid JWT token.
	users := e.Group("/api/v1/users")
	users.Use(middleware.JWTAuth(jwtSecret))
	users.GET("/profile", h.GetProfile)
	users.PUT("/profile", h.UpdateProfile)
	users.GET("/profile/phone-verification", h.GetPhoneVerificationStatus)
	users.POST("/profile/phone-verification/send-otp", h.SendPhoneOTP)
	users.POST("/profile/phone-verification/verify-otp", h.VerifyPhoneOTP)
	users.POST("/profile/phone-verification/resend-otp", h.ResendPhoneOTP)
	users.PUT("/password", h.ChangePassword)
	users.POST("/verify-email/resend", h.ResendVerificationEmail)

	adminUsers := e.Group("/api/v1/admin/users")
	adminUsers.Use(middleware.JWTAuth(jwtSecret))
	adminUsers.Use(middleware.RequireRole(middleware.RoleAdmin))
	adminUsers.GET("", h.ListUsers)
	adminUsers.PUT("/:id/role", h.UpdateUserRole)
}

// Register handles POST /api/v1/auth/register
//
// Mục đích: Tiếp nhận HTTP request đăng ký tài khoản mới từ User.
// Input: JSON body map vào struct `dto.RegisterRequest` (yêu cầu email, độ dài password >= 8).
// Output:
//   - 201 Created nếu thành công (kèm JSON chứa Access Token và Refresh Token).
//   - 400 Bad Request nếu JSON lỗi hặc Validation thất bại.
//   - 409 Conflict nếu Email/Phone đã tồn tại trong DB.
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
		if errors.Is(err, service.ErrEmailAlreadyExists) {
			return response.Error(c, http.StatusConflict, "registration failed", "email already exists")
		}
		if errors.Is(err, service.ErrPhoneAlreadyExists) {
			return response.Error(c, http.StatusConflict, "registration failed", "phone already exists")
		}
		return response.Error(c, http.StatusInternalServerError, "registration failed", "internal server error")
	}

	return response.Success(c, http.StatusCreated, "user registered successfully", result)
}

// Login handles POST /api/v1/auth/login
//
// Mục đích: Xác thực người dùng qua Email hoặc Phone và trả về thẻ Token (JWT).
// Input: JSON body `dto.LoginRequest` (gồm Identifier và Password).
// Output:
//   - 200 OK (kèm Token Pair) nếu đúng mật khẩu.
//   - 400 Bad Request nếu thiếu tham số.
//   - 401 Unauthorized nếu sại thông tin đăng nhập.
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
		return response.Error(c, http.StatusTooManyRequests, "login temporarily locked", fmt.Sprintf("too many failed login attempts, try again in %d seconds", retryAfterSeconds))
	}

	result, err := h.userService.Login(c.Request().Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidCredentials) {
			if retryAfter, blocked := h.loginProtector.RecordFailure(attemptKeys...); blocked {
				appobs.IncEvent("user-service", "login_protection", appobs.OutcomeBusinessError)
				retryAfterSeconds := int(retryAfter.Seconds())
				c.Response().Header().Set(echo.HeaderRetryAfter, strconv.Itoa(retryAfterSeconds))
				return response.Error(c, http.StatusTooManyRequests, "login temporarily locked", fmt.Sprintf("too many failed login attempts, try again in %d seconds", retryAfterSeconds))
			}
			return response.Error(c, http.StatusUnauthorized, "login failed", "invalid email/phone or password")
		}
		return response.Error(c, http.StatusInternalServerError, "login failed", "internal server error")
	}

	h.loginProtector.RecordSuccess(attemptKeys...)
	return response.Success(c, http.StatusOK, "login successful", result)
}

// RefreshToken handles POST /api/v1/auth/refresh
//
// Mục đích: Cấp lại một cặp Access/Refresh Token mới khi Access Token cũ đã hết hạn.
// Input: JSON body `dto.RefreshTokenRequest` chứa string `refresh_token`.
// Output:
//   - 200 OK (Kèm Token Pair mới).
//   - 401 Unauthorized nếu Refresh token gửi lên bị sai, giả mạo, hoặc User đã bị đổi thông tin.
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
		if errors.Is(err, service.ErrInvalidToken) {
			return response.Error(c, http.StatusUnauthorized, "refresh failed", "invalid or expired refresh token")
		}
		if errors.Is(err, service.ErrUserNotFound) {
			return response.Error(c, http.StatusUnauthorized, "refresh failed", "user no longer exists")
		}
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
		if errors.Is(err, service.ErrInvalidToken) {
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
		if errors.Is(err, service.ErrInvalidToken) {
			return response.Error(c, http.StatusUnauthorized, "reset failed", "invalid or expired reset token")
		}
		return response.Error(c, http.StatusInternalServerError, "reset failed", "internal server error")
	}

	return response.Success(c, http.StatusOK, "password reset successfully", nil)
}

// GetProfile handles GET /api/v1/users/profile
func (h *UserHandler) GetProfile(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	user, err := h.userService.GetProfile(c.Request().Context(), claims.UserID)
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "user not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}

	return response.Success(c, http.StatusOK, "profile retrieved", user)
}

// UpdateProfile handles PUT /api/v1/users/profile
func (h *UserHandler) UpdateProfile(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	var req dto.UpdateProfileRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	user, err := h.userService.UpdateProfile(c.Request().Context(), claims.UserID, req)
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "user not found")
		}
		if errors.Is(err, service.ErrInvalidPhoneNumber) {
			return response.Error(c, http.StatusBadRequest, "validation failed", "invalid phone number")
		}
		if errors.Is(err, service.ErrPhoneAlreadyExists) {
			return response.Error(c, http.StatusConflict, "profile update failed", "phone already exists")
		}
		if errors.Is(err, service.ErrPhoneVerificationRequired) {
			return response.Error(c, http.StatusBadRequest, "profile update failed", "phone verification required")
		}
		if errors.Is(err, service.ErrPhoneVerificationNotFound) || errors.Is(err, service.ErrPhoneVerificationAlreadyUsed) {
			return response.Error(c, http.StatusBadRequest, "profile update failed", "phone verification is invalid or already used")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}

	return response.Success(c, http.StatusOK, "profile updated", user)
}

func (h *UserHandler) GetPhoneVerificationStatus(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	statusPayload, err := h.userService.GetPhoneVerificationStatus(c.Request().Context(), claims.UserID)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "error", "failed to load phone verification status")
	}
	return response.Success(c, http.StatusOK, "phone verification status retrieved", statusPayload)
}

func (h *UserHandler) SendPhoneOTP(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
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
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
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
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
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

func handlePhoneOTPError(c echo.Context, err error) error {
	if errors.Is(err, service.ErrUserNotFound) {
		return response.Error(c, http.StatusNotFound, "not found", "user not found")
	}
	if errors.Is(err, service.ErrInvalidPhoneNumber) {
		return response.Error(c, http.StatusBadRequest, "validation failed", "invalid phone number")
	}
	if errors.Is(err, service.ErrInvalidTelegramChatID) {
		return response.Error(c, http.StatusBadRequest, "validation failed", "invalid telegram chat id")
	}
	if errors.Is(err, service.ErrPhoneAlreadyExists) {
		return response.Error(c, http.StatusConflict, "phone verification failed", "phone already exists")
	}
	if errors.Is(err, service.ErrPhoneVerificationNotFound) {
		return response.Error(c, http.StatusBadRequest, "phone verification failed", "phone verification not found")
	}
	if errors.Is(err, service.ErrPhoneVerificationExpired) {
		return response.Error(c, http.StatusBadRequest, "phone verification failed", "otp has expired")
	}
	if errors.Is(err, service.ErrPhoneVerificationInvalidOTP) {
		return response.Error(c, http.StatusBadRequest, "phone verification failed", "invalid otp code")
	}
	if errors.Is(err, service.ErrPhoneVerificationLocked) {
		return response.Error(c, http.StatusTooManyRequests, "phone verification locked", "too many invalid otp attempts")
	}
	if errors.Is(err, service.ErrPhoneVerificationResendTooSoon) {
		return response.Error(c, http.StatusTooManyRequests, "phone verification failed", "please wait before resending otp")
	}
	if errors.Is(err, service.ErrPhoneVerificationRateLimited) {
		return response.Error(c, http.StatusTooManyRequests, "phone verification failed", "otp rate limit exceeded")
	}
	if errors.Is(err, service.ErrPhoneVerificationAlreadyUsed) {
		return response.Error(c, http.StatusBadRequest, "phone verification failed", "phone verification already used")
	}

	return response.Error(c, http.StatusInternalServerError, "phone verification failed", "internal server error")
}

// ChangePassword handles PUT /api/v1/users/password
func (h *UserHandler) ChangePassword(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	var req dto.ChangePasswordRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	err := h.userService.ChangePassword(c.Request().Context(), claims.UserID, req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidCredentials) {
			return response.Error(c, http.StatusUnauthorized, "change password failed", "current password is incorrect")
		}
		if errors.Is(err, service.ErrUserNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "user not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}

	return response.Success(c, http.StatusOK, "password changed successfully", nil)
}

func (h *UserHandler) ResendVerificationEmail(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	if err := h.userService.ResendVerificationEmail(c.Request().Context(), claims.UserID); err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
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
		if errors.Is(err, service.ErrUserNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "user not found")
		}
		if errors.Is(err, service.ErrInvalidRole) {
			return response.Error(c, http.StatusBadRequest, "validation failed", "role must be user, staff or admin")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}

	return response.Success(c, http.StatusOK, "user role updated", user)
}

func (h *UserHandler) StartGoogleOAuth(c echo.Context) error {
	return h.startOAuth(c, service.OAuthProviderGoogle)
}

func (h *UserHandler) GoogleOAuthCallback(c echo.Context) error {
	return h.handleOAuthCallback(c, service.OAuthProviderGoogle)
}

func (h *UserHandler) ExchangeOAuthTicket(c echo.Context) error {
	var req dto.OAuthExchangeRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	result, err := h.userService.ExchangeOAuthTicket(c.Request().Context(), req.Ticket)
	if err != nil {
		if errors.Is(err, service.ErrInvalidOAuthTicket) {
			return response.Error(c, http.StatusUnauthorized, "oauth exchange failed", "invalid or expired oauth login ticket")
		}
		if errors.Is(err, service.ErrUserNotFound) {
			return response.Error(c, http.StatusUnauthorized, "oauth exchange failed", "user no longer exists")
		}
		return response.Error(c, http.StatusInternalServerError, "oauth exchange failed", "internal server error")
	}

	return response.Success(c, http.StatusOK, "oauth exchange successful", result)
}

func (h *UserHandler) startOAuth(c echo.Context, provider string) error {
	requestOrigin := extractFrontendRequestOrigin(c.Request())
	redirectTo := c.QueryParam("redirect_to")

	startResult, err := h.userService.BeginOAuth(provider, redirectTo, requestOrigin)
	if err != nil {
		return c.Redirect(http.StatusFound, h.userService.BuildOAuthStartErrorRedirect(
			redirectTo,
			requestOrigin,
			oauthErrorCode(err),
			oauthErrorMessage(err),
		))
	}

	c.SetCookie(&http.Cookie{
		Name:     service.OAuthNonceCookieName,
		Value:    startResult.Nonce,
		Path:     "/api/v1/auth/oauth",
		HttpOnly: true,
		MaxAge:   int((10 * time.Minute).Seconds()),
		SameSite: http.SameSiteLaxMode,
		Secure:   c.IsTLS(),
	})

	return c.Redirect(http.StatusFound, startResult.AuthorizationURL)
}

func (h *UserHandler) handleOAuthCallback(c echo.Context, provider string) error {
	rawState := c.QueryParam("state")
	clearOAuthNonceCookie(c)

	if providerError := strings.TrimSpace(c.QueryParam("error")); providerError != "" {
		return c.Redirect(http.StatusFound, h.userService.BuildOAuthErrorRedirect(
			rawState,
			"oauth_access_denied",
			describeOAuthProviderError(providerError, c.QueryParam("error_description")),
		))
	}

	nonceCookie, err := c.Cookie(service.OAuthNonceCookieName)
	if err != nil || strings.TrimSpace(nonceCookie.Value) == "" {
		return c.Redirect(http.StatusFound, h.userService.BuildOAuthErrorRedirect(
			rawState,
			"oauth_state_invalid",
			"Phiên đăng nhập mạng xã hội đã hết hạn. Vui lòng thử lại từ đầu.",
		))
	}

	redirectURL, err := h.userService.CompleteOAuthCallback(
		c.Request().Context(),
		provider,
		c.QueryParam("code"),
		rawState,
		nonceCookie.Value,
	)
	if err != nil {
		return c.Redirect(http.StatusFound, h.userService.BuildOAuthErrorRedirect(
			rawState,
			oauthErrorCode(err),
			oauthErrorMessage(err),
		))
	}

	return c.Redirect(http.StatusFound, redirectURL)
}

func clearOAuthNonceCookie(c echo.Context) {
	c.SetCookie(&http.Cookie{
		Name:     service.OAuthNonceCookieName,
		Value:    "",
		Path:     "/api/v1/auth/oauth",
		HttpOnly: true,
		MaxAge:   -1,
		SameSite: http.SameSiteLaxMode,
		Secure:   c.IsTLS(),
	})
}

func extractFrontendRequestOrigin(request *http.Request) string {
	if request == nil {
		return ""
	}

	if origin := strings.TrimSpace(request.Header.Get("Origin")); origin != "" {
		return origin
	}

	referer := strings.TrimSpace(request.Referer())
	if referer == "" {
		return ""
	}

	parsed, err := url.Parse(referer)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return ""
	}

	return parsed.Scheme + "://" + parsed.Host
}

func oauthErrorCode(err error) string {
	switch {
	case errors.Is(err, service.ErrInvalidOAuthProvider):
		return "oauth_provider_invalid"
	case errors.Is(err, service.ErrOAuthProviderNotConfigured):
		return "oauth_provider_unavailable"
	case errors.Is(err, service.ErrInvalidOAuthState):
		return "oauth_state_invalid"
	case errors.Is(err, service.ErrOAuthEmailRequired):
		return "oauth_email_required"
	case errors.Is(err, service.ErrInvalidOAuthTicket):
		return "oauth_ticket_invalid"
	case errors.Is(err, service.ErrOAuthAccountConflict):
		return "oauth_account_conflict"
	default:
		return "oauth_failed"
	}
}

func oauthErrorMessage(err error) string {
	switch {
	case errors.Is(err, service.ErrInvalidOAuthProvider):
		return "Nhà cung cấp đăng nhập không hợp lệ."
	case errors.Is(err, service.ErrOAuthProviderNotConfigured):
		return "Đăng nhập mạng xã hội chưa được cấu hình trên môi trường hiện tại."
	case errors.Is(err, service.ErrInvalidOAuthState):
		return "Phiên đăng nhập mạng xã hội không hợp lệ hoặc đã hết hạn."
	case errors.Is(err, service.ErrOAuthEmailRequired):
		return "Tài khoản mạng xã hội chưa cung cấp email. Hãy chọn tài khoản khác hoặc dùng email/password."
	case errors.Is(err, service.ErrInvalidOAuthTicket):
		return "Phiên đăng nhập mạng xã hội đã hết hạn. Vui lòng thử lại."
	case errors.Is(err, service.ErrOAuthAccountConflict):
		return "Không thể liên kết tài khoản mạng xã hội vì dữ liệu đang xung đột. Hãy đăng nhập bằng email/password trước."
	default:
		return "Không thể hoàn tất đăng nhập mạng xã hội. Vui lòng thử lại sau."
	}
}

func describeOAuthProviderError(providerError, description string) string {
	description = strings.TrimSpace(description)
	if providerError == "access_denied" {
		return "Bạn đã hủy quyền đăng nhập với nhà cung cấp mạng xã hội."
	}
	if description != "" {
		return description
	}

	return "Nhà cung cấp mạng xã hội từ chối yêu cầu đăng nhập."
}
