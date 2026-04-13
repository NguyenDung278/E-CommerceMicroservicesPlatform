import type { Product } from "@/types/api";

type XlsxModule = typeof import("xlsx");
type WorkbookDocument = import("xlsx").WorkBook;

let xlsxModulePromise: Promise<XlsxModule> | null = null;

export type HomeWorkbookNavItem = {
  position: number;
  slug: string;
  label: string;
  href: string;
  isDefault: boolean;
};

export type HomeWorkbookHero = {
  segmentSlug: string;
  collectionKicker: string;
  title: string;
  description: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  backgroundImage: string;
  quoteKicker: string;
  quoteBody: string;
  accent: string;
  arrivalsKicker: string;
  arrivalsTitle: string;
};

export type HomeWorkbookCategoryTile = {
  segmentSlug: string;
  position: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string;
};

export type HomeWorkbookCallout = {
  segmentSlug: string;
  eyebrow: string;
  title: string;
  body: string;
  imageUrl: string;
};

export type HomeWorkbookMetric = {
  segmentSlug: string;
  position: number;
  value: string;
  label: string;
};

export type HomeWorkbookProduct = {
  segmentSlug: string;
  position: number;
  productId: string;
  eyebrow: string;
  brand: string;
  name: string;
  price: number;
  sizeTag: string;
  fitNote: string;
  imageUrl: string;
  href: string;
};

export type HomeWorkbookFooter = {
  brandName: string;
  caption: string;
  note: string;
};

export type HomeWorkbookFooterLink = {
  position: number;
  label: string;
  href: string;
};

export type HomeWorkbookCategoryPageFilter = {
  pageSlug: string;
  position: number;
  filterKey: string;
  label: string;
  options: string[];
  defaultValue: string;
};

export type HomeWorkbookCategoryProduct = {
  pageSlug: string;
  position: number;
  productId: string;
  badge: string;
  name: string;
  material: string;
  price: number;
  imageUrl: string;
  imageAlt: string;
  href: string;
  filterTags: string[];
};

export type HomeWorkbookCategoryPage = {
  slug: string;
  navLabel: string;
  routeAliases: string[];
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  heroImageUrl: string;
  heroImageAlt: string;
  quoteBody: string;
  quoteAuthor: string;
  storyEyebrow: string;
  storyTitle: string;
  storyBody: string;
  storyImageUrl: string;
  storyImageAlt: string;
  storyCtaLabel: string;
  storyCtaHref: string;
  resultsLabel: string;
  sortLabel: string;
  footerNote: string;
  filters: HomeWorkbookCategoryPageFilter[];
  products: HomeWorkbookCategoryProduct[];
};

export type HomeWorkbookSegment = {
  slug: string;
  label: string;
  href: string;
  isDefault: boolean;
  hero: HomeWorkbookHero;
  tiles: HomeWorkbookCategoryTile[];
  callout: HomeWorkbookCallout | null;
  metrics: HomeWorkbookMetric[];
  products: HomeWorkbookProduct[];
};

export type HomeWorkbookContent = {
  sourceName: string;
  sourceKind: "xlsx" | "csv" | "upload";
  loadedAt: string;
  footer: HomeWorkbookFooter;
  footerLinks: HomeWorkbookFooterLink[];
  navItems: HomeWorkbookNavItem[];
  segments: HomeWorkbookSegment[];
  categoryPages: HomeWorkbookCategoryPage[];
};

export type HomeWorkbookProductReference = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  imageUrl: string;
  imageAlt: string;
  brand: string;
  categoryLabel: string;
  description: string;
  tags: string[];
  href: string;
  sourceType: "segment" | "category_page";
  sourceSlug: string;
};

type WorkbookRow = Record<string, unknown>;

type ParsedRows = {
  siteMeta: WorkbookRow[];
  navItems: WorkbookRow[];
  hero: WorkbookRow[];
  categoryTiles: WorkbookRow[];
  callout: WorkbookRow[];
  calloutMetrics: WorkbookRow[];
  products: WorkbookRow[];
  footerLinks: WorkbookRow[];
  categoryPages: WorkbookRow[];
  categoryFilters: WorkbookRow[];
  categoryPageProducts: WorkbookRow[];
};

const liveWorkbookCandidates = [
  { url: "/content/stitchfix-home.csv", kind: "csv" as const },
  { url: "/content/stitchfix-home.xlsx", kind: "xlsx" as const },
];

