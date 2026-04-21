package model

import "time"

// OutboxMessage stores a durable broker publication request that is committed
// together with the authoritative payment state change.
type OutboxMessage struct {
	ID            string     `json:"id"`
	AggregateType string     `json:"aggregate_type"`
	AggregateID   string     `json:"aggregate_id"`
	EventType     string     `json:"event_type"`
	RoutingKey    string     `json:"routing_key"`
	Payload       []byte     `json:"payload"`
	RequestID     string     `json:"request_id,omitempty"`
	Attempts      int        `json:"attempts"`
	LastError     string     `json:"last_error,omitempty"`
	AvailableAt   time.Time  `json:"available_at"`
	PublishedAt   *time.Time `json:"published_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// InboxMessage tracks processed asynchronous inputs such as gateway webhooks so
// duplicate deliveries do not replay side effects.
type InboxMessage struct {
	Consumer   string    `json:"consumer"`
	MessageID  string    `json:"message_id"`
	RoutingKey string    `json:"routing_key"`
	CreatedAt  time.Time `json:"created_at"`
}
