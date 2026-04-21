package userhandler

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service"
)

const maxAvatarUploadSize = 5 << 20

type UserHandler struct {
	userService    *service.UserService
	loginProtector *LoginAttemptProtector
}

func NewUserHandler(userService *service.UserService) *UserHandler {
	return NewUserHandlerWithLoginProtector(
		userService,
		NewLoginAttemptProtector(defaultMaxLoginFailures, defaultLoginLockDuration, defaultLoginAttemptTTL),
	)
}

func NewUserHandlerWithLoginProtector(
	userService *service.UserService,
	loginProtector *LoginAttemptProtector,
) *UserHandler {
	if loginProtector == nil {
		loginProtector = NewLoginAttemptProtector(
			defaultMaxLoginFailures,
			defaultLoginLockDuration,
			defaultLoginAttemptTTL,
		)
	}

	return &UserHandler{
		userService:    userService,
		loginProtector: loginProtector,
	}
}

func (h *UserHandler) RegisterRoutes(e *echo.Echo, jwtSecret string) {
	auth := e.Group("/api/v1/auth")
	auth.POST("/register", h.Register)
	auth.POST("/register/email/send-otp", h.StartEmailSignup)
	auth.POST("/register/email/verify-otp", h.VerifyEmailSignupOTP)
	auth.POST("/register/email/resend-otp", h.ResendEmailSignupOTP)
	auth.POST("/register/phone/send-otp", h.StartPhoneSignup)
	auth.POST("/register/phone/verify-otp", h.VerifyPhoneSignupOTP)
	auth.POST("/register/phone/resend-otp", h.ResendPhoneSignupOTP)
	auth.POST("/login", h.Login)
	auth.POST("/refresh", h.RefreshToken)
	auth.POST("/verify-email", h.VerifyEmail)
	auth.POST("/forgot-password", h.ForgotPassword)
	auth.POST("/reset-password", h.ResetPassword)
	auth.GET("/oauth/google/start", h.StartGoogleOAuth)
	auth.GET("/oauth/google/callback", h.GoogleOAuthCallback)
	auth.POST("/oauth/exchange", h.ExchangeOAuthTicket)

	users := e.Group("/api/v1/users")
	users.Use(middleware.JWTAuth(jwtSecret))
	users.GET("/profile", h.GetProfile)
	users.PUT("/profile", h.UpdateProfile)
	users.POST("/avatar", h.UploadAvatar)
	users.GET("/profile/phone-verification", h.GetPhoneVerificationStatus)
	users.POST("/profile/phone-verification/send-otp", h.SendPhoneOTP)
	users.POST("/profile/phone-verification/verify-otp", h.VerifyPhoneOTP)
	users.POST("/profile/phone-verification/resend-otp", h.ResendPhoneOTP)
	users.GET("/verify-email/status", h.GetEmailVerificationStatus)
	users.POST("/verify-email/send-otp", h.SendEmailVerificationOTP)
	users.POST("/verify-email/verify-otp", h.VerifyEmailOTP)
	users.POST("/verify-email/resend-otp", h.ResendEmailVerificationOTP)
	users.PUT("/password", h.ChangePassword)
	users.POST("/verify-email/resend", h.ResendVerificationEmail)

	adminUsers := e.Group("/api/v1/admin/users")
	adminUsers.Use(middleware.JWTAuth(jwtSecret))
	adminUsers.Use(middleware.RequireRole(middleware.RoleAdmin))
	adminUsers.GET("", h.ListUsers)
	adminUsers.PUT("/:id/role", h.UpdateUserRole)
}

func requireUserClaims(c echo.Context) (*middleware.JWTClaims, error) {
	claims := middleware.GetUserClaims(c)
	if claims == nil {
		return nil, response.Error(c, http.StatusUnauthorized, "unauthorized", "missing user claims")
	}

	return claims, nil
}

func oauthNonceCookie(c echo.Context, value string, maxAge int) *http.Cookie {
	return &http.Cookie{
		Name:     service.OAuthNonceCookieName,
		Value:    value,
		Path:     "/api/v1/auth/oauth",
		HttpOnly: true,
		MaxAge:   maxAge,
		SameSite: http.SameSiteLaxMode,
		Secure:   c.IsTLS(),
	}
}

func oauthNonceLifetime() time.Duration {
	return 10 * time.Minute
}
