package search

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

type ElasticsearchIndex struct {
	baseURL    string
	index      string
	username   string
	password   string
	apiKey     string
	httpClient *http.Client
}

func NewElasticsearchIndex(cfg config.SearchConfig) (*ElasticsearchIndex, error) {
	baseURL := strings.TrimRight(strings.TrimSpace(cfg.Endpoint), "/")
	if baseURL == "" {
		return nil, fmt.Errorf("search endpoint is required")
	}

	index := strings.TrimSpace(cfg.Index)
	if index == "" {
		index = "products"
	}

	timeout := time.Duration(cfg.RequestTimeout) * time.Second
	if timeout <= 0 {
		timeout = 5 * time.Second
	}

	return &ElasticsearchIndex{
		baseURL:  baseURL,
		index:    index,
		username: strings.TrimSpace(cfg.Username),
		password: cfg.Password,
		apiKey:   strings.TrimSpace(cfg.APIKey),
		httpClient: &http.Client{
			Timeout:   timeout,
			Transport: appobs.WrapHTTPTransport(http.DefaultTransport),
		},
	}, nil
}

func (i *ElasticsearchIndex) EnsureIndex(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, i.baseURL+"/"+i.index, bytes.NewReader([]byte(productIndexMapping)))
	if err != nil {
		return fmt.Errorf("failed to build ensure-index request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	i.applyAuth(req)

	resp, err := i.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to ensure Elasticsearch index: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated {
		return nil
	}
	if resp.StatusCode == http.StatusBadRequest {
		var envelope map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&envelope); err == nil {
			if errValue, ok := envelope["error"].(map[string]any); ok {
				if reason, ok := errValue["type"].(string); ok && reason == "resource_already_exists_exception" {
					return nil
				}
			}
		}
	}

	body, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("failed to ensure Elasticsearch index: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
}

func (i *ElasticsearchIndex) Reindex(ctx context.Context, products []*model.Product) error {
	if err := i.deleteAllDocuments(ctx); err != nil {
		return err
	}
	if len(products) == 0 {
		return nil
	}

	var body bytes.Buffer
	encoder := json.NewEncoder(&body)
	for _, product := range products {
		if err := encoder.Encode(map[string]any{
			"index": map[string]any{
				"_index": i.index,
				"_id":    product.ID,
			},
		}); err != nil {
			return fmt.Errorf("failed to encode bulk metadata: %w", err)
		}
		if err := encoder.Encode(buildDocument(product)); err != nil {
			return fmt.Errorf("failed to encode product document: %w", err)
		}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, i.baseURL+"/_bulk?refresh=true", &body)
	if err != nil {
		return fmt.Errorf("failed to build bulk reindex request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-ndjson")
	i.applyAuth(req)

	resp, err := i.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to reindex products: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		payload, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to reindex products: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(payload)))
	}

	return nil
}