async function loadXlsxModule() {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import("xlsx");
  }

  return xlsxModulePromise;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeRow(row: WorkbookRow) {
  const nextRow: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    nextRow[normalizeKey(key)] = value;
  }

  return nextRow;
}

function readString(row: WorkbookRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function readNumber(row: WorkbookRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
}

function readBoolean(row: WorkbookRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return value !== 0;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "yes" || normalized === "1") {
        return true;
      }
      if (normalized === "false" || normalized === "no" || normalized === "0") {
        return false;
      }
    }
  }

  return false;
}

function readList(row: WorkbookRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === "string" ? item.trim() : String(item).trim()))
        .filter(Boolean);
    }

    if (typeof value === "string" && value.trim()) {
      return value
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function sortByPosition<T extends { position: number }>(items: T[]) {
  return [...items].sort((left, right) => left.position - right.position);
}

function getSheetRows(xlsx: XlsxModule, workbook: WorkbookDocument, sheetName: string) {
  const matchedSheetName = workbook.SheetNames.find(
    (candidate) => normalizeKey(candidate) === normalizeKey(sheetName)
  );

  if (!matchedSheetName) {
    return [];
  }

  const sheet = workbook.Sheets[matchedSheetName];
  if (!sheet) {
    return [];
  }

  return xlsx.utils
    .sheet_to_json<WorkbookRow>(sheet, {
      defval: "",
      raw: false,
    })
    .map((row) => normalizeRow(row));
}

function emptyParsedRows(): ParsedRows {
  return {
    siteMeta: [],
    navItems: [],
    hero: [],
    categoryTiles: [],
    callout: [],
    calloutMetrics: [],
    products: [],
    footerLinks: [],
    categoryPages: [],
    categoryFilters: [],
    categoryPageProducts: [],
  };
}

function parseFlatRows(xlsx: XlsxModule, workbook: WorkbookDocument): ParsedRows {
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return emptyParsedRows();
  }

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    return emptyParsedRows();
  }

  const rows = xlsx.utils
    .sheet_to_json<WorkbookRow>(sheet, {
      defval: "",
      raw: false,
    })
    .map((row) => normalizeRow(row));

  return {
    siteMeta: rows.filter((row) => readString(row, "record_type") === "site_meta"),
    navItems: rows.filter((row) => readString(row, "record_type") === "nav_item"),
    hero: rows.filter((row) => readString(row, "record_type") === "hero"),
    categoryTiles: rows.filter((row) => readString(row, "record_type") === "category_tile"),
    callout: rows.filter((row) => readString(row, "record_type") === "callout"),
    calloutMetrics: rows.filter((row) => readString(row, "record_type") === "metric"),
    products: rows.filter((row) => readString(row, "record_type") === "product"),
    footerLinks: rows.filter((row) => readString(row, "record_type") === "footer_link"),
    categoryPages: rows.filter((row) => readString(row, "record_type") === "category_page"),
    categoryFilters: rows.filter((row) => readString(row, "record_type") === "category_filter"),
    categoryPageProducts: rows.filter(
      (row) => readString(row, "record_type") === "category_page_product"
    ),
  };
}

function getWorkbookRows(xlsx: XlsxModule, workbook: WorkbookDocument): ParsedRows {
  const navItems = getSheetRows(xlsx, workbook, "nav_items");
  const hero = getSheetRows(xlsx, workbook, "hero");
  const categoryPages = getSheetRows(xlsx, workbook, "category_pages");
  const calloutMetrics = getSheetRows(xlsx, workbook, "callout_metrics");

  if (navItems.length > 0 || hero.length > 0 || categoryPages.length > 0) {
    return {
      siteMeta: getSheetRows(xlsx, workbook, "site_meta"),
      navItems,
      hero,
      categoryTiles: getSheetRows(xlsx, workbook, "category_tiles"),
      callout: getSheetRows(xlsx, workbook, "callout"),
      calloutMetrics:
        calloutMetrics.length > 0 ? calloutMetrics : getSheetRows(xlsx, workbook, "metrics"),
      products: getSheetRows(xlsx, workbook, "products"),
      footerLinks: getSheetRows(xlsx, workbook, "footer_links"),
      categoryPages,
      categoryFilters: getSheetRows(xlsx, workbook, "category_filters"),
      categoryPageProducts: getSheetRows(xlsx, workbook, "category_page_products"),
    };
  }

  return parseFlatRows(xlsx, workbook);
}

