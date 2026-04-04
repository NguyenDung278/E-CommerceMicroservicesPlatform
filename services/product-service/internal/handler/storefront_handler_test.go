package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/service"
)

type fakeStorefrontRepo struct {
	categories       []*model.StorefrontCategory
	categoryByLookup map[string]*model.StorefrontCategory
	sections         map[string][]*model.StorefrontEditorialSection
	featured         map[string][]*model.StorefrontFeaturedProduct
}

func (r *fakeStorefrontRepo) ListCategories(_ context.Context) ([]*model.StorefrontCategory, error) {
	if r.categories == nil {
		return []*model.StorefrontCategory{}, nil
	}
	return r.categories, nil
}

func (r *fakeStorefrontRepo) GetCategoryByIdentifier(_ context.Context, identifier string) (*model.StorefrontCategory, error) {
	if r.categoryByLookup == nil {
		return nil, nil
	}
	return r.categoryByLookup[identifier], nil
}

func (r *fakeStorefrontRepo) ListEditorialSections(_ context.Context, categorySlug string) ([]*model.StorefrontEditorialSection, error) {
	return r.sections[categorySlug], nil
}

func (r *fakeStorefrontRepo) ListEditorialSectionsByCategorySlugs(_ context.Context, categorySlugs []string) (map[string][]*model.StorefrontEditorialSection, error) {
	sectionsBySlug := make(map[string][]*model.StorefrontEditorialSection, len(categorySlugs))
	for _, slug := range categorySlugs {
		sectionsBySlug[slug] = r.sections[slug]
	}

	return sectionsBySlug, nil
}

func (r *fakeStorefrontRepo) ListFeaturedProducts(_ context.Context, categorySlug string) ([]*model.StorefrontFeaturedProduct, error) {
	return r.featured[categorySlug], nil
}

func (r *fakeStorefrontRepo) ListFeaturedProductsByCategorySlugs(_ context.Context, categorySlugs []string) (map[string][]*model.StorefrontFeaturedProduct, error) {
	featuredBySlug := make(map[string][]*model.StorefrontFeaturedProduct, len(categorySlugs))
	for _, slug := range categorySlugs {
		featuredBySlug[slug] = r.featured[slug]
	}

	return featuredBySlug, nil
}

