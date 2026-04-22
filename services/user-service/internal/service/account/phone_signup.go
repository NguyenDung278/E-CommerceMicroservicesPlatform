package account

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	telegramsender "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/telegram"
)

// StartPhoneSignup begins the public registration flow for phone-only users and
// dispatches a Telegram OTP before the account is created.
func (s *UserService) StartPhoneSignup(ctx context.Context, ipAddress string, req dto.StartPhoneSignupRequest) (*dto.PhoneVerificationStatusResponse, error) {
	if s.phoneSignupRepo == nil {
		return nil, ErrPhoneVerificationRequired
	}

	phone := normalizePhone(req.Phone)
	if !isValidVNPhone(phone) {
		return nil, ErrInvalidPhoneNumber
	}

	if req.Password != req.ConfirmPassword {
		return nil, ErrPasswordConfirmationMismatch
	}

	existingUser, err := s.repo.GetByPhone(ctx, phone)
	if err != nil {
		return nil, err
	}
	if existingUser != nil {
		return nil, ErrPhoneAlreadyExists
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(strings.TrimSpace(req.Password)), 12)
	if err != nil {
		return nil, err
	}
	firstName, lastName := generateRandomSignupName()

	now := currentTime()
	if !s.allowOTPEvent("phone-signup:phone:"+phone, s.telegramCfg.OTPDailyLimitPerUser, 24*hours, now) {
		return nil, ErrPhoneVerificationRateLimited
	}
	if !s.allowOTPEvent("phone-signup:ip:"+strings.TrimSpace(ipAddress), s.telegramCfg.OTPHourlyLimitPerIP, hours, now) {
		return nil, ErrPhoneVerificationRateLimited
	}

	_ = s.phoneSignupRepo.DeleteExpired(ctx)
	challenge, err := s.phoneSignupRepo.GetLatestActiveByPhone(ctx, phone)
	if err != nil {
		return nil, err
	}

	chatID, err := s.resolvePhoneSignupTelegramChatID(ctx, challenge)
	if err != nil {
		return nil, err
	}

	otpCode, err := generateOTPCode()
	if err != nil {
		return nil, err
	}
	otpHash := s.hashOTPCode(phone, otpCode)

	if challenge != nil {
		if challenge.Status == model.PhoneVerificationStatusPending && now.Before(challenge.ResendAvailableAt) {
			return buildPhoneSignupStatusResponse(challenge, now), nil
		}
		if challenge.Status == model.PhoneVerificationStatusPending {
			challenge.Status = model.PhoneVerificationStatusExpired
			challenge.UpdatedAt = now
			if err := s.phoneSignupRepo.Update(ctx, challenge); err != nil {
				return nil, err
			}
			challenge = nil
		}
	}

	if challenge == nil {
		challenge = &model.PhoneSignupChallenge{
			ID:                uuid.New().String(),
			Phone:             phone,
			PasswordHash:      string(passwordHash),
			FirstName:         firstName,
			LastName:          lastName,
			OTPHash:           otpHash,
			ExpiresAt:         now.Add(s.telegramOTPConfigTTL()),
			ResendAvailableAt: now.Add(s.telegramOTPCooldown()),
			LastSentAt:        now,
			AttemptCount:      0,
			MaxAttempts:       s.telegramOTPMaxAttempts(),
			Status:            model.PhoneVerificationStatusPending,
			TelegramChatID:    chatID,
			CreatedAt:         now,
			UpdatedAt:         now,
		}
		if err := s.phoneSignupRepo.Create(ctx, challenge); err != nil {
			return nil, err
		}
	} else {
		challenge.PasswordHash = string(passwordHash)
		challenge.FirstName = firstName
		challenge.LastName = lastName
		challenge.OTPHash = otpHash
		challenge.ExpiresAt = now.Add(s.telegramOTPConfigTTL())
		challenge.ResendAvailableAt = now.Add(s.telegramOTPCooldown())
		challenge.LastSentAt = now
		challenge.AttemptCount = 0
		challenge.MaxAttempts = s.telegramOTPMaxAttempts()
		challenge.Status = model.PhoneVerificationStatusPending
		challenge.TelegramChatID = chatID
		challenge.VerifiedAt = nil
		challenge.ConsumedAt = nil
		challenge.UpdatedAt = now
		if err := s.phoneSignupRepo.Update(ctx, challenge); err != nil {
			return nil, err
		}
	}

	if s.telegramSender == nil {
		return nil, fmt.Errorf("telegram sender is not configured")
	}
	if err := s.telegramSender.SendOTP(chatID, phone, otpCode, s.telegramOTPConfigTTL()); err != nil {
		return nil, fmt.Errorf("failed to dispatch telegram signup otp: %w", err)
	}

	return buildPhoneSignupStatusResponse(challenge, now), nil
}

