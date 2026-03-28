package telegram

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"go.uber.org/zap"
)

type Sender interface {
	SendOTP(chatID string, phone string, otpCode string, ttl time.Duration) error
}

func NewSender(cfg config.TelegramConfig, log *zap.Logger) Sender {
	if !cfg.Enabled || strings.TrimSpace(cfg.BotToken) == "" {
		if log != nil {
			log.Warn("Telegram OTP sender disabled, using log sender")
		}
		return &logSender{log: log}
	}

	apiBaseURL := strings.TrimRight(strings.TrimSpace(cfg.APIBaseURL), "/")
	if apiBaseURL == "" {
		apiBaseURL = "https://api.telegram.org"
	}

	return &botSender{
		log:        log,
		botToken:   cfg.BotToken,
		apiBaseURL: apiBaseURL,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

type botSender struct {
	log        *zap.Logger
	botToken   string
	apiBaseURL string
	client     *http.Client
}

type logSender struct {
	log *zap.Logger
}

func (s *botSender) SendOTP(chatID string, phone string, otpCode string, ttl time.Duration) error {
	body := map[string]string{
		"chat_id": chatID,
		"text": strings.TrimSpace(fmt.Sprintf(
			"Ma OTP xac thuc so dien thoai %s cua ban la %s.\nMa co hieu luc trong %d phut.\nKhong chia se ma nay cho bat ky ai.",
			maskPhone(phone),
			otpCode,
			maxInt(1, int(ttl.Minutes())),
		)),
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("failed to marshal telegram payload: %w", err)
	}

	endpoint := fmt.Sprintf("%s/bot%s/sendMessage", s.apiBaseURL, s.botToken)
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("failed to build telegram request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send telegram otp: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("telegram api returned status %d", resp.StatusCode)
	}

	if s.log != nil {
		s.log.Info("telegram otp sent",
			zap.String("chat_id", chatID),
			zap.String("phone_suffix", phoneSuffix(phone)),
		)
	}

	return nil
}

func (s *logSender) SendOTP(chatID string, phone string, otpCode string, ttl time.Duration) error {
	if s.log != nil {
		s.log.Info("telegram otp send simulated",
			zap.String("chat_id", chatID),
			zap.String("phone", maskPhone(phone)),
			zap.String("otp_code", otpCode),
			zap.Duration("ttl", ttl),
		)
	}
	return nil
}

func maskPhone(phone string) string {
	if len(phone) <= 3 {
		return phone
	}
	return strings.Repeat("*", len(phone)-3) + phone[len(phone)-3:]
}

func phoneSuffix(phone string) string {
	if len(phone) <= 4 {
		return phone
	}
	return phone[len(phone)-4:]
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
