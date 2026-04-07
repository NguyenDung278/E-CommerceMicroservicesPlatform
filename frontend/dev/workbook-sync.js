import { access, readFile, writeFile } from "node:fs/promises";
import * as XLSX from "xlsx";

const workbookSections = [
  {
    label: "Men",
    segmentSlug: "nam",
    pageSlug: "men-atelier",
    categoryHref: "/categories/Shop%20Men",
    matchers: ["shop men", "men", "nam"],
  },
  {
    label: "Women",
    segmentSlug: "nu",
    pageSlug: "women-atelier",
    categoryHref: "/categories/Shop%20Women",
    matchers: ["shop women", "women", "nu"],
  },
  {
    label: "Footwear",
    segmentSlug: "footwear",
    pageSlug: "footwear-atelier",
    categoryHref: "/categories/Footwear",
    matchers: ["footwear", "shoes", "giay"],
  },
  {
    label: "Accessories",
    segmentSlug: "accessories",
    pageSlug: "accessories-atelier",
    categoryHref: "/categories/Accessories",
    matchers: ["accessories", "accessory", "phu kien"],
  },
];

function normalizeLookupToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function readCell(value) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  return "";
}

function hasWorkbookData(row) {
  return row.some((value) => readCell(value).trim() !== "");
}

function buildEmptyRow(headers) {
  return headers.reduce((row, header) => {
    row[header] = "";
    return row;
  }, {});
}

