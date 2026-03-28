package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"go.uber.org/zap"
)

type Sender interface {
	ResolveChatID(ctx context.Context) (string, error)
	SendOTP(chatID string, phone string, otpCode string, ttl time.Duration) error
}

var ErrChatNotFound = errors.New("telegram private chat not found")

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
		client:     &http.Client{Timeout: 10 * time.Second},
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

func (s *botSender) ResolveChatID(ctx context.Context) (string, error) {
	endpoint := fmt.Sprintf("%s/bot%s/getUpdates?limit=100", s.apiBaseURL, s.botToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return "", fmt.Errorf("failed to build telegram getUpdates request: %w", err)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to fetch telegram updates: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("telegram getUpdates returned status %d", resp.StatusCode)
	}

	var payload struct {
		OK          bool   `json:"ok"`
		Description string `json:"description"`
		Result      []struct {
			UpdateID      int                    `json:"update_id"`
			Message       *telegramMessage       `json:"message"`
			EditedMessage *telegramMessage       `json:"edited_message"`
			CallbackQuery *telegramCallbackQuery `json:"callback_query"`
		} `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", fmt.Errorf("failed to decode telegram updates: %w", err)
	}
	if !payload.OK {
		return "", fmt.Errorf("telegram getUpdates failed: %s", strings.TrimSpace(payload.Description))
	}

	var (
		latestUpdateID = -1
		latestChatID   int64
	)
	for _, update := range payload.Result {
		for _, message := range []*telegramMessage{update.Message, update.EditedMessage} {
			if message == nil || message.Chat.Type != "private" {
				continue
			}
			if update.UpdateID > latestUpdateID {
				latestUpdateID = update.UpdateID
				latestChatID = message.Chat.ID
			}
		}

		if update.CallbackQuery != nil && update.CallbackQuery.Message != nil && update.CallbackQuery.Message.Chat.Type == "private" && update.UpdateID > latestUpdateID {
			latestUpdateID = update.UpdateID
			latestChatID = update.CallbackQuery.Message.Chat.ID
		}
	}

	if latestChatID == 0 {
		return "", ErrChatNotFound
	}

	return strconv.FormatInt(latestChatID, 10), nil
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
			zap.String("phone_suffix", phoneSuffix(phone)),
		)
	}

	return nil
}

func (s *logSender) ResolveChatID(_ context.Context) (string, error) {
	return "", ErrChatNotFound
}

func (s *logSender) SendOTP(chatID string, phone string, otpCode string, ttl time.Duration) error {
	if s.log != nil {
		s.log.Info("telegram otp send simulated",
			zap.String("phone", maskPhone(phone)),
			zap.String("phone_suffix", phoneSuffix(phone)),
			zap.Duration("ttl", ttl),
			zap.Int("otp_digits", len(strings.TrimSpace(otpCode))),
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

type telegramMessage struct {
	Chat telegramChat `json:"chat"`
}

type telegramCallbackQuery struct {
	Message *telegramMessage `json:"message"`
}

type telegramChat struct {
	ID   int64  `json:"id"`
	Type string `json:"type"`
}
