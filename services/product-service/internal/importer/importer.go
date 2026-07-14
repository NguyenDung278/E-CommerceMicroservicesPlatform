package importer

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"go.uber.org/zap"
)

const (
	ModeDryRun = "dry-run"
	ModeCommit = "commit"
)

type Workbook struct {
	Categories        []CategoryRow
	CategoryAliases   []CategoryAliasRow
	Products          []ProductRow
	Variants          []VariantRow
	EditorialSections []EditorialSectionRow
	FeaturedProducts  []FeaturedProductRow
}

type CategoryRow struct {
	Slug         string
	DisplayName  string
	NavLabel     string
	Status       string
	Hero         json.RawMessage
	FilterConfig json.RawMessage
	SEO          json.RawMessage
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type CategoryAliasRow struct {
	CategorySlug string
	Alias        string
}

type ProductRow struct {
	ID                string
	ExternalID        string
	Name              string
	CategorySlug      string
	Category          string
	Price             float64
	Stock             int
	Material          string
	MerchandisingRank int
	UpdatedAt         time.Time
}

type VariantRow struct {
	ID                string
	ProductExternalID string
	SKU               string
	Size              string
	Color             string
	Stock             int
	Price             float64
	ImageURL          string
}

type EditorialSectionRow struct {
	ID           string
	CategorySlug string
	SectionType  string
	Position     int
	Payload      json.RawMessage
	Published    bool
}

type FeaturedProductRow struct {
	ID                string
	ProductExternalID string
	CategorySlug      string
	Position          int
}

type ImportReport struct {
	Mode              string
	Categories        int
	CategoryAliases   int
	Products          int
	Variants          int
	EditorialSections int
	FeaturedProducts  int
}

type Importer struct {
	db  *sql.DB
	log *zap.Logger
}

type ValidationErrors struct {
	items []string
}

func (e *ValidationErrors) Add(format string, args ...any) {
	e.items = append(e.items, fmt.Sprintf(format, args...))
}

func (e *ValidationErrors) Empty() bool {
	return len(e.items) == 0
}

func (e *ValidationErrors) Error() string {
	return strings.Join(e.items, "\n")
}

func New(db *sql.DB, log *zap.Logger) *Importer {
	return &Importer{db: db, log: log}
}

func (i *Importer) ImportWorkbook(ctx context.Context, workbookPath string, mode string) (*ImportReport, error) {
	normalizedMode := strings.TrimSpace(strings.ToLower(mode))
	if normalizedMode != ModeDryRun && normalizedMode != ModeCommit {
		return nil, fmt.Errorf("unsupported mode %q", mode)
	}

	workbook, err := LoadWorkbook(workbookPath)
	if err != nil {
		return nil, err
	}

	tx, err := i.db.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to start import transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if err := i.applyWorkbook(ctx, tx, workbook); err != nil {
		return nil, err
	}

	report := &ImportReport{
		Mode:              normalizedMode,
		Categories:        len(workbook.Categories),
		CategoryAliases:   len(workbook.CategoryAliases),
		Products:          len(workbook.Products),
		Variants:          len(workbook.Variants),
		EditorialSections: len(workbook.EditorialSections),
		FeaturedProducts:  len(workbook.FeaturedProducts),
	}

	if normalizedMode == ModeDryRun {
		i.log.Info("catalog import dry-run completed",
			zap.Int("categories", report.Categories),
			zap.Int("aliases", report.CategoryAliases),
			zap.Int("products", report.Products),
			zap.Int("variants", report.Variants),
			zap.Int("editorial_sections", report.EditorialSections),
			zap.Int("featured_products", report.FeaturedProducts),
		)
		return report, nil
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit import transaction: %w", err)
	}

	i.log.Info("catalog import committed",
		zap.Int("categories", report.Categories),
		zap.Int("aliases", report.CategoryAliases),
		zap.Int("products", report.Products),
		zap.Int("variants", report.Variants),
		zap.Int("editorial_sections", report.EditorialSections),
		zap.Int("featured_products", report.FeaturedProducts),
	)
	return report, nil
}

func (i *Importer) applyWorkbook(ctx context.Context, tx *sql.Tx, workbook *Workbook) error {
	if err := upsertCategories(ctx, tx, workbook.Categories); err != nil {
		return err
	}
	if err := upsertCategoryAliases(ctx, tx, workbook.CategoryAliases); err != nil {
		return err
	}
	if err := upsertProducts(ctx, tx, workbook.Products, workbook.Variants); err != nil {
		return err
	}
	if err := upsertEditorialSections(ctx, tx, workbook.EditorialSections); err != nil {
		return err
	}
	if err := upsertFeaturedProducts(ctx, tx, workbook.FeaturedProducts); err != nil {
		return err
	}

	return nil
}

func IsValidationError(err error) bool {
	var validation *ValidationErrors
	return errors.As(err, &validation)
}
