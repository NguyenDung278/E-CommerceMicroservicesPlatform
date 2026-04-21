package accountservice

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
	Provider             string
	ProviderUserID       string
	Email                string
	FirstName            string
	LastName             string
	FullName             string
	EmailVerified        bool
	AccessToken          string
	RefreshToken         string
	TokenType            string
	Scope                string
	IDToken              string
	AccessTokenExpiresAt *time.Time
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

	return s.buildAuthResponse(ctx, user)
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
		if err := s.syncOAuthAccount(ctx, existingAccount, identity); err != nil {
			return nil, err
		}

		user, err := s.repo.GetByID(ctx, existingAccount.UserID)
		if err != nil {
			return nil, err
		}
		if user == nil {
			return nil, ErrUserNotFound
		}
		if err := s.syncOAuthUserNameFromProfile(ctx, user, identity); err != nil {
			return nil, err
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
	if err := s.syncOAuthUserNameFromProfile(ctx, user, identity); err != nil {
		return nil, err
	}

	userProviderAccount, err := s.oauthRepo.GetByUserIDAndProvider(ctx, user.ID, provider)
	if err != nil {
		return nil, err
	}
	if userProviderAccount != nil {
		if userProviderAccount.ProviderUserID != strings.TrimSpace(identity.ProviderUserID) {
			return nil, ErrOAuthAccountConflict
		}
		if err := s.syncOAuthAccount(ctx, userProviderAccount, identity); err != nil {
			return nil, err
		}
		return user, nil
	}

	account := newOAuthAccountLink(user.ID, provider, identity)

	if err := s.oauthRepo.Create(ctx, account); err != nil {
		if errors.Is(err, repository.ErrOAuthAccountAlreadyExists) {
			existingByProvider, lookupErr := s.oauthRepo.GetByProviderUserID(ctx, provider, strings.TrimSpace(identity.ProviderUserID))
			if lookupErr != nil {
				return nil, lookupErr
			}
			if existingByProvider != nil {
				if syncErr := s.syncOAuthAccount(ctx, existingByProvider, identity); syncErr != nil {
					return nil, syncErr
				}

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

func newOAuthAccountLink(userID, provider string, identity *OAuthIdentity) *model.OAuthAccount {
	now := currentTime()
	account := &model.OAuthAccount{
		ID:             uuid.New().String(),
		UserID:         userID,
		Provider:       provider,
		ProviderUserID: strings.TrimSpace(identity.ProviderUserID),
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	applyOAuthIdentity(account, identity)
	return account
}

func applyOAuthIdentity(account *model.OAuthAccount, identity *OAuthIdentity) {
	if account == nil || identity == nil {
		return
	}

	if providerEmail := normalizeEmail(identity.Email); providerEmail != "" {
		account.ProviderEmail = providerEmail
	}
	account.ProviderUserID = strings.TrimSpace(identity.ProviderUserID)

	if accessToken := strings.TrimSpace(identity.AccessToken); accessToken != "" {
		account.AccessToken = accessToken
	}
	if refreshToken := strings.TrimSpace(identity.RefreshToken); refreshToken != "" {
		account.RefreshToken = refreshToken
	}

	if tokenType := strings.TrimSpace(identity.TokenType); tokenType != "" {
		account.TokenType = tokenType
	}
	if scope := strings.TrimSpace(identity.Scope); scope != "" {
		account.Scope = scope
	}
	if idToken := strings.TrimSpace(identity.IDToken); idToken != "" {
		account.IDToken = idToken
	}

	if identity.AccessTokenExpiresAt != nil {
		expiresAt := identity.AccessTokenExpiresAt.UTC()
		account.AccessTokenExpiresAt = &expiresAt
	} else if strings.TrimSpace(identity.AccessToken) != "" {
		account.AccessTokenExpiresAt = nil
	}
}

func (s *UserService) syncOAuthAccount(ctx context.Context, account *model.OAuthAccount, identity *OAuthIdentity) error {
	if account == nil {
		return ErrOAuthAccountConflict
	}

	applyOAuthIdentity(account, identity)
	account.UpdatedAt = currentTime()

	return s.oauthRepo.Update(ctx, account)
}

func newSocialUser(identity *OAuthIdentity) (*model.User, error) {
	firstName, lastName := splitOAuthName(identity.FirstName, identity.LastName, identity.FullName)
	passwordHash, err := generatePlaceholderPasswordHash()
	if err != nil {
		return nil, err
	}

	now := currentTime()
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

func (s *UserService) syncOAuthUserNameFromProfile(ctx context.Context, user *model.User, identity *OAuthIdentity) error {
	if user == nil || identity == nil {
		return nil
	}

	firstName, lastName := splitOAuthName(identity.FirstName, identity.LastName, identity.FullName)
	if firstName == "" && lastName == "" {
		return nil
	}

	changed := false
	if strings.TrimSpace(user.FirstName) == "" && firstName != "" {
		user.FirstName = firstName
		changed = true
	}
	if strings.TrimSpace(user.LastName) == "" && lastName != "" {
		user.LastName = lastName
		changed = true
	}
	if !changed {
		return nil
	}

	user.UpdatedAt = currentTime()
	return s.repo.Update(ctx, user)
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
			return parts[0], ""
		}
	}
	if firstName != "" || lastName != "" {
		return firstName, lastName
	}

	return "", ""
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

	return parsedRedirect.String(), nil
}

func (s *UserService) resolveFrontendOrigin(requestOrigin string) string {
	defaultOrigin := extractOrigin(s.frontendBaseURL)
	if defaultOrigin == "" {
		defaultOrigin = "http://localhost:5174"
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
