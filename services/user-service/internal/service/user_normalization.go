package service

import (
	"errors"
	"strings"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository"
)

// normalizeIdentifier resolves the login identifier using the modern identifier
// field first and the legacy email field as fallback.
//
// Inputs:
//   - req is the raw login request.
//
// Returns:
//   - the normalized email or phone identifier.
//
// Edge cases:
//   - blank identifiers normalize to an empty string so callers can reject them consistently.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the identifier length due to trimming and normalization.
func normalizeIdentifier(req dto.LoginRequest) string {
	if strings.TrimSpace(req.Identifier) != "" {
		identifier := strings.TrimSpace(req.Identifier)
		if isEmailIdentifier(identifier) {
			return normalizeEmail(identifier)
		}
		return normalizePhone(identifier)
	}

	return normalizeEmail(req.Email)
}

// isEmailIdentifier reports whether an identifier should be treated as an email.
//
// Inputs:
//   - value is the normalized identifier candidate.
//
// Returns:
//   - true when the identifier contains an `@`.
//
// Edge cases:
//   - simple containment is intentional to match current login semantics.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the identifier length.
func isEmailIdentifier(value string) bool {
	return strings.Contains(value, "@")
}

// normalizeEmail trims surrounding whitespace and lowercases the email.
//
// Inputs:
//   - value is the raw email string.
//
// Returns:
//   - the normalized email.
//
// Edge cases:
//   - blank values remain blank.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the email length.
func normalizeEmail(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

// normalizeHumanName trims and collapses internal whitespace in human-readable names.
//
// Inputs:
//   - value is the raw name string.
//
// Returns:
//   - the normalized name.
//
// Edge cases:
//   - blank names normalize to an empty string.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the input length due to tokenization and joining.
func normalizeHumanName(value string) string {
	parts := strings.Fields(strings.TrimSpace(value))
	return strings.Join(parts, " ")
}

// isValidHumanName validates a normalized human name against the configured
// maximum length.
//
// Inputs:
//   - value is the name to validate.
//   - maxLength is the inclusive maximum length.
//
// Returns:
//   - true when the normalized name is non-empty and within bounds.
//
// Edge cases:
//   - values are normalized again defensively so callers may pass raw strings.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) due to normalization.
func isValidHumanName(value string, maxLength int) bool {
	normalized := normalizeHumanName(value)
	return normalized != "" && len(normalized) <= maxLength
}

// normalizePhone extracts digits from a phone-like string and coerces supported
// Vietnam country-code forms into the local leading-zero format.
//
// Inputs:
//   - value is the raw phone string.
//
// Returns:
//   - the normalized phone number.
//
// Edge cases:
//   - blank values normalize to an empty string.
//   - `84xxxxxxxxx` and nine-digit local numbers are converted to the repository format.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the input length; the builder is pre-sized to reduce reallocations.
func normalizePhone(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	var digits strings.Builder
	digits.Grow(len(trimmed))
	for _, r := range trimmed {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}

	normalized := digits.String()
	if strings.HasPrefix(normalized, "84") && len(normalized) >= 11 {
		normalized = "0" + normalized[2:]
	}
	if len(normalized) == 9 {
		normalized = "0" + normalized
	}

	return normalized
}

// isValidVNPhone validates a phone number against the accepted normalized local
// Vietnam format.
//
// Inputs:
//   - value is the raw or normalized phone string.
//
// Returns:
//   - true when the normalized number matches the repository's accepted format.
//
// Edge cases:
//   - raw values are normalized before validation.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) due to normalization plus regex matching.
func isValidVNPhone(value string) bool {
	return vnPhoneRegex.MatchString(normalizePhone(value))
}

// normalizeTelegramChatID extracts digits from a Telegram chat id string.
//
// Inputs:
//   - value is the raw Telegram chat id string.
//
// Returns:
//   - the digit-only chat id.
//
// Edge cases:
//   - blank values normalize to an empty string.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the input length; the builder is pre-sized to reduce reallocations.
func normalizeTelegramChatID(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	var digits strings.Builder
	digits.Grow(len(trimmed))
	for _, r := range trimmed {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}

	return digits.String()
}

// mapUserRepositoryError translates repository-specific uniqueness errors into
// the domain errors exposed by handlers and higher-level flows.
//
// Inputs:
//   - err is the repository error to translate.
//
// Returns:
//   - the mapped domain error when recognized.
//   - the original error otherwise.
//
// Edge cases:
//   - wrapped repository errors are supported via errors.Is.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func mapUserRepositoryError(err error) error {
	switch {
	case errors.Is(err, repository.ErrUserEmailAlreadyExists):
		return ErrEmailAlreadyExists
	case errors.Is(err, repository.ErrUserPhoneAlreadyExists):
		return ErrPhoneAlreadyExists
	default:
		return err
	}
}

// currentTime exists to keep the time source easy to centralize and to avoid
// repeated direct calls scattered across related flows.
//
// Inputs:
//   - none.
//
// Returns:
//   - the current wall-clock time.
//
// Edge cases:
//   - none.
//
// Side effects:
//   - reads the system clock.
//
// Performance:
//   - O(1).
func currentTime() time.Time {
	return time.Now()
}
