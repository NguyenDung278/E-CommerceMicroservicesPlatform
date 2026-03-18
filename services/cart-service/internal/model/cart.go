package model

// CartItem represents a single item in a user's shopping cart.
type CartItem struct {
	ProductID string  `json:"product_id"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	Quantity  int     `json:"quantity"`
}

// Cart represents a user's shopping cart.
// WHY NO DATABASE TABLE: Carts are ephemeral — they expire after a period
// of inactivity. Redis with TTL is the ideal storage for this use case.
type Cart struct {
	UserID string     `json:"user_id"`
	Items  []CartItem `json:"items"`
	Total  float64    `json:"total"`
}

// CalculateTotal recalculates the cart total from item prices.
func (c *Cart) CalculateTotal() {
	c.Total = 0
	for _, item := range c.Items {
		c.Total += item.Price * float64(item.Quantity)
	}
}