function parseWorkbookRows(
  rows: ParsedRows,
  sourceName: string,
  sourceKind: HomeWorkbookContent["sourceKind"]
): HomeWorkbookContent {
  const siteMetaRow = rows.siteMeta[0] ?? {};

  const footer: HomeWorkbookFooter = {
    brandName: readString(siteMetaRow, "brand_name") || "ND Shop",
    caption: readString(siteMetaRow, "footer_caption") || "Crafted for the Discerning",
    note:
      readString(siteMetaRow, "footer_note") ||
      "An editorial storefront shaped for clear browsing, product discovery, and quick returns.",
  };

  const navItems = sortByPosition(
    rows.navItems
      .map((row) => ({
        position: readNumber(row, "position"),
        slug: readString(row, "slug", "segment_slug"),
        label: readString(row, "label"),
        href: readString(row, "href"),
        isDefault: readBoolean(row, "is_default", "default"),
      }))
      .filter((item) => item.slug && item.label)
  );

  const heroes = rows.hero
    .map((row) => ({
      segmentSlug: readString(row, "segment_slug", "slug"),
      collectionKicker: readString(row, "collection_kicker", "eyebrow"),
      title: readString(row, "title"),
      description: readString(row, "description", "subtitle", "body"),
      primaryCtaLabel: readString(row, "primary_cta_label"),
      primaryCtaHref: readString(row, "primary_cta_href"),
      secondaryCtaLabel: readString(row, "secondary_cta_label"),
      secondaryCtaHref: readString(row, "secondary_cta_href"),
      backgroundImage: readString(row, "background_image", "hero_image", "image_url"),
      quoteKicker: readString(row, "quote_kicker"),
      quoteBody: readString(row, "quote_body"),
      accent: readString(row, "accent"),
      arrivalsKicker: readString(row, "arrivals_kicker"),
      arrivalsTitle: readString(row, "arrivals_title"),
    }))
    .filter((hero) => hero.segmentSlug && hero.title);

  const tiles = sortByPosition(
    rows.categoryTiles
      .map((row) => ({
        segmentSlug: readString(row, "segment_slug"),
        position: readNumber(row, "position"),
        eyebrow: readString(row, "eyebrow"),
        title: readString(row, "title"),
        subtitle: readString(row, "subtitle", "body"),
        imageUrl: readString(row, "image_url"),
        ctaLabel: readString(row, "cta_label"),
        ctaHref: readString(row, "cta_href", "href"),
      }))
      .filter((tile) => tile.segmentSlug && tile.title)
  );

  const callouts = rows.callout
    .map((row) => ({
      segmentSlug: readString(row, "segment_slug"),
      eyebrow: readString(row, "eyebrow"),
      title: readString(row, "title"),
      body: readString(row, "body", "subtitle"),
      imageUrl: readString(row, "image_url"),
    }))
    .filter((callout) => callout.segmentSlug && callout.title);

  const metrics = sortByPosition(
    rows.calloutMetrics
      .map((row) => ({
        segmentSlug: readString(row, "segment_slug"),
        position: readNumber(row, "position"),
        value: readString(row, "value", "title"),
        label: readString(row, "label", "body"),
      }))
      .filter((metric) => metric.segmentSlug && metric.value && metric.label)
  );

  const products = sortByPosition(
    rows.products
      .map((row) => ({
        segmentSlug: readString(row, "segment_slug"),
        position: readNumber(row, "position"),
        productId: readString(row, "product_id", "id"),
        eyebrow: readString(row, "eyebrow"),
        brand: readString(row, "brand"),
        name: readString(row, "name", "title"),
        price: readNumber(row, "price"),
        sizeTag: readString(row, "size_tag"),
        fitNote: readString(row, "fit_note"),
        imageUrl: readString(row, "image_url"),
        href: readString(row, "href", "cta_href"),
      }))
      .filter((product) => product.segmentSlug && product.name)
  );
  const productIdsByName = new Map(
    products
      .map((product) => [normalizeLookupToken(product.name), product.productId] as const)
      .filter((entry) => Boolean(entry[1]))
  );

  const footerLinks = sortByPosition(
    rows.footerLinks
      .map((row) => ({
        position: readNumber(row, "position"),
        label: readString(row, "label"),
        href: readString(row, "href"),
      }))
      .filter((link) => link.label)
  );

  const categoryPageFilters = sortByPosition(
    rows.categoryFilters
      .map((row) => ({
        pageSlug: readString(row, "page_slug", "slug"),
        position: readNumber(row, "position"),
        filterKey: readString(row, "filter_key"),
        label: readString(row, "label"),
        options: readList(row, "options"),
        defaultValue: readString(row, "default_value"),
      }))
      .filter((filter) => filter.pageSlug && filter.filterKey && filter.label)
  );

  const categoryPageProducts = sortByPosition(
    rows.categoryPageProducts
      .map((row) => {
        const name = readString(row, "name", "title");

        return {
          pageSlug: readString(row, "page_slug", "slug"),
          position: readNumber(row, "position"),
          productId:
            readString(row, "product_id", "id") || productIdsByName.get(normalizeLookupToken(name)) || "",
          badge: readString(row, "badge", "eyebrow"),
          name,
          material: readString(row, "material", "size_tag"),
          price: readNumber(row, "price"),
          imageUrl: readString(row, "image_url"),
          imageAlt: readString(row, "image_alt", "alt"),
          href: readString(row, "href", "cta_href"),
          filterTags: readList(row, "filter_tags"),
        };
      })
      .filter((product) => product.pageSlug && product.name)
  );

  const categoryPages = rows.categoryPages
    .map((row) => {
      const slug = readString(row, "slug");
      const navLabel = readString(row, "nav_label", "label") || slug;
      const routeAliases = Array.from(
        new Set(
          [...readList(row, "route_aliases", "aliases"), slug, navLabel]
            .map((item) => item.trim())
            .filter(Boolean)
        )
      );

      return {
        slug,
        navLabel,
        routeAliases,
        heroEyebrow: readString(row, "hero_eyebrow", "eyebrow"),
        heroTitle: readString(row, "hero_title", "title") || navLabel,
        heroDescription: readString(row, "hero_description", "description", "body"),
        heroImageUrl: readString(row, "hero_image_url", "image_url"),
        heroImageAlt: readString(row, "hero_image_alt", "image_alt", "alt"),
        quoteBody: readString(row, "quote_body"),
        quoteAuthor: readString(row, "quote_author"),
        storyEyebrow: readString(row, "story_eyebrow"),
        storyTitle: readString(row, "story_title"),
        storyBody: readString(row, "story_body"),
        storyImageUrl: readString(row, "story_image_url"),
        storyImageAlt: readString(row, "story_image_alt"),
        storyCtaLabel: readString(row, "story_cta_label"),
        storyCtaHref: readString(row, "story_cta_href"),
        resultsLabel: readString(row, "results_label"),
        sortLabel: readString(row, "sort_label"),
        footerNote: readString(row, "footer_note"),
      };
    })
    .filter((page) => page.slug && page.heroTitle)
    .map((page) => ({
      ...page,
      filters: categoryPageFilters.filter((filter) => filter.pageSlug === page.slug),
      products: categoryPageProducts.filter((product) => product.pageSlug === page.slug),
    }));

  const segments = heroes.map((hero) => {
    const navItem = navItems.find((item) => item.slug === hero.segmentSlug);

    return {
      slug: hero.segmentSlug,
      label: navItem?.label || hero.segmentSlug,
      href: navItem?.href || `/categories/${encodeURIComponent(hero.segmentSlug)}`,
      isDefault: navItem?.isDefault ?? false,
      hero: {
        ...hero,
        collectionKicker: hero.collectionKicker || "Seasonal Edit",
        description:
          hero.description ||
          "Seasonal layers, refined essentials, and considered accessories gathered in one calm edit.",
        primaryCtaLabel: hero.primaryCtaLabel || "Explore Collection",
        primaryCtaHref: hero.primaryCtaHref || "/products",
        secondaryCtaLabel: hero.secondaryCtaLabel || "View Lookbook",
        secondaryCtaHref:
          hero.secondaryCtaHref || `/categories/${encodeURIComponent(hero.segmentSlug)}`,
        backgroundImage:
          hero.backgroundImage ||
          "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1600&q=80",
        quoteKicker: hero.quoteKicker || "Editorial Note",
        quoteBody:
          hero.quoteBody ||
          "New arrivals, updated imagery, and quieter storytelling stay aligned across the storefront.",
        accent: hero.accent || "#8d573d",
        arrivalsKicker: hero.arrivalsKicker || "New Arrivals",
        arrivalsTitle: hero.arrivalsTitle || "Seasonal Essentials",
      } satisfies HomeWorkbookHero,
      tiles: tiles.filter((tile) => tile.segmentSlug === hero.segmentSlug),
      callout: callouts.find((callout) => callout.segmentSlug === hero.segmentSlug) ?? null,
      metrics: metrics.filter((metric) => metric.segmentSlug === hero.segmentSlug),
      products: products.filter((product) => product.segmentSlug === hero.segmentSlug),
    } satisfies HomeWorkbookSegment;
  });

  if (segments.length === 0) {
    throw new Error("Workbook is missing at least one hero row.");
  }

  const nextNavItems =
    navItems.length > 0
      ? navItems
      : segments.map((segment, index) => ({
          position: index + 1,
          slug: segment.slug,
          label: segment.label,
          href: segment.href,
          isDefault: index === 0,
        }));

  return {
    sourceName,
    sourceKind,
    loadedAt: new Date().toISOString(),
    footer,
    footerLinks,
    navItems: nextNavItems,
    segments,
    categoryPages,
  };
}