function readSheetTable(sheet) {
  if (!sheet) {
    return {
      headers: [],
      rows: [],
    };
  }

  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  const [headerRow = [], ...dataRows] = matrix;
  const headers = headerRow.map((value) => String(value).trim()).filter(Boolean);

  return {
    headers,
    rows: dataRows.filter(hasWorkbookData).map((values) =>
      headers.reduce((row, header, index) => {
        row[header] = readCell(values[index]);
        return row;
      }, buildEmptyRow(headers))
    ),
  };
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadWorkbookTable(csvPath, xlsxPath) {
  if (await fileExists(csvPath)) {
    const workbook = XLSX.read(await readFile(csvPath), { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return readSheetTable(sheet);
  }

  if (await fileExists(xlsxPath)) {
    const workbook = XLSX.read(await readFile(xlsxPath), { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return readSheetTable(sheet);
  }

  throw new Error("Khong tim thay workbook CSV/XLSX de dong bo.");
}

function isStructuredTag(tag) {
  return tag.includes(":");
}

function extractStructuredTagValue(tags, key) {
  const prefix = `${key.toLowerCase()}:`;

  for (const tag of tags) {
    const trimmedTag = tag.trim();

    if (trimmedTag.toLowerCase().startsWith(prefix)) {
      return trimmedTag.slice(prefix.length).trim();
    }
  }

  return "";
}

function buildPrimaryImage(product, fallbackRow) {
  return (
    product.image_urls.find((value) => value.trim()) ||
    product.image_url.trim() ||
    fallbackRow?.image_url ||
    ""
  );
}

function buildBadge(product, section, fallbackRow) {
  const plainTag = product.tags.find((tag) => tag.trim() && !isStructuredTag(tag));

  return plainTag?.trim() || fallbackRow?.badge || fallbackRow?.eyebrow || section.label;
}

function buildMaterial(product, section, fallbackRow) {
  return (
    extractStructuredTagValue(product.tags, "material") ||
    product.variants.find((variant) => variant.label.trim())?.label.trim() ||
    fallbackRow?.material ||
    product.brand.trim() ||
    section.label
  );
}

function buildPriceBucket(price) {
  if (price >= 1000) {
    return "$1000+";
  }

  if (price >= 500) {
    return "$500-$1000";
  }

  if (price >= 150) {
    return "$150-$500";
  }

  return "$0-$150";
}

function buildFilterTags(product, section, fallbackRow) {
  const tags = new Set();

  for (const tag of product.tags) {
    const trimmedTag = tag.trim();

    if (trimmedTag && isStructuredTag(trimmedTag)) {
      tags.add(trimmedTag);
    }
  }

  if (![...tags].some((tag) => tag.toLowerCase().startsWith("category:"))) {
    tags.add(`category:${section.label}`);
  }

  const sizes = Array.from(
    new Set(product.variants.map((variant) => variant.size?.trim() || "").filter(Boolean))
  );
  for (const size of sizes) {
    tags.add(`size:${size}`);
  }

  const colors = Array.from(
    new Set(product.variants.map((variant) => variant.color?.trim() || "").filter(Boolean))
  );
  for (const color of colors) {
    tags.add(`color:${color}`);
  }

  tags.add(`price:${buildPriceBucket(product.price)}`);

  if (tags.size === 0 && fallbackRow?.filter_tags.trim()) {
    return fallbackRow.filter_tags;
  }

  return [...tags].join("|");
}

function matchesProductRow(row, product) {
  const recordType = normalizeLookupToken(row.record_type || "");

  if (recordType !== "product" && recordType !== "category_page_product") {
    return false;
  }

  const rowProductId = normalizeLookupToken(row.product_id || "");
  const rowName = normalizeLookupToken(row.name || row.title || "");
  const productId = normalizeLookupToken(product.id);
  const productName = normalizeLookupToken(product.name);

  return (productId && rowProductId === productId) || (productName && rowName === productName);
}

function resolveWorkbookSection(category) {
  const target = normalizeLookupToken(category);

  return (
    workbookSections.find((section) =>
      section.matchers.some((matcher) => normalizeLookupToken(matcher) === target)
    ) || null
  );
}

function insertRow(rows, row, predicate, fallbackPredicate) {
  let insertAt = -1;

  rows.forEach((candidate, index) => {
    if (predicate(candidate)) {
      insertAt = index;
    }
  });

  if (insertAt < 0) {
    rows.forEach((candidate, index) => {
      if (fallbackPredicate(candidate)) {
        insertAt = index;
      }
    });
  }

  rows.splice(insertAt + 1, 0, row);
}

function reindexWorkbookRows(rows) {
  const counters = new Map();

  rows.forEach((row) => {
    const recordType = normalizeLookupToken(row.record_type || "");

    if (recordType === "product") {
      const key = `product:${normalizeLookupToken(row.segment_slug || "")}`;
      const nextPosition = (counters.get(key) || 0) + 1;
      counters.set(key, nextPosition);
      row.position = String(nextPosition);
    }

    if (recordType === "category_page_product") {
      const key = `category_page_product:${normalizeLookupToken(row.page_slug || "")}`;
      const nextPosition = (counters.get(key) || 0) + 1;
      counters.set(key, nextPosition);
      row.position = String(nextPosition);
    }
  });
}

function buildSegmentProductRow(headers, product, section, fallbackRow) {
  const row = buildEmptyRow(headers);

  row.record_type = "product";
  row.segment_slug = section.segmentSlug;
  row.product_id = product.id;
  row.brand = product.brand.trim() || fallbackRow?.brand || "ND Atelier";
  row.name = product.name.trim();
  row.price = String(product.price);
  row.image_url = buildPrimaryImage(product, fallbackRow);
  row.href = `/products/${encodeURIComponent(product.id)}`;
  row.eyebrow = buildBadge(product, section, fallbackRow);
  row.size_tag = buildMaterial(product, section, fallbackRow);
  row.fit_note = product.description.trim() || fallbackRow?.fit_note || "";

  return row;
}

function buildCategoryPageProductRow(headers, product, section, fallbackRow) {
  const row = buildEmptyRow(headers);

  row.record_type = "category_page_product";
  row.page_slug = section.pageSlug;
  row.product_id = product.id;
  row.badge = buildBadge(product, section, fallbackRow);
  row.name = product.name.trim();
  row.material = buildMaterial(product, section, fallbackRow);
  row.price = String(product.price);
  row.image_url = buildPrimaryImage(product, fallbackRow);
  row.image_alt = product.name.trim() || fallbackRow?.image_alt || "";
  row.href = `/products/${encodeURIComponent(product.id)}`;
  row.filter_tags = buildFilterTags(product, section, fallbackRow);

  return row;
}

export function applyWorkbookProductMutation(table, mutation) {
  const rows = table.rows.map((row) => ({ ...row }));
  const existingRows = rows.filter((row) => matchesProductRow(row, mutation.product));
  const nextRows = rows.filter((row) => !matchesProductRow(row, mutation.product));

  if (mutation.operation === "delete") {
    reindexWorkbookRows(nextRows);

    return {
      headers: table.headers.slice(),
      rows: nextRows,
    };
  }

  const section = resolveWorkbookSection(mutation.product.category);

  if (!section) {
    throw new Error(
      `Danh muc "${mutation.product.category}" chua duoc map vao workbook storefront.`
    );
  }

  const existingSegmentRow = existingRows.find(
    (row) => normalizeLookupToken(row.record_type || "") === "product"
  );
  const existingCategoryRow = existingRows.find(
    (row) => normalizeLookupToken(row.record_type || "") === "category_page_product"
  );

  insertRow(
    nextRows,
    buildSegmentProductRow(table.headers, mutation.product, section, existingSegmentRow),
    (row) =>
      normalizeLookupToken(row.record_type || "") === "product" &&
      normalizeLookupToken(row.segment_slug || "") === normalizeLookupToken(section.segmentSlug),
    (row) => normalizeLookupToken(row.record_type || "") === "product"
  );
  insertRow(
    nextRows,
    buildCategoryPageProductRow(table.headers, mutation.product, section, existingCategoryRow),
    (row) =>
      normalizeLookupToken(row.record_type || "") === "category_page_product" &&
      normalizeLookupToken(row.page_slug || "") === normalizeLookupToken(section.pageSlug),
    (row) => normalizeLookupToken(row.record_type || "") === "category_page_product"
  );
  reindexWorkbookRows(nextRows);

  return {
    headers: table.headers.slice(),
    rows: nextRows,
  };
}

function buildWorkbookSheet(table) {
  return XLSX.utils.json_to_sheet(table.rows, {
    header: table.headers,
  });
}

async function writeWorkbookFiles(table, csvPath, xlsxPath) {
  const sheet = buildWorkbookSheet(table);
  const csv = XLSX.utils.sheet_to_csv(sheet);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, sheet, "storefront");

  await writeFile(csvPath, csv, "utf8");
  await writeFile(
    xlsxPath,
    XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    })
  );
}

export async function syncWorkbookProductFiles(csvPath, xlsxPath, mutation) {
  const table = await loadWorkbookTable(csvPath, xlsxPath);
  const nextTable = applyWorkbookProductMutation(table, mutation);

  await writeWorkbookFiles(nextTable, csvPath, xlsxPath);

  return {
    message:
      mutation.operation === "delete"
        ? `Da xoa ${mutation.product.name} khoi workbook CSV/XLSX.`
        : `Da dong bo ${mutation.product.name} vao workbook CSV/XLSX.`,
  };
}
