import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sampleCatalogCollections } from "../../shared/sample-catalog-data.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const csvDir = path.join(scriptDir, "csv_data");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function writeCsv(fileName, headers, rows) {
  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvValue(row[header] ?? "")).join(","));
  }

  fs.writeFileSync(path.join(csvDir, fileName), `${lines.join("\n")}\n`, "utf8");
}

function makeStableUuid(prefix, index) {
  return `${prefix}-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function formatTimestamp(offsetMinutes) {
  const baseUtc = Date.UTC(2026, 3, 8, 2, 0 + offsetMinutes, 0);
  const date = new Date(baseUtc);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:00`;
}

function splitStock(total, parts) {
  const safeParts = Math.max(parts, 1);
  const base = Math.floor(total / safeParts);
  const remainder = total % safeParts;

  return Array.from({ length: safeParts }, (_, index) => base + (index < remainder ? 1 : 0));
}

function sanitizeSkuPart(value) {
  return String(value).trim().replace(/\s+/g, "-").toUpperCase();
}

function buildCategories() {
  return sampleCatalogCollections.map((collection, index) => ({
    slug: collection.categorySlug,
    display_name: collection.displayName,
    nav_label: collection.navLabel,
    status: collection.status,
    hero: JSON.stringify(collection.hero),
    filter_config: JSON.stringify(collection.filterConfig),
    seo: JSON.stringify(collection.seo),
    created_at: formatTimestamp(index * 5),
    updated_at: formatTimestamp(index * 5),
  }));
}

function buildAliases() {
  return sampleCatalogCollections.flatMap((collection) =>
    collection.routeAliases.map((alias) => ({
      category_slug: collection.categorySlug,
      alias,
    }))
  );
}

function buildProducts() {
  let productIndex = 1;

  return sampleCatalogCollections.flatMap((collection, collectionIndex) =>
    collection.products.map((product) => ({
      id: makeStableUuid("10000000", productIndex++),
      external_id: product.externalId,
      name: product.name,
      category_slug: collection.categorySlug,
      category: collection.displayName,
      price: product.price,
      stock: product.stock,
      material: product.material,
      merchandising_rank: product.merchandisingRank,
      updated_at: formatTimestamp(collectionIndex * 10 + product.merchandisingRank),
    }))
  );
}

function buildVariants() {
  const rows = [];
  let variantIndex = 1;

  for (const collection of sampleCatalogCollections) {
    for (const product of collection.products) {
      const sizes = product.sizes.length > 0 ? product.sizes : ["OS"];
      const stockDistribution = splitStock(product.stock, sizes.length);

      sizes.forEach((size, sizeIndex) => {
        rows.push({
          id: makeStableUuid("20000000", variantIndex++),
          product_external_id: product.externalId,
          sku: `${product.externalId}-${sanitizeSkuPart(size)}`,
          size,
          color: product.color,
          stock: stockDistribution[sizeIndex] ?? 0,
          price: product.price,
          image_url: product.imageUrl,
        });
      });
    }
  }

  return rows;
}

function buildEditorialSections() {
  const rows = [];
  let editorialIndex = 1;

  for (const collection of sampleCatalogCollections) {
    rows.push({
      id: makeStableUuid("30000000", editorialIndex++),
      category_slug: collection.categorySlug,
      section_type: "hero-banner",
      position: 1,
      payload: JSON.stringify(collection.editorial.heroBanner),
      published: true,
    });
    rows.push({
      id: makeStableUuid("30000000", editorialIndex++),
      category_slug: collection.categorySlug,
      section_type: "product-grid",
      position: 2,
      payload: JSON.stringify({
        columns: 4,
        productIds: collection.products.slice(0, 6).map((product) => product.externalId),
      }),
      published: true,
    });
    rows.push({
      id: makeStableUuid("30000000", editorialIndex++),
      category_slug: collection.categorySlug,
      section_type: "story-block",
      position: 3,
      payload: JSON.stringify(collection.editorial.storyBlock),
      published: true,
    });
  }

  return rows;
}

function buildFeaturedProducts() {
  const rows = [];
  let featuredIndex = 1;

  for (const collection of sampleCatalogCollections) {
    collection.products.forEach((product, index) => {
      rows.push({
        id: makeStableUuid("40000000", featuredIndex++),
        product_external_id: product.externalId,
        category_slug: collection.categorySlug,
        position: index + 1,
      });
    });
  }

  return rows;
}

ensureDir(csvDir);

writeCsv(
  "categories.csv",
  ["slug", "display_name", "nav_label", "status", "hero", "filter_config", "seo", "created_at", "updated_at"],
  buildCategories()
);
writeCsv("category_aliases.csv", ["category_slug", "alias"], buildAliases());
writeCsv(
  "products.csv",
  [
    "id",
    "external_id",
    "name",
    "category_slug",
    "category",
    "price",
    "stock",
    "material",
    "merchandising_rank",
    "updated_at",
  ],
  buildProducts()
);
writeCsv(
  "variants.csv",
  ["id", "product_external_id", "sku", "size", "color", "stock", "price", "image_url"],
  buildVariants()
);
writeCsv(
  "editorial_sections.csv",
  ["id", "category_slug", "section_type", "position", "payload", "published"],
  buildEditorialSections()
);
writeCsv(
  "featured_products.csv",
  ["id", "product_external_id", "category_slug", "position"],
  buildFeaturedProducts()
);

console.log(`Generated CSV sample data in ${csvDir}`);