func (i *ElasticsearchIndex) Index(ctx context.Context, product *model.Product) error {
	payload, err := json.Marshal(buildDocument(product))
	if err != nil {
		return fmt.Errorf("failed to marshal product document: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, fmt.Sprintf("%s/%s/_doc/%s?refresh=true", i.baseURL, i.index, product.ID), bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("failed to build index request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	i.applyAuth(req)

	resp, err := i.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to index product: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to index product: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	return nil
}

func (i *ElasticsearchIndex) Delete(ctx context.Context, productID string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, fmt.Sprintf("%s/%s/_doc/%s?refresh=true", i.baseURL, i.index, productID), nil)
	if err != nil {
		return fmt.Errorf("failed to build delete request: %w", err)
	}

	i.applyAuth(req)
	resp, err := i.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete product document: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to delete product document: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	return nil
}

func (i *ElasticsearchIndex) Search(ctx context.Context, query dto.ListProductsQuery) ([]string, int64, error) {
	page := query.Page
	if page < 1 {
		page = 1
	}
	limit := query.Limit
	if limit < 1 || limit > 100 {
		limit = 20
	}

	from := (page - 1) * limit
	body, err := json.Marshal(buildSearchRequest(query, from, limit))
	if err != nil {
		return nil, 0, fmt.Errorf("failed to build search body: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/%s/_search", i.baseURL, i.index), bytes.NewReader(body))
	if err != nil {
		return nil, 0, fmt.Errorf("failed to build Elasticsearch search request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	i.applyAuth(req)

	resp, err := i.httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to search products: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		payload, _ := io.ReadAll(resp.Body)
		return nil, 0, fmt.Errorf("failed to search products: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(payload)))
	}

	var searchResponse elasticsearchSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchResponse); err != nil {
		return nil, 0, fmt.Errorf("failed to decode search response: %w", err)
	}

	ids := make([]string, 0, len(searchResponse.Hits.Hits))
	for _, hit := range searchResponse.Hits.Hits {
		ids = append(ids, hit.ID)
	}

	return ids, searchResponse.Hits.Total.Value, nil
}

func (i *ElasticsearchIndex) deleteAllDocuments(ctx context.Context) error {
	deleteAll := `{"query":{"match_all":{}}}`
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/%s/_delete_by_query?refresh=true", i.baseURL, i.index), strings.NewReader(deleteAll))
	if err != nil {
		return fmt.Errorf("failed to build delete-by-query request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	i.applyAuth(req)

	resp, err := i.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to clear search index: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to clear search index: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	return nil
}

func (i *ElasticsearchIndex) applyAuth(req *http.Request) {
	if i.apiKey != "" {
		req.Header.Set("Authorization", "ApiKey "+i.apiKey)
		return
	}
	if i.username != "" || i.password != "" {
		req.SetBasicAuth(i.username, i.password)
	}
}

func buildDocument(product *model.Product) map[string]any {
	return map[string]any{
		"id":             product.ID,
		"name":           product.Name,
		"description":    product.Description,
		"category":       product.Category,
		"brand":          product.Brand,
		"tags":           product.Tags,
		"status":         product.Status,
		"sku":            product.SKU,
		"price":          product.Price,
		"stock":          product.Stock,
		"created_at":     product.CreatedAt,
		"updated_at":     product.UpdatedAt,
		"variant_sizes":  collectVariantSizes(product.Variants),
		"variant_colors": collectVariantColors(product.Variants),
	}
}

func buildSearchRequest(query dto.ListProductsQuery, from, limit int) map[string]any {
	filters := make([]map[string]any, 0, 8)
	if category := strings.TrimSpace(query.Category); category != "" {
		filters = append(filters, map[string]any{"term": map[string]any{"category": category}})
	}
	if brand := strings.TrimSpace(query.Brand); brand != "" {
		filters = append(filters, map[string]any{"term": map[string]any{"brand": brand}})
	}
	if tag := strings.TrimSpace(query.Tag); tag != "" {
		filters = append(filters, map[string]any{"term": map[string]any{"tags": tag}})
	}
	if status := strings.TrimSpace(query.Status); status != "" {
		filters = append(filters, map[string]any{"term": map[string]any{"status": status}})
	}
	if query.MinPrice > 0 || query.MaxPrice > 0 {
		priceRange := map[string]any{}
		if query.MinPrice > 0 {
			priceRange["gte"] = query.MinPrice
		}
		if query.MaxPrice > 0 {
			priceRange["lte"] = query.MaxPrice
		}
		filters = append(filters, map[string]any{"range": map[string]any{"price": priceRange}})
	}
	if size := strings.TrimSpace(query.Size); size != "" {
		filters = append(filters, map[string]any{"term": map[string]any{"variant_sizes": size}})
	}
	if color := strings.TrimSpace(query.Color); color != "" {
		filters = append(filters, map[string]any{"term": map[string]any{"variant_colors": color}})
	}

	sorts := []map[string]any{{"created_at": map[string]any{"order": "desc"}}}
	switch strings.TrimSpace(query.Sort) {
	case "price_asc":
		sorts = []map[string]any{{"price": map[string]any{"order": "asc"}}, {"created_at": map[string]any{"order": "desc"}}}
	case "price_desc":
		sorts = []map[string]any{{"price": map[string]any{"order": "desc"}}, {"created_at": map[string]any{"order": "desc"}}}
	}

	return map[string]any{
		"from":             from,
		"size":             limit,
		"track_total_hits": true,
		"_source":          false,
		"query": map[string]any{
			"bool": map[string]any{
				"must": []map[string]any{{
					"multi_match": map[string]any{
						"query":     strings.TrimSpace(query.Search),
						"fields":    []string{"name^4", "brand^3", "category^2", "tags^2", "sku^3", "description"},
						"fuzziness": "AUTO",
					},
				}},
				"filter": filters,
			},
		},
		"sort": sorts,
	}
}

func collectVariantSizes(variants []model.ProductVariant) []string {
	values := make([]string, 0, len(variants))
	seen := map[string]struct{}{}
	for _, variant := range variants {
		value := strings.TrimSpace(variant.Size)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		values = append(values, value)
	}
	return values
}

func collectVariantColors(variants []model.ProductVariant) []string {
	values := make([]string, 0, len(variants))
	seen := map[string]struct{}{}
	for _, variant := range variants {
		value := strings.TrimSpace(variant.Color)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		values = append(values, value)
	}
	return values
}

type elasticsearchSearchResponse struct {
	Hits struct {
		Total struct {
			Value int64 `json:"value"`
		} `json:"total"`
		Hits []struct {
			ID string `json:"_id"`
		} `json:"hits"`
	} `json:"hits"`
}

const productIndexMapping = `{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "name": { "type": "text" },
      "description": { "type": "text" },
      "category": { "type": "keyword" },
      "brand": { "type": "keyword" },
      "tags": { "type": "keyword" },
      "status": { "type": "keyword" },
      "sku": { "type": "keyword" },
      "price": { "type": "double" },
      "stock": { "type": "integer" },
      "created_at": { "type": "date" },
      "updated_at": { "type": "date" },
      "variant_sizes": { "type": "keyword" },
      "variant_colors": { "type": "keyword" }
    }
  }
}`
