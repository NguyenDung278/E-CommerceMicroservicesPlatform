package service

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository"
)

const (
	OAuthProviderGoogle  = "google"
	OAuthNonceCookieName = "ndshop_oauth_nonce"

	oauthStatePurpose       = "oauth_state"
	oauthLoginTicketPurpose = "oauth_login_ticket"
	oauthStateTTL           = 10 * time.Minute
	oauthLoginTicketTTL     = 2 * time.Minute
)

type OAuthIdentity struct {
	Provider       string
	ProviderUserID string
	Email          string
	FirstName      string
	LastName       string
	FullName       string
	EmailVerified  bool
}

type OAuthStartResult struct {
	AuthorizationURL string
	Nonce            string
}

type oauthStateClaims struct {
	Provider       string `json:"provider"`
	NonceHash      string `json:"nonce_hash"`
	Next           string `json:"next"`
	FrontendOrigin string `json:"frontend_origin"`
	RedirectURL    string `json:"redirect_url"`
	Purpose        string `json:"purpose"`
	jwt.RegisteredClaims
}

type oauthLoginTicketClaims struct {
	UserID  string `json:"user_id"`
	Next    string `json:"next"`
	Purpose string `json:"purpose"`
	jwt.RegisteredClaims
}

// BeginOAuth tạo state đã ký và URL điều hướng sang social provider.
func (s *UserService) BeginOAuth(provider, redirectTo, requestOrigin string) (*OAuthStartResult, error) {
	if s.oauthClient == nil {
		return nil, ErrOAuthProviderNotConfigured
	}

	normalizedProvider, err := normalizeOAuthProvider(provider)
	if err != nil {
		return nil, err
	}

	redirectURL, err := s.resolveOAuthCallbackURL(normalizedProvider, requestOrigin)
	if err != nil {
		return nil, err
	}

	rawNonce, nonceHash, expiresAt, err := issueTimeBoundToken(oauthStateTTL)
	if err != nil {
		return nil, err
	}

	stateToken, err := s.signOAuthState(oauthStateClaims{
		Provider:       normalizedProvider,
		NonceHash:      nonceHash,
		Next:           normalizeInternalRedirectPath(redirectTo),
		FrontendOrigin: s.resolveFrontendOrigin(requestOrigin),
		RedirectURL:    redirectURL,
		Purpose:        oauthStatePurpose,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	})
	if err != nil {
		return nil, err
	}

	authorizationURL, err := s.oauthClient.AuthorizationURL(normalizedProvider, stateToken, redirectURL)
	if err != nil {
		return nil, err
	}

	return &OAuthStartResult{
		AuthorizationURL: authorizationURL,
		Nonce:            rawNonce,
	}, nil
}

// CompleteOAuthCallback xác thực callback rồi đổi code lấy profile provider.
func (s *UserService) CompleteOAuthCallback(ctx context.Context, provider, code, rawState, cookieNonce string) (string, error) {
	if s.oauthClient == nil || s.oauthRepo == nil {
		return "", ErrOAuthProviderNotConfigured
	}

	normalizedProvider, err := normalizeOAuthProvider(provider)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(code) == "" {
		return "", ErrInvalidOAuthState
	}

	stateClaims, err := s.parseOAuthState(rawState)
	if err != nil {
		return "", err
	}
	if stateClaims.Provider != normalizedProvider {
		return "", ErrInvalidOAuthState
	}
	if hashToken(cookieNonce) != stateClaims.NonceHash {
		return "", ErrInvalidOAuthState
	}

	identity, err := s.oauthClient.ExchangeCode(ctx, normalizedProvider, strings.TrimSpace(code), stateClaims.RedirectURL)
	if err != nil {
		return "", err
	}

	user, err := s.resolveOAuthUser(ctx, identity)
	if err != nil {
		return "", err
	}

	ticket, err := s.signOAuthLoginTicket(oauthLoginTicketClaims{
		UserID:  user.ID,
		Next:    stateClaims.Next,
		Purpose: oauthLoginTicketPurpose,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(oauthLoginTicketTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	})
	if err != nil {
		return "", err
	}

	return s.buildOAuthCallbackURL(stateClaims.FrontendOrigin, map[string]string{
		"ticket": ticket,
		"next":   stateClaims.Next,
	}), nil
}

// ExchangeOAuthTicket đổi login ticket ngắn hạn sang token pair chuẩn của hệ thống.
func (s *UserService) ExchangeOAuthTicket(ctx context.Context, ticket string) (*dto.AuthResponse, error) {
	claims := &oauthLoginTicketClaims{}
	parsed, err := jwt.ParseWithClaims(strings.TrimSpace(ticket), claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidOAuthTicket
		}
		return []byte(s.jwtSecret), nil
	})
	if err != nil || !parsed.Valid || claims.Purpose != oauthLoginTicketPurpose || strings.TrimSpace(claims.UserID) == "" {
		return nil, ErrInvalidOAuthTicket
	}

	user, err := s.repo.GetByID(ctx, claims.UserID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}

	accessToken, refreshToken, err := s.generateTokenPair(user)
	if err != nil {
		return nil, err
	}

	return &dto.AuthResponse{
		Token:        accessToken,
		RefreshToken: refreshToken,
		User:         user,
	}, nil
}