function parseWorkbook(
  xlsx: XlsxModule,
  workbook: WorkbookDocument,
  sourceName: string,
  sourceKind: HomeWorkbookContent["sourceKind"]
) {
  return parseWorkbookRows(getWorkbookRows(xlsx, workbook), sourceName, sourceKind);
}

function parseFileName(pathOrName: string) {
  const parts = pathOrName.split("/");
  return parts[parts.length - 1] || pathOrName;
}

async function readBlobText(blob: Blob) {
  if (typeof blob.text === "function") {
    return blob.text();
  }
  if (typeof Response !== "undefined") {
    return new Response(blob).text();
  }

  const arrayBuffer = await blob.arrayBuffer();
  return new TextDecoder().decode(arrayBuffer);
}

async function readBlobArrayBuffer(blob: Blob) {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }
  if (typeof Response !== "undefined") {
    return new Response(blob).arrayBuffer();
  }

  const text = await readBlobText(blob);
  return new TextEncoder().encode(text).buffer;
}

export function createHomeWorkbookSignature(content: HomeWorkbookContent) {
  return JSON.stringify({
    footer: content.footer,
    footerLinks: content.footerLinks,
    navItems: content.navItems,
    segments: content.segments,
    categoryPages: content.categoryPages,
    sourceKind: content.sourceKind,
  });
}

