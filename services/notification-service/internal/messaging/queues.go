package messaging

const (
	MainExchange     = "events"
	MainQueue        = "notification-queue"
	RetryQueue       = "notification-retry-queue"
	DLQQueue         = "notification-dlq"
	ConsumerTag      = "notification-consumer"
	HeaderRetryCount = "x-notification-retry-count"
	HeaderFirstSeen  = "x-notification-first-seen-at"
	HeaderNextRetryAt = "x-notification-next-retry-at"
)
