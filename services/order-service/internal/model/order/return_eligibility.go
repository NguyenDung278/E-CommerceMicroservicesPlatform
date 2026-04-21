package model

import "time"

const DefaultReturnWindowDays = 30

type ReturnEligibilitySnapshot struct {
	OrderID               string                  `json:"order_id"`
	OrderStatus           OrderStatus             `json:"order_status"`
	Eligible              bool                    `json:"eligible"`
	Reason                string                  `json:"reason,omitempty"`
	ReturnWindowDays      int                     `json:"return_window_days"`
	ReturnWindowStartedAt *time.Time              `json:"return_window_started_at,omitempty"`
	ReturnWindowExpiresAt *time.Time              `json:"return_window_expires_at,omitempty"`
	Items                 []ReturnEligibilityItem `json:"items"`
}

type ReturnEligibilityItem struct {
	OrderItemID              string `json:"order_item_id"`
	ProductID                string `json:"product_id"`
	ProductName              string `json:"product_name"`
	OrderedQuantity          int    `json:"ordered_quantity"`
	AlreadyRequestedQuantity int    `json:"already_requested_quantity"`
	RemainingQuantity        int    `json:"remaining_quantity"`
	Eligible                 bool   `json:"eligible"`
	Reason                   string `json:"reason,omitempty"`
}
