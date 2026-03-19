// Package database provides helpers for connecting to PostgreSQL.
//
// WHY database/sql over an ORM:
//   - Full control over queries and performance
//   - No hidden N+1 query problems
//   - Easier to debug and profile
//   - Standard library interface — no vendor lock-in
//
// PITFALL: Always set connection pool limits. The default is unlimited,
// which can exhaust PostgreSQL's max_connections under load.
package database

import (
	"database/sql"
	"fmt"
	"io/fs"
	"time"

	"github.com/golang-migrate/migrate/v4"
	postgresmigrate "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "github.com/lib/pq" // PostgreSQL driver — blank import registers the driver

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
)

// NewPostgresDB creates a new PostgreSQL connection pool.
//
// CONNECTION POOL SETTINGS:
//   - MaxOpenConns: Limits total connections to prevent exhausting the DB.
//     Rule of thumb: (2 * CPU cores) + number of disks on the DB server.
//   - MaxIdleConns: Keeps connections warm for reuse (reduces latency).
//   - ConnMaxLifetime: Prevents stale connections behind load balancers.
func NewPostgresDB(cfg config.DatabaseConfig) (*sql.DB, error) {
	db, err := sql.Open("postgres", cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Configure connection pool.
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Verify the connection is alive.
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}

// RunPostgresMigrations applies embedded SQL migrations against PostgreSQL.
func RunPostgresMigrations(db *sql.DB, migrationFS fs.FS) error {
	driver, err := postgresmigrate.WithInstance(db, &postgresmigrate.Config{})
	if err != nil {
		return fmt.Errorf("failed to create postgres migration driver: %w", err)
	}

	sourceDriver, err := iofs.New(migrationFS, ".")
	if err != nil {
		return fmt.Errorf("failed to create migration source: %w", err)
	}

	migrator, err := migrate.NewWithInstance("iofs", sourceDriver, "postgres", driver)
	if err != nil {
		return fmt.Errorf("failed to create migrator: %w", err)
	}

	if err := migrator.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	return nil
}
