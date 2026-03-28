package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
)

func (s *UserService) StartPhoneVerification(ctx context.Context, userID string, ipAddress string, req dto.SendPhoneOTPRequest) (*dto.PhoneVerificationStatusResponse, error) {
	if s.phoneVerificationRepo == nil {
		return nil, ErrPhoneVerificationRequired
	}

	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}

	phone := normalizePhone(req.Phone)
	if !isValidVNPhone(phone) {
		return nil, ErrInvalidPhoneNumber
	}
	chatID := normalizeTelegramChatID(req.TelegramChatID)
	if chatID == "" {
		return nil, ErrInvalidTelegramChatID
	}

	if existing, err := s.repo.GetByPhone(ctx, phone); err != nil {
		return nil, err
	} else if existing != nil && existing.ID != userID {
		return nil, ErrPhoneAlreadyExists
	}

	now := time.Now()
	if !s.allowOTPEvent("otp:user:"+userID, s.telegramCfg.OTPDailyLimitPerUser, 24*time.Hour, now) {
		return nil, ErrPhoneVerificationRateLimited
	}
	if !s.allowOTPEvent("otp:ip:"+strings.TrimSpace(ipAddress), s.telegramCfg.OTPHourlyLimitPerIP, time.Hour, now) {
		return nil, ErrPhoneVerificationRateLimited
	}

	_ = s.phoneVerificationRepo.DeleteExpired(ctx)
	challenge, err := s.phoneVerificationRepo.GetLatestActiveByUserID(ctx, userID, model.PhoneVerificationPurposeProfileUpdate)
	if err != nil {
		return nil, err
	}

	otpCode, err := generateOTPCode()
	if err != nil {
		return nil, err
	}
	otpHash := s.hashOTPCode(phone, otpCode)
	if challenge != nil {
		if challenge.Status == model.PhoneVerificationStatusPending && challenge.PhoneCandidate == phone && now.Before(challenge.ResendAvailableAt) {
			return buildPhoneVerificationStatusResponse(challenge, now), nil
		}
		if challenge.Status == model.PhoneVerificationStatusPending {
			challenge.Status = model.PhoneVerificationStatusExpired
			challenge.UpdatedAt = now
			if err := s.phoneVerificationRepo.Update(ctx, challenge); err != nil {
				return nil, err
			}
			challenge = nil
		}
	}

	if challenge == nil {
		challenge = &model.PhoneVerificationChallenge{
			ID:                uuid.New().String(),
			UserID:            userID,
			Purpose:           model.PhoneVerificationPurposeProfileUpdate,
			PhoneCandidate:    phone,
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
		if err := s.phoneVerificationRepo.Create(ctx, challenge); err != nil {
			return nil, err
		}
	} else {
		challenge.PhoneCandidate = phone
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
		if err := s.phoneVerificationRepo.Update(ctx, challenge); err != nil {
			return nil, err
		}
	}

	if s.telegramSender != nil {
		if err := s.telegramSender.SendOTP(chatID, phone, otpCode, s.telegramOTPConfigTTL()); err != nil {
			return nil, fmt.Errorf("failed to dispatch telegram otp: %w", err)
		}
	}

	return buildPhoneVerificationStatusResponse(challenge, now), nil
}

func (s *UserService) VerifyPhoneOTP(ctx context.Context, userID string, req dto.VerifyPhoneOTPRequest) (*dto.PhoneVerificationStatusResponse, error) {
	if s.phoneVerificationRepo == nil {
		return nil, ErrPhoneVerificationNotFound
	}

	challenge, err := s.phoneVerificationRepo.GetByID(ctx, strings.TrimSpace(req.VerificationID))
	if err != nil {
		return nil, err
	}
	if challenge == nil || challenge.UserID != userID {
		return nil, ErrPhoneVerificationNotFound
	}

	now := time.Now()
	if challenge.Status == model.PhoneVerificationStatusConsumed || challenge.ConsumedAt != nil {
		return nil, ErrPhoneVerificationAlreadyUsed
	}
	if challenge.Status == model.PhoneVerificationStatusLocked {
		return nil, ErrPhoneVerificationLocked
	}
	if now.After(challenge.ExpiresAt) {
		challenge.Status = model.PhoneVerificationStatusExpired
		challenge.UpdatedAt = now
		_ = s.phoneVerificationRepo.Update(ctx, challenge)
		return nil, ErrPhoneVerificationExpired
	}

	expectedHash := s.hashOTPCode(challenge.PhoneCandidate, strings.TrimSpace(req.OTPCode))
	if subtle.ConstantTimeCompare([]byte(challenge.OTPHash), []byte(expectedHash)) != 1 {
		challenge.AttemptCount++
		challenge.UpdatedAt = now
		if challenge.AttemptCount >= challenge.MaxAttempts {
			challenge.Status = model.PhoneVerificationStatusLocked
		}
		if err := s.phoneVerificationRepo.Update(ctx, challenge); err != nil {
			return nil, err
		}
		if challenge.Status == model.PhoneVerificationStatusLocked {
			return nil, ErrPhoneVerificationLocked
		}
		return nil, ErrPhoneVerificationInvalidOTP
	}

	challenge.Status = model.PhoneVerificationStatusVerified
	challenge.AttemptCount = 0
	challenge.UpdatedAt = now
	challenge.VerifiedAt = &now
	if err := s.phoneVerificationRepo.Update(ctx, challenge); err != nil {
		return nil, err
	}

	return buildPhoneVerificationStatusResponse(challenge, now), nil
}

