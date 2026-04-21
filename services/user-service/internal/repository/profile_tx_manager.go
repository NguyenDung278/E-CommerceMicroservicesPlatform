package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/addressrepo"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/authrepo"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository/userrepo"
)

type ProfileTxRepositories struct {
	Users              UserRepository
	Addresses          AddressRepository
	PhoneVerifications PhoneVerificationRepository
}

type ProfileTxManager interface {
	RunInTx(ctx context.Context, fn func(ProfileTxRepositories) error) error
}

type postgresProfileTxManager struct {
	db *sql.DB
}

func NewProfileTxManager(db *sql.DB) ProfileTxManager {
	return &postgresProfileTxManager{db: db}
}

func (m *postgresProfileTxManager) RunInTx(ctx context.Context, fn func(ProfileTxRepositories) error) error {
	tx, err := m.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin profile transaction: %w", err)
	}

	repos := ProfileTxRepositories{
		Users:              userrepo.NewWithExecutor(tx),
		Addresses:          addressrepo.NewWithExecutor(tx),
		PhoneVerifications: authrepo.NewPhoneVerificationWithExecutor(tx),
	}

	if err := fn(repos); err != nil {
		if rollbackErr := tx.Rollback(); rollbackErr != nil {
			return fmt.Errorf("failed to rollback profile transaction after %v: %w", err, rollbackErr)
		}
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit profile transaction: %w", err)
	}

	return nil
}
