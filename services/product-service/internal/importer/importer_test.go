package importer

import (
	"path/filepath"
	"runtime"
	"testing"
)

func TestLoadWorkbookParsesSampleWorkbook(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("failed to resolve caller path")
	}

	workbookPath := filepath.Join(
		filepath.Dir(filename),
		"..", "..", "..", "..",
		"artifacts", "import-templates", "catalog-import-sample-workbook.xlsx",
	)

	workbook, err := LoadWorkbook(workbookPath)
	if err != nil {
		t.Fatalf("expected sample workbook to parse, got error: %v", err)
	}

	if len(workbook.Categories) != 2 {
		t.Fatalf("expected 2 categories, got %d", len(workbook.Categories))
	}
	if len(workbook.Products) != 3 {
		t.Fatalf("expected 3 products, got %d", len(workbook.Products))
	}
	if len(workbook.Variants) != 3 {
		t.Fatalf("expected 3 variants, got %d", len(workbook.Variants))
	}
	if len(workbook.EditorialSections) != 3 {
		t.Fatalf("expected 3 editorial sections, got %d", len(workbook.EditorialSections))
	}
	if workbook.Products[0].ExternalID != "SM-001" {
		t.Fatalf("expected first product external_id to be SM-001, got %q", workbook.Products[0].ExternalID)
	}
}
