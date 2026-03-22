package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/url"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/email"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

func (s *UserService) VerifyEmail(ctx context.Context, token string) error {
	user, err := s.repo.GetByEmailVerificationTokenHash(ctx, hashToken(token))
	if err != nil {
		return err
	}
	if user == nil || user.EmailVerificationExpiresAt == nil || time.Now().After(*user.EmailVerificationExpiresAt) {
		return ErrInvalidToken
	}

	user.EmailVerified = true
	user.EmailVerificationTokenHash = ""
	user.EmailVerificationExpiresAt = nil
	user.UpdatedAt = time.Now()

	return s.repo.Update(ctx, user)
}

func (s *UserService) ResendVerificationEmail(ctx context.Context, userID string) error {
	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return err
	}
	if user == nil {
		return ErrUserNotFound
	}
	if user.EmailVerified {
		return nil
	}

	rawToken, tokenHash, expiresAt, err := issueTimeBoundToken(48 * time.Hour)
	if err != nil {
		return err
	}

	user.EmailVerificationTokenHash = tokenHash
	user.EmailVerificationExpiresAt = &expiresAt
	user.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, user); err != nil {
		return err
	}

	// Resend is best-effort so a transient SMTP failure does not block the API
	// response or leak delivery health to the client.
	_ = s.sendVerificationEmail(user, rawToken)
	return nil
}

func (s *UserService) ForgotPassword(ctx context.Context, emailAddress string) error {
	user, err := s.repo.GetByEmail(ctx, normalizeEmail(emailAddress))
	if err != nil {
		return err
	}
	if user == nil {
		return nil
	}

	rawToken, tokenHash, expiresAt, err := issueTimeBoundToken(2 * time.Hour)
	if err != nil {
		return err
	}

	user.PasswordResetTokenHash = tokenHash
	user.PasswordResetExpiresAt = &expiresAt
	user.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, user); err != nil {
		return err
	}

	// Forgot-password should stay success-shaped even when email delivery is down.
	_ = s.sendPasswordResetEmail(user, rawToken)
	return nil
}

func (s *UserService) ResetPassword(ctx context.Context, token, newPassword string) error {
	user, err := s.repo.GetByPasswordResetTokenHash(ctx, hashToken(token))
	if err != nil {
		return err
	}
	if user == nil || user.PasswordResetExpiresAt == nil || time.Now().After(*user.PasswordResetExpiresAt) {
		return ErrInvalidToken
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), 12)
	if err != nil {
		return err
	}

	user.Password = string(hashedPassword)
	user.PasswordResetTokenHash = ""
	user.PasswordResetExpiresAt = nil
	user.UpdatedAt = time.Now()

	return s.repo.Update(ctx, user)
}

func (s *UserService) ListUsers(ctx context.Context) ([]*model.User, error) {
	return s.repo.List(ctx)
}

func (s *UserService) UpdateUserRole(ctx context.Context, userID, role string) (*model.User, error) {
	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}

	normalizedRole := strings.ToLower(strings.TrimSpace(role))
	if !isSupportedRole(normalizedRole) {
		return nil, ErrInvalidRole
	}

	user.Role = normalizedRole
	user.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

func (s *UserService) sendVerificationEmail(user *model.User, token string) error {
	if s.emailSender == nil {
		return nil
	}

	link := s.buildFrontendLink("/verify-email", token)
	body := strings.Join([]string{
		fmt.Sprintf("Xin chao %s,", strings.TrimSpace(user.FirstName)),
		"",
		"Cam on ban da dang ky tai khoan tai ND Shop.",
		"Vui long xac minh email bang lien ket ben duoi:",
		link,
		"",
		"Lien ket nay co hieu luc trong 48 gio.",
	}, "\n")

	return s.emailSender.Send(email.Message{
		To:      []string{user.Email},
		Subject: "Xac minh email tai khoan ND Shop",
		Body:    body,
	})
}

func (s *UserService) sendPasswordResetEmail(user *model.User, token string) error {
	if s.emailSender == nil {
		return nil
	}

	link := s.buildFrontendLink("/reset-password", token)
	body := strings.Join([]string{
		fmt.Sprintf("Xin chao %s,", strings.TrimSpace(user.FirstName)),
		"",
		"He thong da nhan duoc yeu cau dat lai mat khau cho tai khoan cua ban.",
		"Ban co the dat lai mat khau tai lien ket sau:",
		link,
		"",
		"Lien ket nay co hieu luc trong 2 gio. Neu ban khong yeu cau, hay bo qua email nay.",
	}, "\n")

	return s.emailSender.Send(email.Message{
		To:      []string{user.Email},
		Subject: "Dat lai mat khau ND Shop",
		Body:    body,
	})
}

func (s *UserService) buildFrontendLink(path, token string) string {
	baseURL := strings.TrimRight(strings.TrimSpace(s.frontendBaseURL), "/")
	if baseURL == "" {
		baseURL = "http://localhost:4173"
	}

	return fmt.Sprintf("%s%s?token=%s", baseURL, path, url.QueryEscape(token))
}

func issueTimeBoundToken(ttl time.Duration) (rawToken string, tokenHash string, expiresAt time.Time, err error) {
	randomBytes := make([]byte, 32)
	if _, err = rand.Read(randomBytes); err != nil {
		return "", "", time.Time{}, err
	}

	rawToken = base64.RawURLEncoding.EncodeToString(randomBytes)
	tokenHash = hashToken(rawToken)
	expiresAt = time.Now().Add(ttl)
	return rawToken, tokenHash, expiresAt, nil
}

func hashToken(value string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(value)))
	return hex.EncodeToString(sum[:])
}

func isSupportedRole(role string) bool {
	switch role {
	case middleware.RoleUser, middleware.RoleStaff, middleware.RoleAdmin:
		return true
	default:
		return false
	}
}