function normalizeLookupToken(value: string) {
  return value.trim().toLowerCase();
}

function slugifyWorkbookProductName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function isGenericWorkbookProductHref(href: string) {
  const trimmedHref = href.trim();

  return (
    !trimmedHref ||
    trimmedHref === "/products" ||
    trimmedHref.startsWith("/categories/")
  );
}

function buildCategoryRoute(page: HomeWorkbookCategoryPage) {
  const identifier = page.routeAliases[0] || page.slug;
  return `/categories/${encodeURIComponent(identifier)}`;
}

function doesWorkbookProductMatchIdentifier(
  identifier: string,
  productId: string,
  name: string,
  href: string
) {
  if (!identifier) {
    return false;
  }

  const normalizedId = normalizeLookupToken(productId);
  const normalizedName = normalizeLookupToken(name);
  const nameSlug = slugifyWorkbookProductName(name);
  const resolvedProductId = href.startsWith("/products/") ? href.slice("/products/".length) : "";

  return (
    normalizedId === identifier ||
    normalizedName === identifier ||
    nameSlug === identifier ||
    normalizeLookupToken(resolvedProductId) === identifier
  );
}

function buildWorkbookReferenceTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
}

export function resolveHomeWorkbookProductHref(options: {
  productId?: string;
  productName?: string;
  href: string;
  fallbackHref: string;
}) {
  const trimmedHref = options.href.trim();

  if (trimmedHref && isExternalHref(trimmedHref)) {
    return trimmedHref;
  }

  if (isGenericWorkbookProductHref(trimmedHref)) {
    if (options.productId?.trim()) {
      return `/products/${encodeURIComponent(options.productId.trim())}`;
    }

    if (options.productName?.trim()) {
      return `/products/${encodeURIComponent(slugifyWorkbookProductName(options.productName))}`;
    }
  }

  return trimmedHref || options.fallbackHref;
}

export function findHomeWorkbookCategoryPage(content: HomeWorkbookContent, identifier: string) {
  const target = normalizeLookupToken(identifier);

  return (
    content.categoryPages.find(
      (page) =>
        normalizeLookupToken(page.slug) === target ||
        page.routeAliases.some((alias) => normalizeLookupToken(alias) === target)
      ) ?? null
  );
}

