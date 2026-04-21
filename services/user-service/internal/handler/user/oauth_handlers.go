package userhandler

import (
	"errors"
	"net/http"
	"net/url"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service"
)

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
		switch {
		case errors.Is(err, service.ErrInvalidOAuthTicket):
			return response.Error(c, http.StatusUnauthorized, "oauth exchange failed", "invalid or expired oauth login ticket")
		case errors.Is(err, service.ErrUserNotFound):
			return response.Error(c, http.StatusUnauthorized, "oauth exchange failed", "user no longer exists")
		default:
			c.Logger().Errorf("oauth ticket exchange failed: %v", err)
			return response.Error(c, http.StatusInternalServerError, "oauth exchange failed", "internal server error")
		}
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

	c.SetCookie(oauthNonceCookie(c, startResult.Nonce, int(oauthNonceLifetime().Seconds())))
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
		c.Logger().Errorf("oauth callback failed for provider=%s: %v", provider, err)
		return c.Redirect(http.StatusFound, h.userService.BuildOAuthErrorRedirect(
			rawState,
			oauthErrorCode(err),
			oauthErrorMessage(err),
		))
	}

	return c.Redirect(http.StatusFound, redirectURL)
}

func clearOAuthNonceCookie(c echo.Context) {
	c.SetCookie(oauthNonceCookie(c, "", -1))
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
