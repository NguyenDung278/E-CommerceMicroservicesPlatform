import { fileURLToPath } from "node:url"

import { syncWorkbookProductBatch } from "../dev/workbook-sync.js"

const workbookCsvPath = fileURLToPath(new URL("../public/content/stitchfix-home.csv", import.meta.url))
const workbookXlsxPath = fileURLToPath(new URL("../public/content/stitchfix-home.xlsx", import.meta.url))
const defaultApiBaseUrl = "http://127.0.0.1:8080"
const defaultLimit = 100
const workbookCategoryMatchers = new Set([
  "shop men",
  "men",
  "nam",
  "atelier men",
  "men atelier",
  "shop women",
  "women",
  "nu",
  "atelier women",
  "women atelier",
  "footwear",
  "shoes",
  "giay",
  "atelier footwear",
  "footwear atelier",
  "accessories",
  "accessory",
  "phu kien",
  "atelier accessories",
  "accessories atelier",
])

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeLookupValue(value) {
  return normalizeText(value).toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ")
}

function normalizeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function normalizeVariant(value) {
  const variant = typeof value === "object" && value !== null ? value : {}

  return {
    sku: normalizeText(variant.sku),
    label: normalizeText(variant.label),
    size: normalizeText(variant.size) || undefined,
    color: normalizeText(variant.color) || undefined,
    price: normalizeNumber(variant.price),
    stock: Math.max(0, Math.trunc(normalizeNumber(variant.stock))),
  }
}

function normalizeProduct(value) {
  const product = typeof value === "object" && value !== null ? value : {}

  return {
    id: normalizeText(product.id),
    name: normalizeText(product.name),
    description: normalizeText(product.description),
    price: normalizeNumber(product.price),
    stock: Math.max(0, Math.trunc(normalizeNumber(product.stock))),
    category: normalizeText(product.category),
    brand: normalizeText(product.brand),
    tags: Array.isArray(product.tags)
      ? product.tags.filter((tag) => typeof tag === "string" && tag.trim()).map((tag) => tag.trim())
      : [],
    status: normalizeText(product.status),
    sku: normalizeText(product.sku),
    variants: Array.isArray(product.variants) ? product.variants.map((variant) => normalizeVariant(variant)) : [],
    image_url: normalizeText(product.image_url),
    image_urls: Array.isArray(product.image_urls)
      ? product.image_urls
          .filter((entry) => typeof entry === "string" && entry.trim())
          .map((entry) => entry.trim())
      : [],
    created_at: normalizeText(product.created_at),
    updated_at: normalizeText(product.updated_at),
  }
}

function canSyncProductToWorkbook(product) {
  return workbookCategoryMatchers.has(normalizeLookupValue(product.category))
}

async function fetchProductsPage(apiBaseUrl, status, limit, cursor) {
  const url = new URL("/api/v1/products", apiBaseUrl)
  url.searchParams.set("limit", String(limit))
  if (status) {
    url.searchParams.set("status", status)
  }
  if (cursor) {
    url.searchParams.set("cursor", cursor)
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Khong the tai danh sach product live tu ${url}. HTTP ${response.status}.`)
  }

  const payload = await response.json()
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.data)) {
    throw new Error("Product API tra ve du lieu khong hop le cho luong sync workbook.")
  }

  return {
    products: payload.data.map((entry) => normalizeProduct(entry)),
    nextCursor:
      payload.meta && typeof payload.meta === "object" && typeof payload.meta.next_cursor === "string"
        ? payload.meta.next_cursor
        : "",
    hasNext:
      Boolean(payload.meta && typeof payload.meta === "object" && payload.meta.has_next === true),
  }
}

async function fetchAllProducts(apiBaseUrl, status, limit) {
  const products = []
  let cursor = ""

  for (;;) {
    const page = await fetchProductsPage(apiBaseUrl, status, limit, cursor)
    products.push(...page.products)

    if (!page.hasNext || !page.nextCursor) {
      return products
    }

    cursor = page.nextCursor
  }
}

async function main() {
  const apiBaseUrl = normalizeText(process.env.STOREFRONT_API_BASE_URL) || defaultApiBaseUrl
  const status = normalizeText(process.env.STOREFRONT_SYNC_PRODUCT_STATUS) || "active"
  const requestedLimit = Math.trunc(normalizeNumber(process.env.STOREFRONT_SYNC_PRODUCT_LIMIT))
  const limit = requestedLimit > 0 ? requestedLimit : defaultLimit

  const liveProducts = await fetchAllProducts(apiBaseUrl, status, limit)
  const syncableProducts = liveProducts.filter(canSyncProductToWorkbook)
  const skippedProducts = liveProducts.filter((product) => !canSyncProductToWorkbook(product))

  if (syncableProducts.length === 0) {
    const detectedCategories = Array.from(
      new Set(liveProducts.map((product) => product.category).filter(Boolean))
    )
    throw new Error(
      detectedCategories.length > 0
        ? `Khong tim thay product live nao map duoc vao workbook storefront. Categories hien co: ${detectedCategories.join(", ")}`
        : "Khong tim thay product live nao map duoc vao workbook storefront."
    )
  }

  const result = await syncWorkbookProductBatch(
    workbookCsvPath,
    workbookXlsxPath,
    syncableProducts.map((product) => ({
      operation: "upsert",
      product,
    }))
  )

  console.log(`Fetched ${liveProducts.length} live products from ${apiBaseUrl}.`)
  console.log(`Synced ${syncableProducts.length} products into workbook CSV/XLSX.`)
  if (skippedProducts.length > 0) {
    console.warn(
      `Skipped ${skippedProducts.length} products with categories not mapped into workbook: ${skippedProducts
        .map((product) => `${product.name} [${product.category || "unknown"}]`)
        .join(", ")}`
    )
  }
  console.log(result.message)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Workbook sync failed: ${message}`)
  process.exitCode = 1
})
