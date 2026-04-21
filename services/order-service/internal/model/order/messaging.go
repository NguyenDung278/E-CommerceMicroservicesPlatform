package model

import "time"

// OutboxMessage stores a durable broker publication request that must survive
// process crashes and temporary RabbitMQ outages.
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

// InboxMessage tracks a consumed asynchronous message so duplicate deliveries
// do not reapply business side effects.
type InboxMessage struct {
	Consumer   string    `json:"consumer"`
	MessageID  string    `json:"message_id"`
	RoutingKey string    `json:"routing_key"`
	CreatedAt  time.Time `json:"created_at"`
}

// InboxTransitionResult describes how an inbox-protected state transition
// behaved for one consumed message.
type InboxTransitionResult struct {
	Duplicate      bool        `json:"duplicate"`
	OrderFound     bool        `json:"order_found"`
	Transitioned   bool        `json:"transitioned"`
	PreviousStatus OrderStatus `json:"previous_status,omitempty"`
}
