package account

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/email"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

type EmailVerificationError struct {
	cause             error
	RemainingAttempts int
	ResendInSeconds   int64
}

func (e *EmailVerificationError) Error() string {
	return e.cause.Error()
}

func (e *EmailVerificationError) Unwrap() error {
	return e.cause
}

func newEmailVerificationError(cause error, remainingAttempts int, resendInSeconds int64) error {
	return &EmailVerificationError{
		cause:             cause,
		RemainingAttempts: remainingAttempts,
		ResendInSeconds:   resendInSeconds,
	}
}

func (s *UserService) StartEmailVerificationOTP(ctx context.Context, userID string, ipAddress string) (*dto.EmailVerificationStatusResponse, error) {
	if s.emailVerificationRepo == nil {
		return nil, fmt.Errorf("email verification repository is not configured")
	}

	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}
	if user.EmailVerified {
		return nil, nil
	}

	normalizedEmail := normalizeEmail(user.Email)
	if normalizedEmail == "" {
		return nil, fmt.Errorf("user email is empty")
	}

	now := time.Now()
	_ = s.emailVerificationRepo.DeleteExpired(ctx)
	challenge, err := s.emailVerificationRepo.GetLatestActiveByUserID(ctx, userID, model.EmailVerificationPurposeSignUp)
	if err != nil {
		return nil, err
	}

	otpCode, err := generateOTPCode()
	if err != nil {
		return nil, err
	}
	otpHash := s.hashEmailOTPCode(normalizedEmail, otpCode)

	if challenge != nil {
		if challenge.Status == model.EmailVerificationStatusPending && challenge.Email == normalizedEmail && now.Before(challenge.ResendAvailableAt) {
			return buildEmailVerificationStatusResponse(challenge, now), nil
		}
		if challenge.Status == model.EmailVerificationStatusPending {
			challenge.Status = model.EmailVerificationStatusExpired
			challenge.UpdatedAt = now
			if err := s.emailVerificationRepo.Update(ctx, challenge); err != nil {
				return nil, err
			}
			challenge = nil
		}
	}

	if !s.allowOTPEvent("email-otp:user:"+userID, s.emailVerificationDailyLimitPerUser(), 24*time.Hour, now) {
		return nil, ErrEmailVerificationRateLimited
	}
	if !s.allowOTPEvent("email-otp:email:"+normalizedEmail, s.emailVerificationDailyLimitPerUser(), 24*time.Hour, now) {
		return nil, ErrEmailVerificationRateLimited
	}
	if !s.allowOTPEvent("email-otp:ip:"+strings.TrimSpace(ipAddress), s.emailVerificationHourlyLimitPerIP(), time.Hour, now) {
		return nil, ErrEmailVerificationRateLimited
	}

	if challenge == nil {
		challenge = &model.EmailVerificationChallenge{
			ID:                uuid.New().String(),
			UserID:            userID,
			Purpose:           model.EmailVerificationPurposeSignUp,
			Email:             normalizedEmail,
			OTPHash:           otpHash,
			ExpiresAt:         now.Add(s.emailVerificationOTPConfigTTL()),
			ResendAvailableAt: now.Add(s.emailVerificationOTPCooldown()),
			LastSentAt:        now,
			AttemptCount:      0,
			MaxAttempts:       s.emailVerificationOTPMaxAttempts(),
			Status:            model.EmailVerificationStatusPending,
			CreatedAt:         now,
			UpdatedAt:         now,
		}
		if err := s.emailVerificationRepo.Create(ctx, challenge); err != nil {
			return nil, err
		}
	} else {
		challenge.Email = normalizedEmail
		challenge.OTPHash = otpHash
		challenge.ExpiresAt = now.Add(s.emailVerificationOTPConfigTTL())
		challenge.ResendAvailableAt = now.Add(s.emailVerificationOTPCooldown())
		challenge.LastSentAt = now
		challenge.AttemptCount = 0
		challenge.MaxAttempts = s.emailVerificationOTPMaxAttempts()
		challenge.Status = model.EmailVerificationStatusPending
		challenge.VerifiedAt = nil
		challenge.ConsumedAt = nil
		challenge.UpdatedAt = now
		if err := s.emailVerificationRepo.Update(ctx, challenge); err != nil {
			return nil, err
		}
	}

	if err := s.sendEmailVerificationOTP(user, otpCode, s.emailVerificationOTPConfigTTL()); err != nil {
		return nil, fmt.Errorf("failed to dispatch email verification otp: %w", err)
	}

	return buildEmailVerificationStatusResponse(challenge, now), nil
}