func (s *UserService) BuildOAuthStartErrorRedirect(redirectTo, requestOrigin, errorCode, message string) string {
	return s.buildOAuthCallbackURL(s.resolveFrontendOrigin(requestOrigin), map[string]string{
		"error":   strings.TrimSpace(errorCode),
		"message": strings.TrimSpace(message),
		"next":    normalizeInternalRedirectPath(redirectTo),
	})
}

func (s *UserService) BuildOAuthErrorRedirect(rawState, errorCode, message string) string {
	stateClaims, err := s.parseOAuthState(rawState)
	if err != nil {
		return s.buildOAuthCallbackURL(s.resolveFrontendOrigin(""), map[string]string{
			"error":   strings.TrimSpace(errorCode),
			"message": strings.TrimSpace(message),
			"next":    "/login",
		})
	}

	return s.buildOAuthCallbackURL(stateClaims.FrontendOrigin, map[string]string{
		"error":   strings.TrimSpace(errorCode),
		"message": strings.TrimSpace(message),
		"next":    stateClaims.Next,
	})
}

func (s *UserService) resolveOAuthUser(ctx context.Context, identity *OAuthIdentity) (*model.User, error) {
	if identity == nil {
		return nil, ErrOAuthProviderNotConfigured
	}

	provider, err := normalizeOAuthProvider(identity.Provider)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(identity.ProviderUserID) == "" {
		return nil, ErrOAuthAccountConflict
	}

	existingAccount, err := s.oauthRepo.GetByProviderUserID(ctx, provider, strings.TrimSpace(identity.ProviderUserID))
	if err != nil {
		return nil, err
	}
	if existingAccount != nil {
		user, err := s.repo.GetByID(ctx, existingAccount.UserID)
		if err != nil {
			return nil, err
		}
		if user == nil {
			return nil, ErrUserNotFound
		}
		return user, nil
	}

	email := normalizeEmail(identity.Email)
	if email == "" {
		return nil, ErrOAuthEmailRequired
	}

	user, err := s.repo.GetByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if user == nil {
		user, err = newSocialUser(identity)
		if err != nil {
			return nil, err
		}
		if err := s.repo.Create(ctx, user); err != nil {
			// Cho phép retry nhẹ theo email nếu có race condition khi tạo user mới.
			existingByEmail, lookupErr := s.repo.GetByEmail(ctx, email)
			if lookupErr != nil {
				return nil, err
			}
			if existingByEmail == nil {
				return nil, err
			}
			user = existingByEmail
		}
	}

	userProviderAccount, err := s.oauthRepo.GetByUserIDAndProvider(ctx, user.ID, provider)
	if err != nil {
		return nil, err
	}
	if userProviderAccount != nil {
		if userProviderAccount.ProviderUserID != strings.TrimSpace(identity.ProviderUserID) {
			return nil, ErrOAuthAccountConflict
		}
		return user, nil
	}

	now := time.Now()
	account := &model.OAuthAccount{
		ID:             uuid.New().String(),
		UserID:         user.ID,
		Provider:       provider,
		ProviderUserID: strings.TrimSpace(identity.ProviderUserID),
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := s.oauthRepo.Create(ctx, account); err != nil {
		if errors.Is(err, repository.ErrOAuthAccountAlreadyExists) {
			existingByProvider, lookupErr := s.oauthRepo.GetByProviderUserID(ctx, provider, strings.TrimSpace(identity.ProviderUserID))
			if lookupErr != nil {
				return nil, lookupErr
			}
			if existingByProvider != nil {
				linkedUser, userErr := s.repo.GetByID(ctx, existingByProvider.UserID)
				if userErr != nil {
					return nil, userErr
				}
				if linkedUser != nil {
					return linkedUser, nil
				}
			}
			return nil, ErrOAuthAccountConflict
		}
		return nil, err
	}

	return user, nil
}

func newSocialUser(identity *OAuthIdentity) (*model.User, error) {
	firstName, lastName := splitOAuthName(identity.FirstName, identity.LastName, identity.FullName)
	passwordHash, err := generatePlaceholderPasswordHash()
	if err != nil {
		return nil, err
	}

	now := time.Now()
	return &model.User{
		ID:            uuid.New().String(),
		Email:         normalizeEmail(identity.Email),
		Password:      passwordHash,
		FirstName:     firstName,
		LastName:      lastName,
		Role:          middleware.RoleUser,
		EmailVerified: identity.EmailVerified,
		CreatedAt:     now,
		UpdatedAt:     now,
	}, nil
}

func generatePlaceholderPasswordHash() (string, error) {
	randomPassword, _, _, err := issueTimeBoundToken(24 * time.Hour)
	if err != nil {
		return "", err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(randomPassword), 12)
	if err != nil {
		return "", err
	}

	return string(hash), nil
}

func splitOAuthName(firstName, lastName, fullName string) (string, string) {
	firstName = strings.TrimSpace(firstName)
	lastName = strings.TrimSpace(lastName)
	fullName = strings.TrimSpace(fullName)

	if firstName != "" && lastName != "" {
		return firstName, lastName
	}
	if fullName != "" {
		parts := strings.Fields(fullName)
		if len(parts) >= 2 {
			return parts[0], strings.Join(parts[1:], " ")
		}
		if len(parts) == 1 {
			return parts[0], "User"
		}
	}
	if firstName == "" {
		firstName = "Social"
	}
	if lastName == "" {
		lastName = "User"
	}

	return firstName, lastName
}

func (s *UserService) signOAuthState(claims oauthStateClaims) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}

