import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as XLSX from "xlsx";

import {
  callout,
  calloutMetrics,
  categoryFilters,
  categoryPageProducts,
  categoryPages,
  categoryTiles,
  footerLinks,
  hero,
  navItems,
  products,
  siteMeta,
} from "./homeWorkbookSeed.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const outputDir = path.join(rootDir, "public", "content");
const workbookPath = path.join(outputDir, "stitchfix-home.xlsx");
const csvPath = path.join(outputDir, "stitchfix-home.csv");

function ensureOutputDir() {
  fs.mkdirSync(outputDir, { recursive: true });
}

function buildFlatCsvRows() {
  return [
    ...siteMeta.map((row) => ({ record_type: "site_meta", ...row })),
    ...navItems.map((row) => ({ record_type: "nav_item", ...row })),
    ...hero.map((row) => ({ record_type: "hero", ...row })),
    ...categoryTiles.map((row) => ({ record_type: "category_tile", ...row })),
    ...callout.map((row) => ({ record_type: "callout", ...row })),
    ...calloutMetrics.map((row) => ({ record_type: "metric", ...row })),
    ...products.map((row) => ({ record_type: "product", ...row })),
    ...footerLinks.map((row) => ({ record_type: "footer_link", ...row })),
    ...categoryPages.map((row) => ({ record_type: "category_page", ...row })),
    ...categoryFilters.map((row) => ({ record_type: "category_filter", ...row })),
    ...categoryPageProducts.map((row) => ({
      record_type: "category_page_product",
      ...row,
    })),
  ];
}

function writeWorkbook() {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(siteMeta),
    "site_meta"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(navItems),
    "nav_items"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(hero),
    "hero"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(categoryTiles),
    "category_tiles"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(callout),
    "callout"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(calloutMetrics),
    "callout_metrics"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(products),
    "products"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(categoryPages),
    "category_pages"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(categoryFilters),
    "category_filters"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(categoryPageProducts),
    "category_page_products"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(footerLinks),
    "footer_links"
  );

  XLSX.writeFile(workbook, workbookPath);
}

function writeCsv() {
  const csvWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    csvWorkbook,
    XLSX.utils.json_to_sheet(buildFlatCsvRows()),
    "records"
  );

  const csvSheet = csvWorkbook.Sheets.records;
  if (!csvSheet) {
    throw new Error("records sheet is missing");
  }

  const csv = XLSX.utils.sheet_to_csv(csvSheet);
  fs.writeFileSync(csvPath, csv, "utf8");
}

ensureOutputDir();
writeWorkbook();
writeCsv();

console.log(`Generated ${workbookPath}`);
console.log(`Generated ${csvPath}`);
