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
	"time"

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
