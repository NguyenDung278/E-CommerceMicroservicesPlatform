package common

import (
	"errors"

	"github.com/lib/pq"
)

func IsUndefinedTableError(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "42P01"
}
