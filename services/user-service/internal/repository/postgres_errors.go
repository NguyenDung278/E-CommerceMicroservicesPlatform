package repository

import (
	"errors"

	"github.com/lib/pq"
)

// IsUndefinedTableError reports whether the wrapped PostgreSQL error indicates
// the referenced table is missing from the current schema.
func IsUndefinedTableError(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "42P01"
}
