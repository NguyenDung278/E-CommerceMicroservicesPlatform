package model

// StockReservationItem is one reserved line item inside an order-scoped stock
// reservation. The pair (order_id, product_id) is unique in the ledger, so the
// same product cannot be reserved twice for one order.
type StockReservationItem struct {
	ProductID string
	Quantity  int
}
