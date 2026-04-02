package service

import "time"

// telegramOTPConfigTTL returns the configured OTP message lifetime with a safe
// local default.
//
// Inputs:
//   - none; the receiver provides Telegram configuration.
//
// Returns:
//   - the OTP validity duration.
//
// Edge cases:
//   - zero or negative config values fall back to five minutes.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func (s *UserService) telegramOTPConfigTTL() time.Duration {
	seconds := s.telegramCfg.OTPMessageTTLSeconds
	if seconds <= 0 {
		seconds = 300
	}
	return time.Duration(seconds) * time.Second
}

// telegramOTPCooldown returns the resend cooldown with a safe local default.
//
// Inputs:
//   - none; the receiver provides Telegram configuration.
//
// Returns:
//   - the resend cooldown duration.
//
// Edge cases:
//   - zero or negative config values fall back to 60 seconds.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func (s *UserService) telegramOTPCooldown() time.Duration {
	seconds := s.telegramCfg.OTPResendCooldownSeconds
	if seconds <= 0 {
		seconds = 60
	}
	return time.Duration(seconds) * time.Second
}

// telegramOTPMaxAttempts returns the max OTP attempts with a safe local default.
//
// Inputs:
//   - none; the receiver provides Telegram configuration.
//
// Returns:
//   - the maximum number of OTP verification attempts.
//
// Edge cases:
//   - zero or negative config values fall back to 5 attempts.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func (s *UserService) telegramOTPMaxAttempts() int {
	if s.telegramCfg.OTPMaxAttempts <= 0 {
		return 5
	}
	return s.telegramCfg.OTPMaxAttempts
}

// allowOTPEvent applies an in-memory sliding-window rate limit for OTP-related
// events keyed by user, phone, or IP address.
//
// Inputs:
//   - key identifies the rate-limit bucket.
//   - limit is the maximum number of events allowed inside the window.
//   - window is the sliding-window duration.
//   - now is the current timestamp supplied by the caller for consistency.
//
// Returns:
//   - true when the event is allowed.
//   - false when the bucket is currently exhausted.
//
// Edge cases:
//   - non-positive limits disable the limiter for that bucket.
//   - expired entries are pruned on every call.
//
// Side effects:
//   - mutates the in-memory limiter state protected by a mutex.
//
// Performance:
//   - O(n) over the bucket's recent timestamps; pruning keeps the slices bounded to active windows.
func (s *UserService) allowOTPEvent(key string, limit int, window time.Duration, now time.Time) bool {
	if limit <= 0 {
		return true
	}

	s.otpLimiterMu.Lock()
	defer s.otpLimiterMu.Unlock()

	entries := s.otpLimiterState[key]
	cutoff := now.Add(-window)
	filtered := entries[:0]
	for _, ts := range entries {
		if ts.After(cutoff) {
			filtered = append(filtered, ts)
		}
	}
	if len(filtered) >= limit {
		s.otpLimiterState[key] = filtered
		return false
	}

	filtered = append(filtered, now)
	s.otpLimiterState[key] = filtered
	return true
}