func (s *UserService) VerifyEmailOTP(ctx context.Context, userID string, req dto.VerifyEmailOTPRequest) (*dto.EmailVerificationStatusResponse, error) {
	if s.emailVerificationRepo == nil {
		return nil, ErrEmailVerificationNotFound
	}

	challenge, err := s.emailVerificationRepo.GetByID(ctx, strings.TrimSpace(req.VerificationID))
	if err != nil {
		return nil, err
	}
	if challenge == nil || challenge.UserID != userID {
		return nil, ErrEmailVerificationNotFound
	}

	now := time.Now()
	if challenge.Status == model.EmailVerificationStatusConsumed || challenge.ConsumedAt != nil {
		return nil, ErrEmailVerificationAlreadyUsed
	}
	if challenge.Status == model.EmailVerificationStatusLocked {
		return nil, newEmailVerificationError(ErrEmailVerificationLocked, 0, 0)
	}
	if now.After(challenge.ExpiresAt) {
		challenge.Status = model.EmailVerificationStatusExpired
		challenge.UpdatedAt = now
		_ = s.emailVerificationRepo.Update(ctx, challenge)
		return nil, ErrEmailVerificationExpired
	}

	expectedHash := s.hashEmailOTPCode(challenge.Email, strings.TrimSpace(req.OTPCode))
	if subtle.ConstantTimeCompare([]byte(challenge.OTPHash), []byte(expectedHash)) != 1 {
		challenge.AttemptCount++
		challenge.UpdatedAt = now
		if challenge.AttemptCount >= challenge.MaxAttempts {
			challenge.Status = model.EmailVerificationStatusLocked
		}
		if err := s.emailVerificationRepo.Update(ctx, challenge); err != nil {
			return nil, err
		}
		if challenge.Status == model.EmailVerificationStatusLocked {
			return nil, newEmailVerificationError(ErrEmailVerificationLocked, 0, 0)
		}
		return nil, newEmailVerificationError(
			ErrEmailVerificationInvalidOTP,
			maxInt(challenge.MaxAttempts-challenge.AttemptCount, 0),
			0,
		)
	}

	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}

	challenge.Status = model.EmailVerificationStatusVerified
	challenge.AttemptCount = 0
	challenge.UpdatedAt = now
	challenge.VerifiedAt = &now
	if err := s.emailVerificationRepo.Update(ctx, challenge); err != nil {
		return nil, err
	}

	user.EmailVerified = true
	user.EmailVerificationTokenHash = ""
	user.EmailVerificationExpiresAt = nil
	user.UpdatedAt = now
	if err := s.repo.Update(ctx, user); err != nil {
		return nil, err
	}

	return buildEmailVerificationStatusResponse(challenge, now), nil
}

func (s *UserService) ResendEmailVerificationOTP(ctx context.Context, userID string, ipAddress string, req dto.ResendEmailOTPRequest) (*dto.EmailVerificationStatusResponse, error) {
	if s.emailVerificationRepo == nil {
		return nil, ErrEmailVerificationNotFound
	}

	challenge, err := s.emailVerificationRepo.GetByID(ctx, strings.TrimSpace(req.VerificationID))
	if err != nil {
		return nil, err
	}
	if challenge == nil || challenge.UserID != userID {
		return nil, ErrEmailVerificationNotFound
	}
	if challenge.Status == model.EmailVerificationStatusConsumed || challenge.ConsumedAt != nil {
		return nil, ErrEmailVerificationAlreadyUsed
	}

	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}

	now := time.Now()
	if challenge.Status == model.EmailVerificationStatusLocked {
		return nil, newEmailVerificationError(ErrEmailVerificationLocked, 0, 0)
	}
	if now.Before(challenge.ResendAvailableAt) {
		return nil, newEmailVerificationError(ErrEmailVerificationResendTooSoon, 0, secondsUntil(challenge.ResendAvailableAt, now))
	}
	if !s.allowOTPEvent("email-otp:user:"+userID, s.emailVerificationDailyLimitPerUser(), 24*time.Hour, now) {
		return nil, ErrEmailVerificationRateLimited
	}
	if !s.allowOTPEvent("email-otp:email:"+normalizeEmail(challenge.Email), s.emailVerificationDailyLimitPerUser(), 24*time.Hour, now) {
		return nil, ErrEmailVerificationRateLimited
	}
	if !s.allowOTPEvent("email-otp:ip:"+strings.TrimSpace(ipAddress), s.emailVerificationHourlyLimitPerIP(), time.Hour, now) {
		return nil, ErrEmailVerificationRateLimited
	}

	otpCode, err := generateOTPCode()
	if err != nil {
		return nil, err
	}

	challenge.Email = normalizeEmail(user.Email)
	challenge.OTPHash = s.hashEmailOTPCode(challenge.Email, otpCode)
	challenge.Status = model.EmailVerificationStatusPending
	challenge.AttemptCount = 0
	challenge.VerifiedAt = nil
	challenge.ExpiresAt = now.Add(s.emailVerificationOTPConfigTTL())
	challenge.ResendAvailableAt = now.Add(s.emailVerificationOTPCooldown())
	challenge.LastSentAt = now
	challenge.UpdatedAt = now
	if err := s.emailVerificationRepo.Update(ctx, challenge); err != nil {
		return nil, err
	}

	if err := s.sendEmailVerificationOTP(user, otpCode, s.emailVerificationOTPConfigTTL()); err != nil {
		return nil, fmt.Errorf("failed to resend email verification otp: %w", err)
	}

	return buildEmailVerificationStatusResponse(challenge, now), nil
}

