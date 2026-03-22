package handler

import (
	"strings"
	"sync"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
)

const (
	defaultMaxLoginFailures  = 5
	defaultLoginLockDuration = 15 * time.Minute
	defaultLoginAttemptTTL   = 24 * time.Hour
)

type loginAttemptState struct {
	failures      int
	lastFailureAt time.Time
	lockedUntil   time.Time
}

type LoginAttemptProtector struct {
	mu           sync.Mutex
	now          func() time.Time
	maxFailures  int
	lockDuration time.Duration
	stateTTL     time.Duration
	attempts     map[string]loginAttemptState
}

func NewLoginAttemptProtector(maxFailures int, lockDuration, stateTTL time.Duration) *LoginAttemptProtector {
	if maxFailures <= 0 {
		maxFailures = defaultMaxLoginFailures
	}
	if lockDuration <= 0 {
		lockDuration = defaultLoginLockDuration
	}
	if stateTTL <= 0 {
		stateTTL = defaultLoginAttemptTTL
	}

	return &LoginAttemptProtector{
		now:          time.Now,
		maxFailures:  maxFailures,
		lockDuration: lockDuration,
		stateTTL:     stateTTL,
		attempts:     make(map[string]loginAttemptState),
	}
}

func (p *LoginAttemptProtector) Check(keys ...string) (time.Duration, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()

	now := p.now()
	retryAfter := time.Duration(0)
	for _, key := range uniqueAttemptKeys(keys) {
		state, ok := p.stateForLockedKey(key, now)
		if !ok {
			continue
		}
		if remaining := state.lockedUntil.Sub(now); remaining > retryAfter {
			retryAfter = remaining
		}
	}

	return retryAfter, retryAfter > 0
}

func (p *LoginAttemptProtector) RecordFailure(keys ...string) (time.Duration, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()

	now := p.now()
	retryAfter := time.Duration(0)

	for _, key := range uniqueAttemptKeys(keys) {
		state, _ := p.stateForLockedKey(key, now)
		if state.lockedUntil.After(now) {
			if remaining := state.lockedUntil.Sub(now); remaining > retryAfter {
				retryAfter = remaining
			}
			continue
		}

		state.failures++
		state.lastFailureAt = now
		if state.failures >= p.maxFailures {
			state.lockedUntil = now.Add(p.lockDuration)
			if p.lockDuration > retryAfter {
				retryAfter = p.lockDuration
			}
		}

		p.attempts[key] = state
	}

	return retryAfter, retryAfter > 0
}

func (p *LoginAttemptProtector) RecordSuccess(keys ...string) {
	p.mu.Lock()
	defer p.mu.Unlock()

	for _, key := range uniqueAttemptKeys(keys) {
		delete(p.attempts, key)
	}
}

func (p *LoginAttemptProtector) stateForLockedKey(key string, now time.Time) (loginAttemptState, bool) {
	state, ok := p.attempts[key]
	if !ok {
		return loginAttemptState{}, false
	}

	if state.lockedUntil.After(now) {
		return state, true
	}

	if p.stateTTL > 0 && state.lastFailureAt.Add(p.stateTTL).Before(now) {
		delete(p.attempts, key)
		return loginAttemptState{}, false
	}

	if state.lockedUntil.IsZero() || !state.lockedUntil.After(now) {
		state.lockedUntil = time.Time{}
		p.attempts[key] = state
	}

	return state, true
}

func loginAttemptKeys(req dto.LoginRequest, ip string) []string {
	keys := []string{}
	if identifier := normalizeLoginIdentifier(req); identifier != "" {
		keys = append(keys, "identifier:"+identifier)
	}
	if trimmedIP := strings.TrimSpace(ip); trimmedIP != "" {
		keys = append(keys, "ip:"+trimmedIP)
	}
	return uniqueAttemptKeys(keys)
}

func normalizeLoginIdentifier(req dto.LoginRequest) string {
	if strings.TrimSpace(req.Identifier) != "" {
		identifier := strings.TrimSpace(req.Identifier)
		if strings.Contains(identifier, "@") {
			return normalizeLoginEmail(identifier)
		}
		return normalizeLoginPhone(identifier)
	}

	return normalizeLoginEmail(req.Email)
}

func normalizeLoginEmail(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func normalizeLoginPhone(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	var builder strings.Builder
	for index, r := range trimmed {
		if r >= '0' && r <= '9' {
			builder.WriteRune(r)
			continue
		}
		if r == '+' && index == 0 {
			builder.WriteRune(r)
		}
	}

	normalized := builder.String()
	if strings.HasPrefix(normalized, "+") {
		return "+" + strings.ReplaceAll(normalized[1:], "+", "")
	}

	return strings.ReplaceAll(normalized, "+", "")
}

func uniqueAttemptKeys(keys []string) []string {
	seen := make(map[string]struct{}, len(keys))
	unique := make([]string, 0, len(keys))

	for _, key := range keys {
		trimmed := strings.TrimSpace(key)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		unique = append(unique, trimmed)
	}

	return unique
}
