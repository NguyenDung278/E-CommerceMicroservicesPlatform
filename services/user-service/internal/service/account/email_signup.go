package accountservice

import (
	"context"
	"crypto/subtle"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/email"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

// StartEmailSignup begins the public registration flow for email users and
// dispatches an OTP email before the account is created.
func (s *UserService) StartEmailSignup(ctx context.Context, ipAddress string, req dto.StartEmailSignupRequest) (*dto.EmailVerificationStatusResponse, error) {
	if s.emailSignupRepo == nil {
		return nil, fmt.Errorf("email signup repository is not configured")
	}

	emailAddress := normalizeEmail(req.Email)
	if emailAddress == "" {
		return nil, fmt.Errorf("email is required")
	}
	if req.Password != req.ConfirmPassword {
		return nil, ErrPasswordConfirmationMismatch
	}

	existingUser, err := s.repo.GetByEmail(ctx, emailAddress)
	if err != nil {
		return nil, err
	}
	if existingUser != nil {
		return nil, ErrEmailAlreadyExists
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(strings.TrimSpace(req.Password)), 12)
	if err != nil {
		return nil, err
	}

	firstName, lastName := generateRandomSignupName()
	now := currentTime()
	if !s.allowOTPEvent("email-signup:email:"+emailAddress, s.emailVerificationDailyLimitPerUser(), 24*hours, now) {
		return nil, ErrEmailVerificationRateLimited
	}
	if !s.allowOTPEvent("email-signup:ip:"+strings.TrimSpace(ipAddress), s.emailVerificationHourlyLimitPerIP(), hours, now) {
		return nil, ErrEmailVerificationRateLimited
	}

	_ = s.emailSignupRepo.DeleteExpired(ctx)
	challenge, err := s.emailSignupRepo.GetLatestActiveByEmail(ctx, emailAddress)
	if err != nil {
		return nil, err
	}

	otpCode, err := generateOTPCode()
	if err != nil {
		return nil, err
	}
	otpHash := s.hashEmailOTPCode(emailAddress, otpCode)

	if challenge != nil {
		if challenge.Status == model.EmailVerificationStatusPending && now.Before(challenge.ResendAvailableAt) {
			return buildEmailSignupStatusResponse(challenge, now), nil
		}
		if challenge.Status == model.EmailVerificationStatusPending {
			challenge.Status = model.EmailVerificationStatusExpired
			challenge.UpdatedAt = now
			if err := s.emailSignupRepo.Update(ctx, challenge); err != nil {
				return nil, err
			}
			challenge = nil
		}
	}

	if challenge == nil {
		challenge = &model.EmailSignupChallenge{
			ID:                uuid.New().String(),
			Email:             emailAddress,
			PasswordHash:      string(passwordHash),
			FirstName:         firstName,
			LastName:          lastName,
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
		if err := s.emailSignupRepo.Create(ctx, challenge); err != nil {
			return nil, err
		}
	} else {
		challenge.PasswordHash = string(passwordHash)
		challenge.FirstName = firstName
		challenge.LastName = lastName
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
		if err := s.emailSignupRepo.Update(ctx, challenge); err != nil {
			return nil, err
		}
	}

	if err := s.sendEmailSignupOTP(challenge.Email, challenge.FirstName, otpCode, s.emailVerificationOTPConfigTTL()); err != nil {
		return nil, fmt.Errorf("failed to dispatch email signup otp: %w", err)
	}

	return buildEmailSignupStatusResponse(challenge, now), nil
}

// VerifyEmailSignupOTP validates the public email OTP challenge and creates the
// account only after the OTP is accepted.
func (s *UserService) VerifyEmailSignupOTP(ctx context.Context, req dto.VerifyEmailOTPRequest) (*dto.AuthResponse, error) {
	if s.emailSignupRepo == nil {
		return nil, ErrEmailVerificationNotFound
	}

	challenge, err := s.emailSignupRepo.GetByID(ctx, strings.TrimSpace(req.VerificationID))
	if err != nil {
		return nil, err
	}
	if challenge == nil {
		return nil, ErrEmailVerificationNotFound
	}

	now := currentTime()
	if challenge.Status == model.EmailVerificationStatusConsumed || challenge.ConsumedAt != nil {
		return nil, ErrEmailVerificationAlreadyUsed
	}
	if challenge.Status == model.EmailVerificationStatusLocked {
		return nil, newEmailVerificationError(ErrEmailVerificationLocked, 0, 0)
	}
	if now.After(challenge.ExpiresAt) {
		challenge.Status = model.EmailVerificationStatusExpired
		challenge.UpdatedAt = now
		_ = s.emailSignupRepo.Update(ctx, challenge)
		return nil, ErrEmailVerificationExpired
	}

	expectedHash := s.hashEmailOTPCode(challenge.Email, strings.TrimSpace(req.OTPCode))
	if subtle.ConstantTimeCompare([]byte(challenge.OTPHash), []byte(expectedHash)) != 1 {
		challenge.AttemptCount++
		challenge.UpdatedAt = now
		if challenge.AttemptCount >= challenge.MaxAttempts {
			challenge.Status = model.EmailVerificationStatusLocked
		}
		if err := s.emailSignupRepo.Update(ctx, challenge); err != nil {
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

	existingUser, err := s.repo.GetByEmail(ctx, challenge.Email)
	if err != nil {
		return nil, err
	}
	if existingUser != nil {
		challenge.Status = model.EmailVerificationStatusConsumed
		challenge.ConsumedAt = &now
		challenge.UpdatedAt = now
		_ = s.emailSignupRepo.Update(ctx, challenge)
		return nil, ErrEmailAlreadyExists
	}

	user := &model.User{
		ID:            uuid.New().String(),
		Email:         challenge.Email,
		Password:      challenge.PasswordHash,
		FirstName:     normalizeHumanName(challenge.FirstName),
		LastName:      normalizeHumanName(challenge.LastName),
		Role:          middleware.RoleUser,
		EmailVerified: true,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if err := s.repo.Create(ctx, user); err != nil {
		return nil, mapUserRepositoryError(err)
	}

	challenge.Status = model.EmailVerificationStatusConsumed
	challenge.AttemptCount = 0
	challenge.VerifiedAt = &now
	challenge.ConsumedAt = &now
	challenge.UpdatedAt = now
	if err := s.emailSignupRepo.Update(ctx, challenge); err != nil {
		return nil, err
	}

	return s.buildAuthResponse(ctx, user)
}

// ResendEmailSignupOTP refreshes the OTP for a public email signup challenge.
func (s *UserService) ResendEmailSignupOTP(ctx context.Context, ipAddress string, req dto.ResendEmailOTPRequest) (*dto.EmailVerificationStatusResponse, error) {
	if s.emailSignupRepo == nil {
		return nil, ErrEmailVerificationNotFound
	}

	challenge, err := s.emailSignupRepo.GetByID(ctx, strings.TrimSpace(req.VerificationID))
	if err != nil {
		return nil, err
	}
	if challenge == nil {
		return nil, ErrEmailVerificationNotFound
	}
	if challenge.Status == model.EmailVerificationStatusConsumed || challenge.ConsumedAt != nil {
		return nil, ErrEmailVerificationAlreadyUsed
	}

	now := currentTime()
	if challenge.Status == model.EmailVerificationStatusLocked {
		return nil, newEmailVerificationError(ErrEmailVerificationLocked, 0, 0)
	}
	if now.Before(challenge.ResendAvailableAt) {
		return nil, newEmailVerificationError(ErrEmailVerificationResendTooSoon, 0, secondsUntil(challenge.ResendAvailableAt, now))
	}
	if !s.allowOTPEvent("email-signup:email:"+challenge.Email, s.emailVerificationDailyLimitPerUser(), 24*hours, now) {
		return nil, ErrEmailVerificationRateLimited
	}
	if !s.allowOTPEvent("email-signup:ip:"+strings.TrimSpace(ipAddress), s.emailVerificationHourlyLimitPerIP(), hours, now) {
		return nil, ErrEmailVerificationRateLimited
	}

	otpCode, err := generateOTPCode()
	if err != nil {
		return nil, err
	}

	challenge.OTPHash = s.hashEmailOTPCode(challenge.Email, otpCode)
	challenge.Status = model.EmailVerificationStatusPending
	challenge.AttemptCount = 0
	challenge.VerifiedAt = nil
	challenge.ExpiresAt = now.Add(s.emailVerificationOTPConfigTTL())
	challenge.ResendAvailableAt = now.Add(s.emailVerificationOTPCooldown())
	challenge.LastSentAt = now
	challenge.UpdatedAt = now
	if err := s.emailSignupRepo.Update(ctx, challenge); err != nil {
		return nil, err
	}

	if err := s.sendEmailSignupOTP(challenge.Email, challenge.FirstName, otpCode, s.emailVerificationOTPConfigTTL()); err != nil {
		return nil, fmt.Errorf("failed to resend email signup otp: %w", err)
	}

	return buildEmailSignupStatusResponse(challenge, now), nil
}

func buildEmailSignupStatusResponse(challenge *model.EmailSignupChallenge, now time.Time) *dto.EmailVerificationStatusResponse {
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

func (s *UserService) sendEmailSignupOTP(emailAddress, firstName, otpCode string, ttl time.Duration) error {
	if s.emailSender == nil {
		return fmt.Errorf("email sender is not configured")
	}

	body := strings.Join([]string{
		fmt.Sprintf("Xin chao %s,", strings.TrimSpace(firstName)),
		"",
		"Ma OTP hoan tat dang ky tai khoan cua ban la:",
		otpCode,
		"",
		fmt.Sprintf("Ma nay co hieu luc trong %d phut.", maxInt(int(ttl.Minutes()), 1)),
		"Tai khoan chi duoc tao sau khi ma nay duoc xac thuc thanh cong.",
	}, "\n")

	return s.emailSender.Send(email.Message{
		To:      []string{emailAddress},
		Subject: "Ma OTP dang ky tai khoan ND Shop",
		Body:    body,
	})
}
