package email

import (
	"fmt"
	"net/smtp"
	"strings"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"go.uber.org/zap"
)

type Message struct {
	To      []string
	Subject string
	Body    string
}

type Sender interface {
	Send(message Message) error
}

// NewSender creates a new email sender based on configuration.
//
// LOGIC CHUYỂN ĐỔI (FALLBACK):
// Nếu bạn chưa cấu hình thông số SMTP thực tế (Host, FromAddress rỗng), hệ thống sẽ
// tự động dùng `logSender` để in nội dung email ra Terminal thay vì gửi thật. Việc này giúp Developer
// debug dễ dàng ở localhost mà không lo spam thật.
func NewSender(cfg config.SMTPConfig, log *zap.Logger) Sender {
	if strings.TrimSpace(cfg.Host) == "" || strings.TrimSpace(cfg.FromAddress) == "" {
		log.Warn("SMTP not configured, falling back to log-based notifications")
		return &logSender{log: log}
	}

	return &smtpSender{
		cfg: cfg,
		log: log,
	}
}

type smtpSender struct {
	cfg config.SMTPConfig
	log *zap.Logger
}

func (s *smtpSender) Send(message Message) error {
	var auth smtp.Auth
	if strings.TrimSpace(s.cfg.Username) != "" {
		auth = smtp.PlainAuth("", s.cfg.Username, s.cfg.Password, s.cfg.Host)
	}

	lines := []string{
		fmt.Sprintf("From: %s", formatFrom(s.cfg.FromName, s.cfg.FromAddress)),
		fmt.Sprintf("To: %s", strings.Join(message.To, ", ")),
		fmt.Sprintf("Subject: %s", message.Subject),
		"MIME-Version: 1.0",
		`Content-Type: text/plain; charset="UTF-8"`,
		"",
		message.Body,
	}

	if err := smtp.SendMail(s.cfg.Addr(), auth, s.cfg.FromAddress, message.To, []byte(strings.Join(lines, "\r\n"))); err != nil {
		return fmt.Errorf("failed to send mail: %w", err)
	}

	s.log.Info("email sent",
		zap.Strings("to", message.To),
		zap.String("subject", message.Subject),
	)
	return nil
}

type logSender struct {
	log *zap.Logger
}

func (s *logSender) Send(message Message) error {
	s.log.Info("email send simulated",
		zap.Strings("to", message.To),
		zap.String("subject", message.Subject),
		zap.String("body", message.Body),
	)
	return nil
}

func formatFrom(name, address string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return address
	}
	return fmt.Sprintf("%s <%s>", name, address)
}
