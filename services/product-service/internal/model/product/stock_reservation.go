package model

// StockReservationItem is one reserved line item inside an order-scoped stock
// reservation. The triple (order_id, product_id, sku) is unique in the ledger,
// so the same variant cannot be reserved twice for one order while two
// different variants of one product still get their own hold.
//
// SKU is empty only for products that declare no variants, in which case the
// hold is taken against the product-level stock pool.
type StockReservationItem struct {
	ProductID string
	SKU       string
	Quantity  int
}

// FindVariantIndex returns the position of a sku inside a product's variant
// list, or -1 when the product has no such variant.
//
// Inputs:
//   - variants is the product's declared variant list.
//   - sku identifies the wanted variant.
//
// Returns:
//   - the zero-based index when found.
//   - -1 when the sku is unknown or blank.
//
// Edge cases:
//   - a blank sku never matches, because blank means "product-level stock".
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over a variant list that is small by construction.
func FindVariantIndex(variants []ProductVariant, sku string) int {
	if sku == "" {
		return -1
	}
	for index, variant := range variants {
		if variant.SKU == sku {
			return index
		}
	}
	return -1
}