func (s *UserService) GetEmailVerificationStatus(ctx context.Context, userID string) (*dto.EmailVerificationStatusResponse, error) {
	if s.emailVerificationRepo == nil {
		return nil, nil
	}

	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil || user.EmailVerified {
		return nil, nil
	}

	challenge, err := s.emailVerificationRepo.GetLatestActiveByUserID(ctx, userID, model.EmailVerificationPurposeSignUp)
	if err != nil {
		return nil, err
	}
	if challenge == nil {
		return nil, nil
	}

	now := time.Now()
	if challenge.Status == model.EmailVerificationStatusPending && now.After(challenge.ExpiresAt) {
		challenge.Status = model.EmailVerificationStatusExpired
		challenge.UpdatedAt = now
		if err := s.emailVerificationRepo.Update(ctx, challenge); err != nil {
			return nil, err
		}
	}

	if challenge.Status == model.EmailVerificationStatusExpired || challenge.Status == model.EmailVerificationStatusConsumed {
		return nil, nil
	}

	return buildEmailVerificationStatusResponse(challenge, now), nil
}

func (s *UserService) sendEmailVerificationOTP(user *model.User, otpCode string, ttl time.Duration) error {
	if s.emailSender == nil {
		return fmt.Errorf("email sender is not configured")
	}

	body := strings.Join([]string{
		fmt.Sprintf("Xin chao %s,", strings.TrimSpace(user.FirstName)),
		"",
		"Ma xac minh email dung mot lan cua ban la:",
		otpCode,
		"",
		fmt.Sprintf("Ma nay co hieu luc trong %d phut.", maxInt(int(ttl.Minutes()), 1)),
		"Neu ban khong thuc hien yeu cau nay, hay bo qua email.",
	}, "\n")

	return s.emailSender.Send(email.Message{
		To:      []string{user.Email},
		Subject: "Ma OTP xac minh email ND Shop",
		Body:    body,
	})
}

func buildEmailVerificationStatusResponse(challenge *model.EmailVerificationChallenge, now time.Time) *dto.EmailVerificationStatusResponse {
	if challenge == nil {
		return nil
	}

	response := &dto.EmailVerificationStatusResponse{
		VerificationID:    challenge.ID,
		Email:             challenge.Email,
		EmailMasked:       maskEmailAddress(challenge.Email),
		Status:            challenge.Status,
		ExpiresAt:         challenge.ExpiresAt.UTC().Format(time.RFC3339),
		ResendAvailableAt: challenge.ResendAvailableAt.UTC().Format(time.RFC3339),
		ExpiresInSeconds:  secondsUntil(challenge.ExpiresAt, now),
		ResendInSeconds:   secondsUntil(challenge.ResendAvailableAt, now),
		MaxAttempts:       challenge.MaxAttempts,
		RemainingAttempts: maxInt(challenge.MaxAttempts-challenge.AttemptCount, 0),
	}
	if challenge.VerifiedAt != nil {
		verifiedAt := challenge.VerifiedAt.UTC().Format(time.RFC3339)
		response.VerifiedAt = &verifiedAt
	}

	return response
}

func (s *UserService) hashEmailOTPCode(emailAddress string, otpCode string) string {
	payload := fmt.Sprintf("%s:%s:%s", s.emailVerificationCfg.SecretPepper, normalizeEmail(emailAddress), strings.TrimSpace(otpCode))
	sum := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(sum[:])
}

func maskEmailAddress(emailAddress string) string {
	normalized := normalizeEmail(emailAddress)
	localPart, domain, found := strings.Cut(normalized, "@")
	if !found || localPart == "" || domain == "" {
		return normalized
	}
	if len(localPart) <= 2 {
		return fmt.Sprintf("%s***@%s", localPart[:1], domain)
	}
	return fmt.Sprintf("%s***@%s", localPart[:2], domain)
}
