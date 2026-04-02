package service

import (
	"strings"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

// normalizeTags trims, lowercases, and de-duplicates product tags while
// preserving first-seen order.
//
// Inputs:
//   - tags is the raw tag slice from the API boundary.
//
// Returns:
//   - the normalized tag slice.
//
// Edge cases:
//   - blank tags are removed.
//
// Side effects:
//   - allocates a new result slice and de-duplication map.
//
// Performance:
//   - O(n) over the tag count with average O(1) set membership checks.
func normalizeTags(tags []string) []string {
	if len(tags) == 0 {
		return []string{}
	}

	seen := make(map[string]struct{}, len(tags))
	normalized := make([]string, 0, len(tags))
	for _, tag := range tags {
		clean := strings.ToLower(strings.TrimSpace(tag))
		if clean == "" {
			continue
		}
		if _, exists := seen[clean]; exists {
			continue
		}
		seen[clean] = struct{}{}
		normalized = append(normalized, clean)
	}

	return normalized
}

// normalizeVariants trims the textual fields of product variants and preserves
// numeric values as supplied.
//
// Inputs:
//   - variants is the raw variant slice from the API boundary.
//
// Returns:
//   - the normalized variant slice.
//
// Edge cases:
//   - empty input returns a non-nil empty slice.
//
// Side effects:
//   - allocates a new result slice.
//
// Performance:
//   - O(n) over the variant count.
func normalizeVariants(variants []dto.ProductVariantRequest) []model.ProductVariant {
	if len(variants) == 0 {
		return []model.ProductVariant{}
	}

	normalized := make([]model.ProductVariant, 0, len(variants))
	for _, variant := range variants {
		normalized = append(normalized, model.ProductVariant{
			SKU:   trimText(variant.SKU),
			Label: trimText(variant.Label),
			Size:  trimText(variant.Size),
			Color: trimText(variant.Color),
			Price: variant.Price,
			Stock: variant.Stock,
		})
	}
	return normalized
}

// resolveStock derives the persisted stock from the base stock and variants.
//
// Inputs:
//   - baseStock is the standalone stock value.
//   - variants is the normalized variant list.
//
// Returns:
//   - the summed variant stock when variants exist.
//   - the base stock otherwise.
//
// Edge cases:
//   - empty variant lists preserve the base stock for non-variant products.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the variant count.
func resolveStock(baseStock int, variants []model.ProductVariant) int {
	if len(variants) == 0 {
		return baseStock
	}

	total := 0
	for _, variant := range variants {
		total += variant.Stock
	}
	return total
}

// normalizeStatus canonicalizes a product status or applies the default active
// status when blank.
//
// Inputs:
//   - value is the raw status string.
//
// Returns:
//   - the canonical lowercase status string.
//   - ErrInvalidStatus when the status is unsupported.
//
// Edge cases:
//   - blank statuses default to `active`.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the input length due to trimming and lowercasing.
func normalizeStatus(value string) (string, error) {
	status := strings.ToLower(strings.TrimSpace(value))
	if status == "" {
		return string(model.ProductStatusActive), nil
	}

	switch status {
	case string(model.ProductStatusDraft), string(model.ProductStatusActive), string(model.ProductStatusInactive):
		return status, nil
	default:
		return "", ErrInvalidStatus
	}
}

// normalizeProductIDs trims, de-duplicates, and preserves first-seen order for
// product id lists.
//
// Inputs:
//   - ids is the raw id slice.
//
// Returns:
//   - the normalized id slice.
//
// Edge cases:
//   - blank ids are removed.
//
// Side effects:
//   - allocates a new result slice and de-duplication map.
//
// Performance:
//   - O(n) over the id count with average O(1) set membership checks.
func normalizeProductIDs(ids []string) []string {
	if len(ids) == 0 {
		return []string{}
	}

	seen := make(map[string]struct{}, len(ids))
	normalized := make([]string, 0, len(ids))
	for _, id := range ids {
		clean := trimText(id)
		if clean == "" {
			continue
		}
		if _, exists := seen[clean]; exists {
			continue
		}

		seen[clean] = struct{}{}
		normalized = append(normalized, clean)
	}

	return normalized
}

// normalizeImageURLs trims, de-duplicates, and orders image URLs with the
// primary fallback URL first when supplied.
//
// Inputs:
//   - urls is the raw secondary image URL list.
//   - fallback is the candidate primary image URL.
//
// Returns:
//   - the normalized image URL slice.
//
// Edge cases:
//   - blank URLs are removed.
//   - duplicate URLs are collapsed while preserving first-seen order.
//
// Side effects:
//   - allocates a new result slice and de-duplication map.
//
// Performance:
//   - O(n) over the number of URLs without allocating the previous temporary
//     combined slice used by the old implementation.
func normalizeImageURLs(urls []string, fallback string) []string {
	normalized := make([]string, 0, len(urls)+1)
	seen := make(map[string]struct{}, len(urls)+1)

	appendImageURL := func(imageURL string) {
		clean := trimText(imageURL)
		if clean == "" {
			return
		}
		if _, exists := seen[clean]; exists {
			return
		}
		seen[clean] = struct{}{}
		normalized = append(normalized, clean)
	}

	appendImageURL(fallback)
	for _, imageURL := range urls {
		appendImageURL(imageURL)
	}

	return normalized
}

// resolvePrimaryImage returns the first normalized image URL as the primary image.
//
// Inputs:
//   - urls is the normalized image URL slice.
//
// Returns:
//   - the primary image URL or an empty string when none exist.
//
// Edge cases:
//   - empty slices produce an empty string.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1).
func resolvePrimaryImage(urls []string) string {
	if len(urls) == 0 {
		return ""
	}

	return urls[0]
}

// normalizeSort canonicalizes supported sort values and applies the default
// `latest` sort otherwise.
//
// Inputs:
//   - value is the raw sort string.
//
// Returns:
//   - the canonical sort value.
//
// Edge cases:
//   - unsupported values fall back to `latest`.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the input length due to trimming and lowercasing.
func normalizeSort(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "price_asc", "price_desc", "popular":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "latest"
	}
}

// trimText trims surrounding whitespace from a free-form text field.
//
// Inputs:
//   - value is the raw text.
//
// Returns:
//   - the trimmed text.
//
// Edge cases:
//   - blank values remain blank.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the input length.
func trimText(value string) string {
	return strings.TrimSpace(value)
}