// VerifyPhoneSignupOTP validates the public Telegram OTP challenge and creates
// the phone-only user account on success.
func (s *UserService) VerifyPhoneSignupOTP(ctx context.Context, req dto.VerifyPhoneOTPRequest) (*dto.AuthResponse, error) {
	if s.phoneSignupRepo == nil {
		return nil, ErrPhoneVerificationNotFound
	}

	challenge, err := s.phoneSignupRepo.GetByID(ctx, strings.TrimSpace(req.VerificationID))
	if err != nil {
		return nil, err
	}
	if challenge == nil {
		return nil, ErrPhoneVerificationNotFound
	}

	now := currentTime()
	if challenge.Status == model.PhoneVerificationStatusConsumed || challenge.ConsumedAt != nil {
		return nil, ErrPhoneVerificationAlreadyUsed
	}
	if challenge.Status == model.PhoneVerificationStatusLocked {
		return nil, newPhoneVerificationError(ErrPhoneVerificationLocked, 0, 0)
	}
	if now.After(challenge.ExpiresAt) {
		challenge.Status = model.PhoneVerificationStatusExpired
		challenge.UpdatedAt = now
		_ = s.phoneSignupRepo.Update(ctx, challenge)
		return nil, ErrPhoneVerificationExpired
	}

	expectedHash := s.hashOTPCode(challenge.Phone, strings.TrimSpace(req.OTPCode))
	if subtle.ConstantTimeCompare([]byte(challenge.OTPHash), []byte(expectedHash)) != 1 {
		challenge.AttemptCount++
		challenge.UpdatedAt = now
		if challenge.AttemptCount >= challenge.MaxAttempts {
			challenge.Status = model.PhoneVerificationStatusLocked
		}
		if err := s.phoneSignupRepo.Update(ctx, challenge); err != nil {
			return nil, err
		}
		if challenge.Status == model.PhoneVerificationStatusLocked {
			return nil, newPhoneVerificationError(ErrPhoneVerificationLocked, 0, 0)
		}
		return nil, newPhoneVerificationError(
			ErrPhoneVerificationInvalidOTP,
			maxInt(challenge.MaxAttempts-challenge.AttemptCount, 0),
			0,
		)
	}

	existingUser, err := s.repo.GetByPhone(ctx, challenge.Phone)
	if err != nil {
		return nil, err
	}
	if existingUser != nil {
		challenge.Status = model.PhoneVerificationStatusConsumed
		challenge.ConsumedAt = &now
		challenge.UpdatedAt = now
		_ = s.phoneSignupRepo.Update(ctx, challenge)
		return nil, ErrPhoneAlreadyExists
	}

	user := &model.User{
		ID:              uuid.New().String(),
		Email:           "",
		Phone:           challenge.Phone,
		PhoneVerified:   true,
		PhoneVerifiedAt: &now,
		Password:        challenge.PasswordHash,
		FirstName:       normalizeHumanName(challenge.FirstName),
		LastName:        normalizeHumanName(challenge.LastName),
		Role:            middleware.RoleUser,
		EmailVerified:   true,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	if err := s.repo.Create(ctx, user); err != nil {
		return nil, mapUserRepositoryError(err)
	}

	challenge.Status = model.PhoneVerificationStatusConsumed
	challenge.AttemptCount = 0
	challenge.VerifiedAt = &now
	challenge.ConsumedAt = &now
	challenge.UpdatedAt = now
	if err := s.phoneSignupRepo.Update(ctx, challenge); err != nil {
		return nil, err
	}

	return s.buildAuthResponse(ctx, user)
}

// ResendPhoneSignupOTP refreshes the OTP for a public phone signup challenge.
func (s *UserService) ResendPhoneSignupOTP(ctx context.Context, ipAddress string, req dto.ResendPhoneOTPRequest) (*dto.PhoneVerificationStatusResponse, error) {
	if s.phoneSignupRepo == nil {
		return nil, ErrPhoneVerificationNotFound
	}

	challenge, err := s.phoneSignupRepo.GetByID(ctx, strings.TrimSpace(req.VerificationID))
	if err != nil {
		return nil, err
	}
	if challenge == nil {
		return nil, ErrPhoneVerificationNotFound
	}
	if challenge.Status == model.PhoneVerificationStatusConsumed || challenge.ConsumedAt != nil {
		return nil, ErrPhoneVerificationAlreadyUsed
	}

	now := currentTime()
	if challenge.Status == model.PhoneVerificationStatusLocked {
		return nil, newPhoneVerificationError(ErrPhoneVerificationLocked, 0, 0)
	}
	if now.Before(challenge.ResendAvailableAt) {
		return nil, newPhoneVerificationError(ErrPhoneVerificationResendTooSoon, 0, secondsUntil(challenge.ResendAvailableAt, now))
	}
	if !s.allowOTPEvent("phone-signup:phone:"+challenge.Phone, s.telegramCfg.OTPDailyLimitPerUser, 24*hours, now) {
		return nil, ErrPhoneVerificationRateLimited
	}
	if !s.allowOTPEvent("phone-signup:ip:"+strings.TrimSpace(ipAddress), s.telegramCfg.OTPHourlyLimitPerIP, hours, now) {
		return nil, ErrPhoneVerificationRateLimited
	}

	chatID, err := s.resolvePhoneSignupTelegramChatID(ctx, challenge)
	if err != nil {
		return nil, err
	}

	otpCode, err := generateOTPCode()
	if err != nil {
		return nil, err
	}
	challenge.OTPHash = s.hashOTPCode(challenge.Phone, otpCode)
	challenge.Status = model.PhoneVerificationStatusPending
	challenge.AttemptCount = 0
	challenge.VerifiedAt = nil
	challenge.ExpiresAt = now.Add(s.telegramOTPConfigTTL())
	challenge.ResendAvailableAt = now.Add(s.telegramOTPCooldown())
	challenge.LastSentAt = now
	challenge.TelegramChatID = chatID
	challenge.UpdatedAt = now
	if err := s.phoneSignupRepo.Update(ctx, challenge); err != nil {
		return nil, err
	}

	if s.telegramSender == nil {
		return nil, fmt.Errorf("telegram sender is not configured")
	}
	if err := s.telegramSender.SendOTP(chatID, challenge.Phone, otpCode, s.telegramOTPConfigTTL()); err != nil {
		return nil, fmt.Errorf("failed to resend telegram signup otp: %w", err)
	}

	return buildPhoneSignupStatusResponse(challenge, now), nil
}

func buildPhoneSignupStatusResponse(challenge *model.PhoneSignupChallenge, now time.Time) *dto.PhoneVerificationStatusResponse {
	if challenge == nil {
		return nil
	}

	response := &dto.PhoneVerificationStatusResponse{
		VerificationID:    challenge.ID,
		Phone:             challenge.Phone,
		PhoneMasked:       maskPhone(challenge.Phone),
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

func (s *UserService) resolvePhoneSignupTelegramChatID(ctx context.Context, challenge *model.PhoneSignupChallenge) (string, error) {
	if challenge != nil {
		if chatID := normalizeTelegramChatID(challenge.TelegramChatID); chatID != "" {
			return chatID, nil
		}
	}
	if s.telegramSender == nil {
		return "", ErrTelegramChatNotLinked
	}

	chatID, err := s.telegramSender.ResolveChatID(ctx)
	if err != nil {
		if errors.Is(err, telegramsender.ErrChatNotFound) {
			return "", ErrTelegramChatNotLinked
		}
		return "", fmt.Errorf("failed to resolve telegram chat id: %w", err)
	}

	chatID = normalizeTelegramChatID(chatID)
	if chatID == "" {
		return "", ErrTelegramChatNotLinked
	}

	return chatID, nil
}