func (s *UserService) signOAuthLoginTicket(claims oauthLoginTicketClaims) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}

func (s *UserService) parseOAuthState(rawState string) (*oauthStateClaims, error) {
	claims := &oauthStateClaims{}
	parsed, err := jwt.ParseWithClaims(strings.TrimSpace(rawState), claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidOAuthState
		}
		return []byte(s.jwtSecret), nil
	})
	if err != nil || !parsed.Valid || claims.Purpose != oauthStatePurpose {
		return nil, ErrInvalidOAuthState
	}

	return claims, nil
}

func (s *UserService) resolveOAuthCallbackURL(provider, requestOrigin string) (string, error) {
	if s.oauthClient == nil {
		return "", ErrOAuthProviderNotConfigured
	}

	defaultRedirectURL, err := s.oauthClient.DefaultRedirectURL(provider)
	if err != nil {
		return "", err
	}

	parsedRedirect, err := url.Parse(strings.TrimSpace(defaultRedirectURL))
	if err != nil || parsedRedirect.Scheme == "" || parsedRedirect.Host == "" {
		return "", ErrOAuthProviderNotConfigured
	}

	requestOrigin = strings.TrimSpace(requestOrigin)
	if requestOrigin == "" {
		return parsedRedirect.String(), nil
	}

	parsedOrigin, err := url.Parse(requestOrigin)
	if err != nil || parsedOrigin.Scheme == "" || parsedOrigin.Host == "" {
		return parsedRedirect.String(), nil
	}

	if isLocalHostname(parsedOrigin.Hostname()) && isLocalHostname(parsedRedirect.Hostname()) {
		parsedRedirect.Scheme = parsedOrigin.Scheme
		parsedRedirect.Host = joinHostPort(parsedOrigin.Hostname(), parsedRedirect.Port())
	}

	return parsedRedirect.String(), nil
}

func (s *UserService) resolveFrontendOrigin(requestOrigin string) string {
	defaultOrigin := extractOrigin(s.frontendBaseURL)
	if defaultOrigin == "" {
		defaultOrigin = "http://localhost:4173"
	}

	requestOrigin = strings.TrimSpace(requestOrigin)
	if requestOrigin == "" {
		return defaultOrigin
	}

	parsedRequestOrigin, err := url.Parse(requestOrigin)
	if err != nil || parsedRequestOrigin.Scheme == "" || parsedRequestOrigin.Host == "" {
		return defaultOrigin
	}

	parsedDefaultOrigin, err := url.Parse(defaultOrigin)
	if err != nil || parsedDefaultOrigin.Scheme == "" || parsedDefaultOrigin.Host == "" {
		return defaultOrigin
	}

	if parsedRequestOrigin.Host == parsedDefaultOrigin.Host {
		return parsedRequestOrigin.Scheme + "://" + parsedRequestOrigin.Host
	}

	if isLocalHostname(parsedRequestOrigin.Hostname()) && isLocalHostname(parsedDefaultOrigin.Hostname()) {
		return parsedRequestOrigin.Scheme + "://" + parsedRequestOrigin.Host
	}

	return defaultOrigin
}

func (s *UserService) buildOAuthCallbackURL(frontendOrigin string, params map[string]string) string {
	origin := extractOrigin(frontendOrigin)
	if origin == "" {
		origin = s.resolveFrontendOrigin("")
	}

	encoded := url.Values{}
	for key, value := range params {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		encoded.Set(key, value)
	}

	if encoded.Get("next") == "" {
		encoded.Set("next", "/profile")
	}

	return fmt.Sprintf("%s/auth/callback#%s", strings.TrimRight(origin, "/"), encoded.Encode())
}

func normalizeOAuthProvider(provider string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case OAuthProviderGoogle:
		return OAuthProviderGoogle, nil
	default:
		return "", ErrInvalidOAuthProvider
	}
}

func normalizeInternalRedirectPath(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "/profile"
	}
	if !strings.HasPrefix(trimmed, "/") || strings.HasPrefix(trimmed, "//") {
		return "/profile"
	}

	return trimmed
}

func extractOrigin(rawURL string) string {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return ""
	}

	return parsed.Scheme + "://" + parsed.Host
}

func joinHostPort(hostname, port string) string {
	if strings.TrimSpace(port) == "" {
		return hostname
	}

	return hostname + ":" + port
}

func isLocalHostname(hostname string) bool {
	switch strings.ToLower(strings.TrimSpace(hostname)) {
	case "localhost", "127.0.0.1":
		return true
	default:
		return false
	}
}
