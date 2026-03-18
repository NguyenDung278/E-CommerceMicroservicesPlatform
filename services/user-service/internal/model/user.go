package model

import "time"

// User represents a user in the system.
// Using UUID as the primary key for:
//   - Global uniqueness across microservices (no collisions)
//   - Better distribution in distributed databases
//   - Not exposing sequential IDs (security best practice)
type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Password  string    `json:"-"` // Never serialize the password hash
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	Role      string    `json:"role"` // "user" or "admin"
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