func (s *UserService) ResendPhoneOTP(ctx context.Context, userID string, ipAddress string, req dto.ResendPhoneOTPRequest) (*dto.PhoneVerificationStatusResponse, error) {
	if s.phoneVerificationRepo == nil {
		return nil, ErrPhoneVerificationNotFound
	}

	challenge, err := s.phoneVerificationRepo.GetByID(ctx, strings.TrimSpace(req.VerificationID))
	if err != nil {
		return nil, err
	}
	if challenge == nil || challenge.UserID != userID {
		return nil, ErrPhoneVerificationNotFound
	}
	if challenge.Status == model.PhoneVerificationStatusConsumed || challenge.ConsumedAt != nil {
		return nil, ErrPhoneVerificationAlreadyUsed
	}

	now := time.Now()
	if challenge.Status == model.PhoneVerificationStatusLocked {
		return nil, ErrPhoneVerificationLocked
	}
	if now.Before(challenge.ResendAvailableAt) {
		return nil, ErrPhoneVerificationResendTooSoon
	}
	if !s.allowOTPEvent("otp:user:"+userID, s.telegramCfg.OTPDailyLimitPerUser, 24*time.Hour, now) {
		return nil, ErrPhoneVerificationRateLimited
	}
	if !s.allowOTPEvent("otp:ip:"+strings.TrimSpace(ipAddress), s.telegramCfg.OTPHourlyLimitPerIP, time.Hour, now) {
		return nil, ErrPhoneVerificationRateLimited
	}

	otpCode, err := generateOTPCode()
	if err != nil {
		return nil, err
	}
	challenge.OTPHash = s.hashOTPCode(challenge.PhoneCandidate, otpCode)
	challenge.Status = model.PhoneVerificationStatusPending
	challenge.AttemptCount = 0
	challenge.VerifiedAt = nil
	challenge.ExpiresAt = now.Add(s.telegramOTPConfigTTL())
	challenge.ResendAvailableAt = now.Add(s.telegramOTPCooldown())
	challenge.LastSentAt = now
	challenge.UpdatedAt = now
	if err := s.phoneVerificationRepo.Update(ctx, challenge); err != nil {
		return nil, err
	}

	if s.telegramSender != nil {
		if err := s.telegramSender.SendOTP(challenge.TelegramChatID, challenge.PhoneCandidate, otpCode, s.telegramOTPConfigTTL()); err != nil {
			return nil, fmt.Errorf("failed to resend telegram otp: %w", err)
		}
	}

	return buildPhoneVerificationStatusResponse(challenge, now), nil
}

func (s *UserService) GetPhoneVerificationStatus(ctx context.Context, userID string) (*dto.PhoneVerificationStatusResponse, error) {
	if s.phoneVerificationRepo == nil {
		return nil, nil
	}

	challenge, err := s.phoneVerificationRepo.GetLatestActiveByUserID(ctx, userID, model.PhoneVerificationPurposeProfileUpdate)
	if err != nil {
		return nil, err
	}
	if challenge == nil {
		return nil, nil
	}

	now := time.Now()
	if challenge.Status == model.PhoneVerificationStatusPending && now.After(challenge.ExpiresAt) {
		challenge.Status = model.PhoneVerificationStatusExpired
		challenge.UpdatedAt = now
		if err := s.phoneVerificationRepo.Update(ctx, challenge); err != nil {
			return nil, err
		}
	}

	if challenge.Status == model.PhoneVerificationStatusExpired || challenge.Status == model.PhoneVerificationStatusConsumed {
		return nil, nil
	}

	return buildPhoneVerificationStatusResponse(challenge, now), nil
}

func buildPhoneVerificationStatusResponse(challenge *model.PhoneVerificationChallenge, now time.Time) *dto.PhoneVerificationStatusResponse {
	if challenge == nil {
		return nil
	}

	response := &dto.PhoneVerificationStatusResponse{
		VerificationID:    challenge.ID,
		Phone:             challenge.PhoneCandidate,
		PhoneMasked:       maskPhone(challenge.PhoneCandidate),
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

func (s *UserService) hashOTPCode(phone string, otpCode string) string {
	payload := fmt.Sprintf("%s:%s:%s", s.telegramCfg.SecretPepper, normalizePhone(phone), strings.TrimSpace(otpCode))
	sum := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(sum[:])
}

func generateOTPCode() (string, error) {
	number, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", number.Int64()), nil
}

func secondsUntil(target time.Time, now time.Time) int64 {
	if target.Before(now) {
		return 0
	}
	return int64(target.Sub(now).Seconds())
}

func maskPhone(phone string) string {
	if len(phone) <= 3 {
		return phone
	}
	return strings.Repeat("*", len(phone)-3) + phone[len(phone)-3:]
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
