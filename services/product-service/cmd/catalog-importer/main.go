package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/config"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/database"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/logger"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/importer"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/migrations"
)

func main() {
	var (
		workbookPath string
		mode         string
		timeout      time.Duration
		runMigrate   bool
	)

	flag.StringVar(&workbookPath, "workbook", "", "Path to the catalog workbook (.xlsx)")
	flag.StringVar(&mode, "mode", importer.ModeDryRun, "Import mode: dry-run or commit")
	flag.DurationVar(&timeout, "timeout", 2*time.Minute, "Maximum time allowed for the import transaction")
	flag.BoolVar(&runMigrate, "migrate", true, "Run product-service database migrations before import")
	flag.Parse()

	if strings.TrimSpace(workbookPath) == "" {
		fmt.Fprintln(os.Stderr, "missing required -workbook flag")
		os.Exit(1)
	}

	cfg, err := config.Load("product-service")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load config: %v\n", err)
		os.Exit(1)
	}

	log := logger.New("catalog-importer")
	defer log.Sync()

	db, err := database.NewPostgresDB(cfg.Database)
	if err != nil {
		log.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	if runMigrate {
		if err := database.RunPostgresMigrations(db, migrations.Files); err != nil {
			log.Fatal("failed to run migrations", zap.Error(err))
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	tool := importer.New(db, log)
	report, err := tool.ImportWorkbook(ctx, workbookPath, mode)
	if err != nil {
		if importer.IsValidationError(err) {
			fmt.Fprintf(os.Stderr, "catalog import validation failed:\n%s\n", err)
			os.Exit(1)
		}

		log.Fatal("catalog import failed", zap.Error(err))
	}

	fmt.Printf(
		"catalog import %s succeeded: categories=%d aliases=%d products=%d variants=%d editorial_sections=%d featured_products=%d\n",
		report.Mode,
		report.Categories,
		report.CategoryAliases,
		report.Products,
		report.Variants,
		report.EditorialSections,
		report.FeaturedProducts,
	)
}