func TestStorefrontHandlerListCategories(t *testing.T) {
	e := echo.New()
	handler := NewStorefrontHandler(service.NewStorefrontService(&fakeStorefrontRepo{
		categories: []*model.StorefrontCategory{
			{
				Slug:         "shop-men",
				DisplayName:  "Shop Men",
				NavLabel:     "Men",
				Status:       "active",
				Hero:         json.RawMessage(`{"variant":"dark-immersive"}`),
				FilterConfig: json.RawMessage(`[]`),
				SEO:          json.RawMessage(`{"title":"Shop Men"}`),
				Aliases:      []string{"Shop Men", "men"},
				CreatedAt:    time.Date(2026, 4, 3, 8, 0, 0, 0, time.UTC),
				UpdatedAt:    time.Date(2026, 4, 3, 8, 0, 0, 0, time.UTC),
			},
		},
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/storefront/categories", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := handler.ListCategories(c); err != nil {
		t.Fatalf("ListCategories returned error: %v", err)
	}

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var envelope struct {
		Success bool                       `json:"success"`
		Data    []model.StorefrontCategory `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if !envelope.Success {
		t.Fatalf("expected success response")
	}
	if len(envelope.Data) != 1 {
		t.Fatalf("expected 1 category, got %d", len(envelope.Data))
	}
	if envelope.Data[0].Slug != "shop-men" {
		t.Fatalf("expected slug shop-men, got %q", envelope.Data[0].Slug)
	}
}

func TestStorefrontHandlerGetHome(t *testing.T) {
	e := echo.New()
	repo := &fakeStorefrontRepo{
		categories: []*model.StorefrontCategory{
			{
				Slug:         "shop-men",
				DisplayName:  "Shop Men",
				NavLabel:     "Men",
				Status:       "active",
				Hero:         json.RawMessage(`{"variant":"dark-immersive"}`),
				FilterConfig: json.RawMessage(`[]`),
				SEO:          json.RawMessage(`{"title":"Shop Men"}`),
				Aliases:      []string{"Shop Men", "men"},
				CreatedAt:    time.Date(2026, 4, 3, 8, 0, 0, 0, time.UTC),
				UpdatedAt:    time.Date(2026, 4, 3, 8, 0, 0, 0, time.UTC),
			},
			{
				Slug:         "atelier-women",
				DisplayName:  "Atelier Women",
				NavLabel:     "Women",
				Status:       "active",
				Hero:         json.RawMessage(`{"variant":"light-editorial"}`),
				FilterConfig: json.RawMessage(`[]`),
				SEO:          json.RawMessage(`{"title":"Atelier Women"}`),
				Aliases:      []string{"Atelier Women", "women"},
				CreatedAt:    time.Date(2026, 4, 3, 8, 5, 0, 0, time.UTC),
				UpdatedAt:    time.Date(2026, 4, 3, 8, 5, 0, 0, time.UTC),
			},
		},
		sections: map[string][]*model.StorefrontEditorialSection{
			"shop-men": {
				{
					ID:           "section-1",
					CategorySlug: "shop-men",
					SectionType:  "hero-banner",
					Position:     1,
					Payload:      json.RawMessage(`{"title":"Spring Drop"}`),
					Published:    true,
				},
			},
			"atelier-women": {
				{
					ID:           "section-2",
					CategorySlug: "atelier-women",
					SectionType:  "story-block",
					Position:     1,
					Payload:      json.RawMessage(`{"heading":"Craft notes"}`),
					Published:    true,
				},
			},
		},
		featured: map[string][]*model.StorefrontFeaturedProduct{
			"shop-men": {
				{
					ID:                "featured-1",
					ProductExternalID: "SM-001",
					CategorySlug:      "shop-men",
					Position:          1,
					Product: &model.StorefrontProduct{
						ID:         "product-1",
						ExternalID: "SM-001",
						Name:       "Linen Shirt",
						Price:      129.99,
						Material:   "Italian Linen",
						ImageURL:   "https://example.com/linen-shirt.jpg",
					},
				},
			},
		},
	}
	handler := NewStorefrontHandler(service.NewStorefrontService(repo))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/storefront/home?limit=1", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := handler.GetHome(c); err != nil {
		t.Fatalf("GetHome returned error: %v", err)
	}

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var envelope struct {
		Success bool                 `json:"success"`
		Data    model.StorefrontHome `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if !envelope.Success {
		t.Fatalf("expected success response")
	}
	if len(envelope.Data.Categories) != 1 {
		t.Fatalf("expected 1 category, got %d", len(envelope.Data.Categories))
	}
	if len(envelope.Data.CategoryPages) != 1 {
		t.Fatalf("expected 1 category page, got %d", len(envelope.Data.CategoryPages))
	}
	if envelope.Data.CategoryPages[0].Category == nil || envelope.Data.CategoryPages[0].Category.Slug != "shop-men" {
		t.Fatalf("expected first category page slug shop-men")
	}
}

func TestStorefrontHandlerGetHomeRejectsInvalidLimit(t *testing.T) {
	e := echo.New()
	handler := NewStorefrontHandler(service.NewStorefrontService(&fakeStorefrontRepo{}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/storefront/home?limit=0", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := handler.GetHome(c); err != nil {
		t.Fatalf("GetHome returned error: %v", err)
	}

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
	}
}

func TestStorefrontHandlerGetCategoryPageNotFound(t *testing.T) {
	e := echo.New()
	handler := NewStorefrontHandler(service.NewStorefrontService(&fakeStorefrontRepo{}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/storefront/categories/missing", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("identifier")
	c.SetParamValues("missing")

	if err := handler.GetCategoryPage(c); err != nil {
		t.Fatalf("GetCategoryPage returned error: %v", err)
	}

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d", http.StatusNotFound, rec.Code)
	}
}

func TestStorefrontHandlerGetCategoryPage(t *testing.T) {
	e := echo.New()
	repo := &fakeStorefrontRepo{
		categoryByLookup: map[string]*model.StorefrontCategory{
			"Shop Men": {
				Slug:         "shop-men",
				DisplayName:  "Shop Men",
				NavLabel:     "Men",
				Status:       "active",
				Hero:         json.RawMessage(`{"variant":"dark-immersive"}`),
				FilterConfig: json.RawMessage(`[{"key":"size","kind":"sizes"}]`),
				SEO:          json.RawMessage(`{"title":"Shop Men"}`),
				Aliases:      []string{"Shop Men", "men"},
				CreatedAt:    time.Date(2026, 4, 3, 8, 0, 0, 0, time.UTC),
				UpdatedAt:    time.Date(2026, 4, 3, 8, 0, 0, 0, time.UTC),
			},
		},
		sections: map[string][]*model.StorefrontEditorialSection{
			"shop-men": {
				{
					ID:           "section-1",
					CategorySlug: "shop-men",
					SectionType:  "hero-banner",
					Position:     1,
					Payload:      json.RawMessage(`{"title":"Spring Drop"}`),
					Published:    true,
				},
			},
		},
		featured: map[string][]*model.StorefrontFeaturedProduct{
			"shop-men": {
				{
					ID:                "featured-1",
					ProductExternalID: "SM-001",
					CategorySlug:      "shop-men",
					Position:          1,
					Product: &model.StorefrontProduct{
						ID:         "product-1",
						ExternalID: "SM-001",
						Name:       "Linen Shirt",
						Price:      129.99,
						Material:   "Italian Linen",
						ImageURL:   "https://example.com/linen-shirt.jpg",
					},
				},
			},
		},
	}
	handler := NewStorefrontHandler(service.NewStorefrontService(repo))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/storefront/categories/Shop%20Men", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("identifier")
	c.SetParamValues("Shop Men")

	if err := handler.GetCategoryPage(c); err != nil {
		t.Fatalf("GetCategoryPage returned error: %v", err)
	}

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var envelope struct {
		Success bool                         `json:"success"`
		Data    model.StorefrontCategoryPage `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if !envelope.Success {
		t.Fatalf("expected success response")
	}
	if envelope.Data.Category == nil || envelope.Data.Category.Slug != "shop-men" {
		t.Fatalf("expected storefront category shop-men")
	}
	if len(envelope.Data.Sections) != 1 {
		t.Fatalf("expected 1 section, got %d", len(envelope.Data.Sections))
	}
	if len(envelope.Data.FeaturedProducts) != 1 {
		t.Fatalf("expected 1 featured product, got %d", len(envelope.Data.FeaturedProducts))
	}
}
