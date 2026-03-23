package service

import (
	"context"
	"testing"

	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

func TestDevAccountBootstrapperCreatesManagedAccounts(t *testing.T) {
	repo := newFakeUserRepo()
	bootstrapper := NewDevAccountBootstrapper(repo, zap.NewNop(), "", "")

	if err := bootstrapper.Ensure(context.Background()); err != nil {
		t.Fatalf("Ensure returned error: %v", err)
	}

	admin := repo.usersByEmail["admin.dev@ndshop.local"]
	if admin == nil {
		t.Fatal("expected admin development account to be created")
	}
	if admin.Role != middleware.RoleAdmin {
		t.Fatalf("expected admin role %q, got %q", middleware.RoleAdmin, admin.Role)
	}
	if !admin.EmailVerified {
		t.Fatal("expected admin development account to be pre-verified")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(defaultDevAdminPassword)); err != nil {
		t.Fatalf("expected admin default password hash to match built-in credential: %v", err)
	}

	staff := repo.usersByEmail["staff.dev@ndshop.local"]
	if staff == nil {
		t.Fatal("expected staff development account to be created")
	}
	if staff.Role != middleware.RoleStaff {
		t.Fatalf("expected staff role %q, got %q", middleware.RoleStaff, staff.Role)
	}
}

func TestDevAccountBootstrapperReconcilesExistingManagedAccounts(t *testing.T) {
	repo := newFakeUserRepo()
	existing := &model.User{
		ID:            "existing-admin-id",
		Email:         "admin.dev@ndshop.local",
		Password:      "stale-password-hash",
		FirstName:     "Old",
		LastName:      "Admin",
		Role:          middleware.RoleUser,
		EmailVerified: false,
	}
	if err := repo.Create(context.Background(), existing); err != nil {
		t.Fatalf("failed to seed existing user: %v", err)
	}

	bootstrapper := NewDevAccountBootstrapper(repo, zap.NewNop(), "Override-Admin!2026", "")
	if err := bootstrapper.Ensure(context.Background()); err != nil {
		t.Fatalf("Ensure returned error: %v", err)
	}

	admin := repo.usersByEmail["admin.dev@ndshop.local"]
	if admin == nil {
		t.Fatal("expected reconciled admin development account")
	}
	if admin.ID != "existing-admin-id" {
		t.Fatalf("expected bootstrapper to update the existing account in place, got %q", admin.ID)
	}
	if admin.Role != middleware.RoleAdmin {
		t.Fatalf("expected reconciled role %q, got %q", middleware.RoleAdmin, admin.Role)
	}
	if !admin.EmailVerified {
		t.Fatal("expected reconciled account to be marked verified")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte("Override-Admin!2026")); err != nil {
		t.Fatalf("expected admin password to use override value: %v", err)
	}
}