export function findHomeWorkbookProductReference(
  content: HomeWorkbookContent,
  identifier: string
) {
  const target = normalizeLookupToken(identifier);

  for (const segment of content.segments) {
    for (const product of segment.products) {
      const href = resolveHomeWorkbookProductHref({
        productId: product.productId,
        productName: product.name,
        href: product.href,
        fallbackHref: segment.href || "/products",
      });

      if (!doesWorkbookProductMatchIdentifier(target, product.productId, product.name, href)) {
        continue;
      }

      return {
        productId: product.productId,
        slug: slugifyWorkbookProductName(product.name),
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        imageAlt: product.name,
        brand: product.brand,
        categoryLabel: segment.label,
        description: product.fitNote,
        tags: buildWorkbookReferenceTags([product.eyebrow, product.sizeTag]),
        href,
        sourceType: "segment",
        sourceSlug: segment.slug,
      } satisfies HomeWorkbookProductReference;
    }
  }

  for (const page of content.categoryPages) {
    const fallbackHref = buildCategoryRoute(page);

    for (const product of page.products) {
      const href = resolveHomeWorkbookProductHref({
        productId: product.productId,
        productName: product.name,
        href: product.href,
        fallbackHref,
      });

      if (!doesWorkbookProductMatchIdentifier(target, product.productId, product.name, href)) {
        continue;
      }

      return {
        productId: product.productId,
        slug: slugifyWorkbookProductName(product.name),
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        imageAlt: product.imageAlt || product.name,
        brand: page.navLabel,
        categoryLabel: page.navLabel,
        description: product.material,
        tags: buildWorkbookReferenceTags([product.badge, ...product.filterTags]),
        href,
        sourceType: "category_page",
        sourceSlug: page.slug,
      } satisfies HomeWorkbookProductReference;
    }
  }

  return null;
}

export function buildWorkbookFallbackProduct(
  reference: HomeWorkbookProductReference,
  fallbackId = ""
): Product {
  const variantSizes = reference.tags
    .filter((tag) => tag.toLowerCase().startsWith("size:"))
    .map((tag) => tag.split(":").slice(1).join(":").trim())
    .filter(Boolean);
  const variants = Array.from(new Set(variantSizes)).map((size, index) => ({
    sku: `${reference.productId || reference.slug || fallbackId || "workbook"}-${index + 1}`,
    label: size,
    size,
    price: reference.price,
    stock: 0,
  }));
  const productId = reference.productId || fallbackId || reference.slug || "workbook-product";

  return {
    id: productId,
    name: reference.name,
    description: reference.description || `A curated preview from the ${reference.categoryLabel} edit.`,
    price: reference.price,
    stock: 0,
    category: reference.categoryLabel,
    brand: reference.brand || "ND Atelier",
    tags: reference.tags,
    status: "workbook-preview",
    sku: productId,
    variants,
    image_url: reference.imageUrl,
    image_urls: reference.imageUrl ? [reference.imageUrl] : [],
    created_at: "",
    updated_at: "",
  };
}

export async function loadHomeWorkbookFromUrl(
  url: string,
  sourceKind: "xlsx" | "csv",
  signal?: AbortSignal
) {
  const xlsx = await loadXlsxModule();
  const response = await fetch(`${url}?t=${Date.now()}`, {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Unable to load workbook from ${url}.`);
  }

  const workbook =
    sourceKind === "csv"
      ? xlsx.read(await response.text(), { type: "string" })
      : xlsx.read(await response.arrayBuffer(), { type: "array" });

  return parseWorkbook(xlsx, workbook, parseFileName(url), sourceKind);
}

export async function loadLiveHomeWorkbook(signal?: AbortSignal) {
  let lastError: Error | null = null;

  for (const candidate of liveWorkbookCandidates) {
    try {
      return await loadHomeWorkbookFromUrl(candidate.url, candidate.kind, signal);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("No live workbook source is available.");
}

export async function loadHomeWorkbookFromFile(file: File) {
  const xlsx = await loadXlsxModule();
  const extension = file.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx";
  const workbook =
    extension === "csv"
      ? xlsx.read(await readBlobText(file), { type: "string" })
      : xlsx.read(await readBlobArrayBuffer(file), { type: "array" });

  return parseWorkbook(xlsx, workbook, file.name, "upload");
}
