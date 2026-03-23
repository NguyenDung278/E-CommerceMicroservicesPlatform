package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository"
)

const (
	defaultDevAdminPassword = "AdminTest!2026-ChangeMe"
	defaultDevStaffPassword = "StaffTest!2026-ChangeMe"
)

var developmentAccountSpecs = []developmentAccountSpec{
	{
		Email:     "admin.dev@ndshop.local",
		FirstName: "Development",
		LastName:  "Admin",
		Role:      middleware.RoleAdmin,
	},
	{
		Email:     "staff.dev@ndshop.local",
		FirstName: "Development",
		LastName:  "Staff",
		Role:      middleware.RoleStaff,
	},
}

type developmentAccountSpec struct {
	Email     string
	FirstName string
	LastName  string
	Role      string
}

// DevAccountBootstrapper seeds deterministic admin/staff accounts for local testing.
//
// The accounts are intentionally disabled by default in config and should only be
// enabled in development-like environments. The bootstrapper is idempotent: it
// creates missing users and reconciles the managed accounts on every startup.
type DevAccountBootstrapper struct {
	repo          repository.UserRepository
	log           *zap.Logger
	adminPassword string
	staffPassword string
}

func NewDevAccountBootstrapper(
	repo repository.UserRepository,
	log *zap.Logger,
	adminPassword string,
	staffPassword string,
) *DevAccountBootstrapper {
	if log == nil {
		log = zap.NewNop()
	}

	return &DevAccountBootstrapper{
		repo:          repo,
		log:           log,
		adminPassword: strings.TrimSpace(adminPassword),
		staffPassword: strings.TrimSpace(staffPassword),
	}
}

func (b *DevAccountBootstrapper) Ensure(ctx context.Context) error {
	b.log.Warn("development test accounts are enabled; disable bootstrap.dev_accounts in production")

	for _, spec := range developmentAccountSpecs {
		password := b.passwordForRole(spec.Role)
		if err := b.upsertAccount(ctx, spec, password); err != nil {
			return err
		}

		b.log.Info(
			"development test account ready",
			zap.String("email", spec.Email),
			zap.String("role", spec.Role),
		)
	}

	return nil
}

func (b *DevAccountBootstrapper) upsertAccount(
	ctx context.Context,
	spec developmentAccountSpec,
	password string,
) error {
	existing, err := b.repo.GetByEmail(ctx, normalizeEmail(spec.Email))
	if err != nil {
		return fmt.Errorf("failed to load development account %s: %w", spec.Email, err)
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return fmt.Errorf("failed to hash password for development account %s: %w", spec.Email, err)
	}

	now := time.Now()
	if existing == nil {
		user := &model.User{
			ID:            uuid.NewString(),
			Email:         normalizeEmail(spec.Email),
			Password:      string(hashedPassword),
			FirstName:     spec.FirstName,
			LastName:      spec.LastName,
			Role:          spec.Role,
			EmailVerified: true,
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		if err := b.repo.Create(ctx, user); err != nil {
			return fmt.Errorf("failed to create development account %s: %w", spec.Email, err)
		}
		return nil
	}

	existing.Email = normalizeEmail(spec.Email)
	existing.Password = string(hashedPassword)
	existing.FirstName = spec.FirstName
	existing.LastName = spec.LastName
	existing.Role = spec.Role
	existing.EmailVerified = true
	existing.EmailVerificationTokenHash = ""
	existing.EmailVerificationExpiresAt = nil
	existing.PasswordResetTokenHash = ""
	existing.PasswordResetExpiresAt = nil
	existing.UpdatedAt = now

	if err := b.repo.Update(ctx, existing); err != nil {
		return fmt.Errorf("failed to update development account %s: %w", spec.Email, err)
	}

	return nil
}

func (b *DevAccountBootstrapper) passwordForRole(role string) string {
	switch role {
	case middleware.RoleAdmin:
		return firstNonEmpty(b.adminPassword, defaultDevAdminPassword)
	case middleware.RoleStaff:
		return firstNonEmpty(b.staffPassword, defaultDevStaffPassword)
	default:
		return defaultDevStaffPassword
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}

	return ""
}
