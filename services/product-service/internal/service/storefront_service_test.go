package service

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
)

type storefrontServiceTestRepo struct {
	categories                       []*model.StorefrontCategory
	sectionsBySlug                   map[string][]*model.StorefrontEditorialSection
	featuredBySlug                   map[string][]*model.StorefrontFeaturedProduct
	listEditorialSectionsCalls       int
	listFeaturedProductsCalls        int
	batchEditorialSectionsCalls      int
	batchFeaturedProductsCalls       int
	lastEditorialBatchRequest        []string
	lastFeaturedProductsBatchRequest []string
}

func (r *storefrontServiceTestRepo) ListCategories(_ context.Context) ([]*model.StorefrontCategory, error) {
	return r.categories, nil
}

func (r *storefrontServiceTestRepo) GetCategoryByIdentifier(_ context.Context, identifier string) (*model.StorefrontCategory, error) {
	for _, category := range r.categories {
		if category != nil && category.Slug == identifier {
			return category, nil
		}
	}

	return nil, nil
}

func (r *storefrontServiceTestRepo) ListEditorialSections(_ context.Context, _ string) ([]*model.StorefrontEditorialSection, error) {
	r.listEditorialSectionsCalls++
	return nil, nil
}

func (r *storefrontServiceTestRepo) ListEditorialSectionsByCategorySlugs(_ context.Context, categorySlugs []string) (map[string][]*model.StorefrontEditorialSection, error) {
	r.batchEditorialSectionsCalls++
	r.lastEditorialBatchRequest = append([]string(nil), categorySlugs...)

	result := make(map[string][]*model.StorefrontEditorialSection, len(categorySlugs))
	for _, slug := range categorySlugs {
		result[slug] = r.sectionsBySlug[slug]
	}

	return result, nil
}

func (r *storefrontServiceTestRepo) ListFeaturedProducts(_ context.Context, _ string) ([]*model.StorefrontFeaturedProduct, error) {
	r.listFeaturedProductsCalls++
	return nil, nil
}

func (r *storefrontServiceTestRepo) ListFeaturedProductsByCategorySlugs(_ context.Context, categorySlugs []string) (map[string][]*model.StorefrontFeaturedProduct, error) {
	r.batchFeaturedProductsCalls++
	r.lastFeaturedProductsBatchRequest = append([]string(nil), categorySlugs...)

	result := make(map[string][]*model.StorefrontFeaturedProduct, len(categorySlugs))
	for _, slug := range categorySlugs {
		result[slug] = r.featuredBySlug[slug]
	}

	return result, nil
}

func TestStorefrontServiceGetHomeUsesBatchQueries(t *testing.T) {
	repo := &storefrontServiceTestRepo{
		categories: []*model.StorefrontCategory{
			{
				Slug:         "shop-men",
				DisplayName:  "Shop Men",
				NavLabel:     "Men",
				Status:       "active",
				Hero:         json.RawMessage(`{"variant":"dark-immersive"}`),
				FilterConfig: json.RawMessage(`[]`),
				SEO:          json.RawMessage(`{"title":"Shop Men"}`),
				Aliases:      []string{"Shop Men"},
				CreatedAt:    time.Date(2026, 4, 4, 0, 0, 0, 0, time.UTC),
				UpdatedAt:    time.Date(2026, 4, 4, 0, 0, 0, 0, time.UTC),
			},
			{
				Slug:         "atelier-women",
				DisplayName:  "Atelier Women",
				NavLabel:     "Women",
				Status:       "active",
				Hero:         json.RawMessage(`{"variant":"light-editorial"}`),
				FilterConfig: json.RawMessage(`[]`),
				SEO:          json.RawMessage(`{"title":"Atelier Women"}`),
				Aliases:      []string{"Atelier Women"},
				CreatedAt:    time.Date(2026, 4, 4, 0, 5, 0, 0, time.UTC),
				UpdatedAt:    time.Date(2026, 4, 4, 0, 5, 0, 0, time.UTC),
			},
			{
				Slug:         "smoke-tests",
				DisplayName:  "Smoke Tests",
				NavLabel:     "Smoke Tests",
				Status:       "active",
				Hero:         json.RawMessage(`{}`),
				FilterConfig: json.RawMessage(`[]`),
				SEO:          json.RawMessage(`{}`),
				Aliases:      []string{"smoke-tests"},
				CreatedAt:    time.Date(2026, 4, 4, 0, 10, 0, 0, time.UTC),
				UpdatedAt:    time.Date(2026, 4, 4, 0, 10, 0, 0, time.UTC),
			},
		},
		sectionsBySlug: map[string][]*model.StorefrontEditorialSection{
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
		featuredBySlug: map[string][]*model.StorefrontFeaturedProduct{
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
					},
				},
			},
		},
	}

	svc := NewStorefrontService(repo)

	homeData, err := svc.GetHome(context.Background(), 3)
	if err != nil {
		t.Fatalf("GetHome returned error: %v", err)
	}

	if homeData == nil {
		t.Fatalf("expected storefront home data")
	}
	if len(homeData.Categories) != 2 {
		t.Fatalf("expected 2 home categories after filtering, got %d", len(homeData.Categories))
	}
	if len(homeData.CategoryPages) != 2 {
		t.Fatalf("expected 2 category pages after filtering, got %d", len(homeData.CategoryPages))
	}
	if repo.batchEditorialSectionsCalls != 1 {
		t.Fatalf("expected 1 batch editorial sections call, got %d", repo.batchEditorialSectionsCalls)
	}
	if repo.batchFeaturedProductsCalls != 1 {
		t.Fatalf("expected 1 batch featured products call, got %d", repo.batchFeaturedProductsCalls)
	}
	if repo.listEditorialSectionsCalls != 0 {
		t.Fatalf("expected GetHome not to use singular editorial query, got %d calls", repo.listEditorialSectionsCalls)
	}
	if repo.listFeaturedProductsCalls != 0 {
		t.Fatalf("expected GetHome not to use singular featured query, got %d calls", repo.listFeaturedProductsCalls)
	}
	if len(repo.lastEditorialBatchRequest) != 3 || repo.lastEditorialBatchRequest[0] != "shop-men" || repo.lastEditorialBatchRequest[1] != "atelier-women" || repo.lastEditorialBatchRequest[2] != "smoke-tests" {
		t.Fatalf("unexpected editorial batch request: %#v", repo.lastEditorialBatchRequest)
	}
	if len(homeData.CategoryPages[1].Sections) != 0 {
		t.Fatalf("expected empty sections slice for category without editorial data")
	}
	if len(homeData.CategoryPages[1].FeaturedProducts) != 0 {
		t.Fatalf("expected empty featured products slice for category without products")
	}
	if homeData.Categories[0].Slug != "shop-men" || homeData.Categories[1].Slug != "atelier-women" {
		t.Fatalf("unexpected filtered home categories: %#v", homeData.Categories)
	}
}
