package service

import (
	"bytes"
	"context"
	"errors"
	"strings"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/repository"
)

var ErrStorefrontCategoryNotFound = errors.New("storefront category not found")

const (
	defaultStorefrontHomeLimit = 4
	maxStorefrontHomeLimit     = 8
)

// StorefrontService orchestrates public storefront category/editorial reads.
type StorefrontService struct {
	repo repository.StorefrontRepository
}

// NewStorefrontService wires storefront read dependencies.
func NewStorefrontService(repo repository.StorefrontRepository) *StorefrontService {
	return &StorefrontService{repo: repo}
}

// ListCategories returns the active storefront categories visible to public
// category/editorial pages.
func (s *StorefrontService) ListCategories(ctx context.Context) ([]*model.StorefrontCategory, error) {
	categories, err := s.repo.ListCategories(ctx)
	if err != nil {
		return nil, err
	}
	if categories == nil {
		return []*model.StorefrontCategory{}, nil
	}

	return categories, nil
}

// GetHome aggregates the category pages used by the storefront home so the
// frontend can render without a categories + N detail waterfall.
func (s *StorefrontService) GetHome(ctx context.Context, limit int) (*model.StorefrontHome, error) {
	categories, err := s.ListCategories(ctx)
	if err != nil {
		return nil, err
	}

	effectiveLimit := sanitizeStorefrontHomeLimit(limit)
	if len(categories) > effectiveLimit {
		categories = categories[:effectiveLimit]
	}

	categorySlugs := make([]string, 0, len(categories))
	for _, category := range categories {
		if category == nil {
			continue
		}
		categorySlugs = append(categorySlugs, category.Slug)
	}

	sectionsBySlug, err := s.repo.ListEditorialSectionsByCategorySlugs(ctx, categorySlugs)
	if err != nil {
		return nil, err
	}

	featuredProductsBySlug, err := s.repo.ListFeaturedProductsByCategorySlugs(ctx, categorySlugs)
	if err != nil {
		return nil, err
	}

	pages := make([]*model.StorefrontCategoryPage, 0, len(categories))
	homeCategories := make([]*model.StorefrontCategory, 0, len(categories))
	for _, category := range categories {
		if category == nil {
			continue
		}

		sections := sectionsBySlug[category.Slug]
		if sections == nil {
			sections = []*model.StorefrontEditorialSection{}
		}

		featuredProducts := featuredProductsBySlug[category.Slug]
		if featuredProducts == nil {
			featuredProducts = []*model.StorefrontFeaturedProduct{}
		}
		if !isStorefrontHomeCategory(category, sections, featuredProducts) {
			continue
		}

		homeCategories = append(homeCategories, category)
		pages = append(pages, &model.StorefrontCategoryPage{
			Category:         category,
			Sections:         sections,
			FeaturedProducts: featuredProducts,
		})
	}

	return &model.StorefrontHome{
		Categories:    homeCategories,
		CategoryPages: pages,
	}, nil
}

// GetCategoryPage resolves one category by slug or alias and loads the
// editorial sections plus featured products used by the storefront.
func (s *StorefrontService) GetCategoryPage(ctx context.Context, identifier string) (*model.StorefrontCategoryPage, error) {
	normalizedIdentifier := strings.TrimSpace(identifier)
	if normalizedIdentifier == "" {
		return nil, ErrStorefrontCategoryNotFound
	}

	category, err := s.repo.GetCategoryByIdentifier(ctx, normalizedIdentifier)
	if err != nil {
		return nil, err
	}
	if category == nil {
		return nil, ErrStorefrontCategoryNotFound
	}

	return s.buildCategoryPage(ctx, category)
}

func (s *StorefrontService) buildCategoryPage(ctx context.Context, category *model.StorefrontCategory) (*model.StorefrontCategoryPage, error) {
	sections, err := s.repo.ListEditorialSections(ctx, category.Slug)
	if err != nil {
		return nil, err
	}

	featuredProducts, err := s.repo.ListFeaturedProducts(ctx, category.Slug)
	if err != nil {
		return nil, err
	}

	if sections == nil {
		sections = []*model.StorefrontEditorialSection{}
	}
	if featuredProducts == nil {
		featuredProducts = []*model.StorefrontFeaturedProduct{}
	}

	return &model.StorefrontCategoryPage{
		Category:         category,
		Sections:         sections,
		FeaturedProducts: featuredProducts,
	}, nil
}

func sanitizeStorefrontHomeLimit(limit int) int {
	if limit <= 0 {
		return defaultStorefrontHomeLimit
	}
	if limit > maxStorefrontHomeLimit {
		return maxStorefrontHomeLimit
	}

	return limit
}

func isStorefrontHomeCategory(
	category *model.StorefrontCategory,
	sections []*model.StorefrontEditorialSection,
	featuredProducts []*model.StorefrontFeaturedProduct,
) bool {
	if category == nil {
		return false
	}
	if len(sections) > 0 || len(featuredProducts) > 0 {
		return true
	}

	hero := bytes.TrimSpace(category.Hero)
	if len(hero) == 0 || bytes.Equal(hero, []byte("null")) {
		return false
	}

	return !bytes.Equal(hero, []byte("{}"))
}
