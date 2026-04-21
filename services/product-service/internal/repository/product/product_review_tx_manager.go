package repository

import (
	"context"
	"database/sql"
	"fmt"
)

type ProductReviewTxRepositories struct {
	Reviews ProductReviewRepository
}

type ProductReviewTxManager interface {
	RunInTx(ctx context.Context, fn func(ProductReviewTxRepositories) error) error
}

type postgresProductReviewTxManager struct {
	db *sql.DB
}

func NewProductReviewTxManager(db *sql.DB) ProductReviewTxManager {
	return &postgresProductReviewTxManager{db: db}
}

func (m *postgresProductReviewTxManager) RunInTx(ctx context.Context, fn func(ProductReviewTxRepositories) error) error {
	tx, err := m.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin product review transaction: %w", err)
	}

	repos := ProductReviewTxRepositories{
		Reviews: newProductReviewRepositoryWithExecutor(tx),
	}

	if err := fn(repos); err != nil {
		if rollbackErr := tx.Rollback(); rollbackErr != nil {
			return fmt.Errorf("failed to rollback product review transaction after %v: %w", err, rollbackErr)
		}
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit product review transaction: %w", err)
	}

	return nil
}
