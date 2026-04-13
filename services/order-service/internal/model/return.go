package model

import "time"

type ReturnStatus string

const (
	ReturnStatusRequested ReturnStatus = "requested"
	ReturnStatusApproved  ReturnStatus = "approved"
	ReturnStatusRejected  ReturnStatus = "rejected"
	ReturnStatusReceived  ReturnStatus = "received"
	ReturnStatusRefunded  ReturnStatus = "refunded"
	ReturnStatusCancelled ReturnStatus = "cancelled"
)

type ReturnRequest struct {
	ID        string        `json:"id"`
	OrderID   string        `json:"order_id"`
	UserID    string        `json:"user_id"`
	UserEmail string        `json:"user_email,omitempty"`
	Status    ReturnStatus  `json:"status"`
	Reason    string        `json:"reason"`
	Items     []ReturnItem  `json:"items"`
	Events    []ReturnEvent `json:"events,omitempty"`
	CreatedAt time.Time     `json:"created_at"`
	UpdatedAt time.Time     `json:"updated_at"`
}

type ReturnItem struct {
	ID          string    `json:"id"`
	ReturnID    string    `json:"return_id"`
	OrderItemID string    `json:"order_item_id"`
	ProductID   string    `json:"product_id"`
	Quantity    int       `json:"quantity"`
	Reason      string    `json:"reason,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ReturnEvent struct {
	ID        string       `json:"id"`
	ReturnID  string       `json:"return_id"`
	Status    ReturnStatus `json:"status"`
	ActorID   string       `json:"actor_id,omitempty"`
	ActorRole string       `json:"actor_role,omitempty"`
	Message   string       `json:"message"`
	CreatedAt time.Time    `json:"created_at"`
}
