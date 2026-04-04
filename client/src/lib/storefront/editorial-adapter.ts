import type {
  AtelierBadgeTone,
  AtelierBottomSection,
  AtelierCatalogItem,
  AtelierFilterGroup,
  AtelierFilterOption,
  AtelierHeroConfig,
  AtelierHeroLine,
  AtelierNavItem,
  AtelierPageConfig,
  AtelierPaletteOption,
} from "@/components/atelier-page-types";
import { fallbackImageForProduct } from "@/lib/utils";
import type {
  JsonObject,
  JsonValue,
  StorefrontCategory,
  StorefrontCategoryPageData,
  StorefrontEditorialSection,
  StorefrontFeaturedProduct,
} from "@/types/api";
import { formatCurrency, humanizeToken } from "@/utils/format";

const derivedColorPalette: Record<string, string> = {
  black: "#1b1c19",
  white: "#f5f3ee",
  cream: "#efe7dc",
  ivory: "#f6f1e7",
  beige: "#d8cab5",
  tan: "#b7926d",
  brown: "#6b4f3a",
  navy: "#23324a",
  blue: "#506fa1",
  olive: "#677257",
  green: "#45624b",
  grey: "#8b8a84",
  gray: "#8b8a84",
  silver: "#c5c7c9",
  gold: "#c9a75d",
  burgundy: "#6b2e3b",
  red: "#b34747",
};

type ProductFacetValue = {
  label: string;
  count: number;
};

function isRecord(value: JsonValue | unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(value: JsonValue | unknown): JsonObject {
  return isRecord(value) ? value : {};
}

function readString(value: JsonValue | unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: JsonValue | unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readBoolean(value: JsonValue | unknown) {
  return typeof value === "boolean" ? value : false;
}

function readStringArray(value: JsonValue | unknown) {
  return Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
    : [];
}

function readFirstString(record: JsonObject, ...keys: string[]) {
  for (const key of keys) {
    const value = readString(record[key]);
    if (value) {
      return value;
    }
  }
  return "";
}

function toHeroVariant(value: string): AtelierHeroConfig["variant"] {
  if (value === "dark-immersive" || value === "light-framed") {
    return value;
  }
  return "light-editorial";
}

function mergeRecords(base: JsonObject, overrides: JsonObject) {
  return {
    ...base,
    ...overrides,
  };
}

function buildEditorialHref(category: StorefrontCategory) {
  const identifier = category.aliases[0] || category.display_name || category.slug;
  return `/editorial/${encodeURIComponent(identifier)}`;
}

function collectFeatureSections(sections: StorefrontEditorialSection[]) {
  return sections.filter((section) =>
    ["feature-card", "feature-panel", "feature-spotlight"].includes(section.section_type),
  );
}

function getSectionPayload(
  sections: StorefrontEditorialSection[],
  sectionType: string,
) {
  return readRecord(sections.find((section) => section.section_type === sectionType)?.payload);
}

function buildHeroTitleLines(source: JsonObject, fallbackTitle: string): AtelierHeroLine[] {
  const rawLines = source.titleLines;
  if (Array.isArray(rawLines)) {
    const parsed = rawLines
      .map<AtelierHeroLine | null>((entry) => {
        if (typeof entry === "string") {
          const text = entry.trim();
          return text ? { text } : null;
        }
        if (!isRecord(entry)) {
          return null;
        }
        const text = readString(entry.text);
        if (!text) {
          return null;
        }
        return {
          text,
          italic: readBoolean(entry.italic) || undefined,
        };
      })
      .filter((entry): entry is AtelierHeroLine => entry !== null);

    if (parsed.length > 0) {
      return parsed;
    }
  }

  const explicitTitle = readFirstString(source, "title", "heading");
  const title = explicitTitle || fallbackTitle;

  return title
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({ text }));
}

function buildHeroConfig(pageData: StorefrontCategoryPageData): AtelierHeroConfig {
  const baseHero = readRecord(pageData.category.hero);
  const heroSection = getSectionPayload(pageData.sections, "hero-banner");
  const heroSource = mergeRecords(baseHero, heroSection);
  const heroProduct = pageData.featured_products[0]?.product;
  const imageUrl =
    readFirstString(heroSource, "imageUrl", "image_url") ||
    heroProduct?.image_urls[0] ||
    heroProduct?.image_url ||
    fallbackImageForProduct(pageData.category.display_name);

  return {
    variant: toHeroVariant(readFirstString(heroSource, "variant")),
    badge: readFirstString(heroSource, "badge") || undefined,
    eyebrow: readFirstString(heroSource, "eyebrow") || undefined,
    titleLines: buildHeroTitleLines(heroSource, pageData.category.display_name),
    description:
      readFirstString(heroSource, "description", "subtitle", "body") ||
      `${pageData.category.display_name} curated editorial selections.`,
    imageUrl,
    imageAlt:
      readFirstString(heroSource, "imageAlt", "image_alt") ||
      `${pageData.category.display_name} editorial hero image`,
  };
}

function summarizeFacet(values: string[]): ProductFacetValue[] {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const normalized = value.trim();
    if (!normalized) {
      return;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 12);
}

function deriveFacetValues(products: StorefrontFeaturedProduct[], key: string): ProductFacetValue[] {
  const normalizedKey = key.trim().toLowerCase();

  switch (normalizedKey) {
    case "size":
    case "sizes":
      return summarizeFacet(
        products.flatMap((product) => product.product.variants.map((variant) => variant.size ?? "")),
      );
    case "color":
    case "colors":
      return summarizeFacet(
        products.flatMap((product) => product.product.variants.map((variant) => variant.color ?? "")),
      );
    case "brand":
      return summarizeFacet(products.map((product) => product.product.brand));
    case "category":
      return summarizeFacet(
        products.map((product) => product.product.category_slug || product.product.category),
      );
    case "tag":
    case "tags":
      return summarizeFacet(products.flatMap((product) => product.product.tags));
    case "material":
    default:
      return summarizeFacet(products.map((product) => product.product.material));
  }
}

function normalizeFilterOptions(value: JsonValue | unknown): AtelierFilterOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map<AtelierFilterOption | null>((entry) => {
      if (typeof entry === "string") {
        const label = entry.trim();
        return label ? { label } : null;
      }

      if (!isRecord(entry)) {
        return null;
      }

      const label = readFirstString(entry, "label", "value");
      if (!label) {
        return null;
      }

      return {
        label,
        active: readBoolean(entry.active) || undefined,
        count: readFirstString(entry, "count") || undefined,
      };
    })
    .filter((entry): entry is AtelierFilterOption => entry !== null);
}

function normalizePaletteOptions(value: JsonValue | unknown): AtelierPaletteOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map<AtelierPaletteOption | null>((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const label = readFirstString(entry, "label", "value");
      if (!label) {
        return null;
      }

      return {
        label,
        color: readFirstString(entry, "color") || derivedColorPalette[label.toLowerCase()] || "#d9d4cc",
        bordered: readBoolean(entry.bordered) || undefined,
        active: readBoolean(entry.active) || undefined,
      };
    })
    .filter((entry): entry is AtelierPaletteOption => entry !== null);
}

function normalizeFilterGroup(
  config: JsonObject,
  products: StorefrontFeaturedProduct[],
): AtelierFilterGroup | null {
  const kind = readFirstString(config, "kind").toLowerCase();
  const key = readFirstString(config, "key", "field");
  const title = readFirstString(config, "title") || humanizeToken(key || kind || "Filter");

  if (kind === "quote-card") {
    const quote = readFirstString(config, "quote");
    const attribution = readFirstString(config, "attribution");
    if (!quote || !attribution) {
      return null;
    }

    return {
      kind: "quote-card",
      quote,
      attribution,
      tone: readFirstString(config, "tone") === "light" ? "light" : "dark",
    };
  }

  if (kind === "price") {
    const minPrice = Math.min(...products.map((product) => product.product.price), 0);
    const maxPrice = Math.max(...products.map((product) => product.product.price), 0);
    const valuePercent = Math.round(readNumber(config.valuePercent) || 100);

    return {
      kind: "price",
      title,
      minLabel: readFirstString(config, "minLabel", "min_label") || formatCurrency(minPrice),
      maxLabel: readFirstString(config, "maxLabel", "max_label") || formatCurrency(maxPrice),
      valuePercent,
    };
  }

  if (kind === "chips") {
    const options = readStringArray(config.options);
    return {
      kind: "chips",
      title,
      options,
    };
  }

  if (kind === "palette") {
    const options =
      normalizePaletteOptions(config.options).length > 0
        ? normalizePaletteOptions(config.options)
        : deriveFacetValues(products, key || "color").map((option) => ({
            label: option.label,
            color: derivedColorPalette[option.label.toLowerCase()] || "#d9d4cc",
            bordered: option.label.toLowerCase() === "white",
          }));

    return {
      kind: "palette",
      title,
      options,
    };
  }

  if (kind === "checkboxes") {
    const derivedOptions = deriveFacetValues(products, key || title).map((option) => ({
      label: option.label,
      count: String(option.count),
    }));

    return {
      kind: "checkboxes",
      title,
      options: normalizeFilterOptions(config.options).length > 0 ? normalizeFilterOptions(config.options) : derivedOptions,
    };
  }

  if (kind === "sizes") {
    const derivedOptions = deriveFacetValues(products, key || "size").map((option) => ({
      label: option.label,
      count: String(option.count),
    }));

    return {
      kind: "sizes",
      title,
      options: normalizeFilterOptions(config.options).length > 0 ? normalizeFilterOptions(config.options) : derivedOptions,
      columns: [2, 3, 5].includes(readNumber(config.columns)) ? (readNumber(config.columns) as 2 | 3 | 5) : 2,
      compact: readBoolean(config.compact) || undefined,
    };
  }

  const derivedOptions = deriveFacetValues(products, key || title).map((option) => ({
    label: option.label,
    count: String(option.count),
  }));

  return {
    kind: "list",
    title,
    options: normalizeFilterOptions(config.options).length > 0 ? normalizeFilterOptions(config.options) : derivedOptions,
    uppercase: readBoolean(config.uppercase) || undefined,
    showCounts: readBoolean(config.showCounts) || undefined,
    activeStyle: readFirstString(config, "activeStyle") === "underline" ? "underline" : "bold",
  };
}

function buildFilterGroups(pageData: StorefrontCategoryPageData): AtelierFilterGroup[] {
  const filterConfig = Array.isArray(pageData.category.filter_config)
    ? pageData.category.filter_config
    : [];

  const derivedGroups = filterConfig
    .map((entry) => (isRecord(entry) ? normalizeFilterGroup(entry, pageData.featured_products) : null))
    .filter((group): group is AtelierFilterGroup => Boolean(group))
    .filter((group) => {
      if (group.kind === "list" || group.kind === "sizes" || group.kind === "checkboxes") {
        return group.options.length > 0;
      }
      if (group.kind === "palette") {
        return group.options.length > 0;
      }
      if (group.kind === "chips") {
        return group.options.length > 0;
      }
      return true;
    });

  if (derivedGroups.length > 0) {
    return derivedGroups;
  }

  return [
    normalizeFilterGroup({ kind: "list", key: "material", title: "Material" }, pageData.featured_products),
    normalizeFilterGroup({ kind: "sizes", key: "size", title: "Size", columns: 2 }, pageData.featured_products),
    normalizeFilterGroup({ kind: "price", title: "Price Range", valuePercent: 100 }, pageData.featured_products),
  ].filter((group): group is AtelierFilterGroup => Boolean(group));
}

function buildProductBadge(product: StorefrontFeaturedProduct): { label: string; tone: AtelierBadgeTone } | undefined {
  const tags = product.product.tags.map((tag) => tag.toLowerCase());
  if (tags.some((tag) => tag.includes("limited"))) {
    return { label: "Limited Edition", tone: "terracotta" };
  }
  if (tags.some((tag) => tag.includes("new"))) {
    return { label: "New Arrival", tone: "forest" };
  }
  if (product.position === 1) {
    return { label: "Featured", tone: "surface" };
  }
  return undefined;
}

function orderFeaturedProducts(pageData: StorefrontCategoryPageData) {
  const gridPayload = getSectionPayload(pageData.sections, "product-grid");
  const orderedExternalIDs = readStringArray(gridPayload.productIds).concat(
    readStringArray(gridPayload.product_ids),
  );

  if (orderedExternalIDs.length === 0) {
    return pageData.featured_products
      .slice()
      .sort((left, right) => left.position - right.position);
  }

  const byExternalID = new Map(
    pageData.featured_products.map((product) => [product.product_external_id, product]),
  );
  const ordered = orderedExternalIDs
    .map((externalID) => byExternalID.get(externalID))
    .filter((product): product is StorefrontFeaturedProduct => Boolean(product));

  const consumed = new Set(ordered.map((product) => product.product_external_id));
  const remaining = pageData.featured_products
    .filter((product) => !consumed.has(product.product_external_id))
    .sort((left, right) => left.position - right.position);

  return [...ordered, ...remaining];
}

function toCatalogItem(product: StorefrontFeaturedProduct, index: number): AtelierCatalogItem {
  const imageUrl =
    product.product.image_urls[0] ||
    product.product.image_url ||
    fallbackImageForProduct(product.product.name);

  return {
    type: "product",
    id: product.product.external_id || product.product.id,
    href: `/products/${encodeURIComponent(product.product.id)}`,
    name: product.product.name,
    meta:
      product.product.material ||
      product.product.brand ||
      humanizeToken(product.product.category_slug || product.product.category),
    price: formatCurrency(product.product.price),
    imageUrl,
    imageAlt: `${product.product.name} product image`,
    badge: buildProductBadge(product),
    offsetClassName: index % 2 === 1 ? "lg:translate-y-8" : undefined,
    variant: product.product.category_slug?.toLowerCase().includes("accessories") ? "split" : "editorial",
    showQuickAction: true,
  };
}

function toFeatureItem(section: StorefrontEditorialSection): AtelierCatalogItem | null {
  const payload = readRecord(section.payload);
  const title = readFirstString(payload, "title", "heading");
  const description = readFirstString(payload, "description", "body");
  if (!title || !description) {
    return null;
  }

  return {
    type: "feature",
    id: section.id,
    title,
    description,
    ctaLabel: readFirstString(payload, "ctaLabel", "cta_label") || "Explore",
    href: readFirstString(payload, "href", "ctaHref", "cta_href") || "/products",
    imageUrl: readFirstString(payload, "imageUrl", "image_url") || fallbackImageForProduct(title),
    imageAlt: readFirstString(payload, "imageAlt", "image_alt") || `${title} feature image`,
    spanClassName: readFirstString(payload, "spanClassName", "span_class_name") || undefined,
  };
}

function buildBottomSection(pageData: StorefrontCategoryPageData): AtelierBottomSection | undefined {
  const quotePayload = getSectionPayload(pageData.sections, "quote-band");
  const quote = readFirstString(quotePayload, "quote");
  const attribution = readFirstString(quotePayload, "attribution");
  if (quote && attribution) {
    return {
      kind: "quote-band",
      quote,
      attribution,
    };
  }

  const storyPayload = getSectionPayload(pageData.sections, "story-block");
  if (Object.keys(storyPayload).length === 0) {
    return undefined;
  }

  const fallbackImage =
    pageData.featured_products[0]?.product.image_urls[0] ||
    pageData.featured_products[0]?.product.image_url ||
    fallbackImageForProduct(pageData.category.display_name);
  const heading =
    readFirstString(storyPayload, "storyHeading", "story_heading", "heading", "title") ||
    `${pageData.category.display_name} craftsmanship`;
  const description =
    readFirstString(storyPayload, "storyDescription", "story_description", "body", "description") ||
    `Discover the editorial story behind ${pageData.category.display_name}.`;

  return {
    kind: "story-split",
    imageUrl: readFirstString(storyPayload, "imageUrl", "image_url") || fallbackImage,
    imageAlt:
      readFirstString(storyPayload, "imageAlt", "image_alt") ||
      `${pageData.category.display_name} editorial story image`,
    storyHeading: heading,
    storyDescription: description,
    storyCtaLabel:
      readFirstString(storyPayload, "storyCtaLabel", "story_cta_label", "ctaLabel", "cta_label") ||
      "Explore the collection",
    storyHref:
      readFirstString(storyPayload, "storyHref", "story_href", "href") ||
      `/products?category=${encodeURIComponent(pageData.category.slug)}`,
    panelEyebrow:
      readFirstString(storyPayload, "panelEyebrow", "panel_eyebrow", "eyebrow") ||
      pageData.category.nav_label,
    panelTitle:
      readFirstString(storyPayload, "panelTitle", "panel_title") ||
      heading,
    panelDescription:
      readFirstString(storyPayload, "panelDescription", "panel_description") ||
      description,
  };
}

export function buildAtelierNavItems(categories: StorefrontCategory[]): AtelierNavItem[] {
  const navItems: AtelierNavItem[] = [{ id: "archive", label: "Catalog", href: "/products" }];
  const seen = new Set<string>();

  categories.forEach((category) => {
    if (seen.has(category.slug)) {
      return;
    }
    seen.add(category.slug);
    navItems.push({
      id: category.slug,
      label: category.nav_label || category.display_name,
      href: buildEditorialHref(category),
    });
  });

  return navItems;
}

export function buildAtelierPageConfig(pageData: StorefrontCategoryPageData): AtelierPageConfig {
  const orderedProducts = orderFeaturedProducts(pageData);
  const productItems = orderedProducts.map((product, index) => toCatalogItem(product, index));
  const featureItems = collectFeatureSections(pageData.sections)
    .map((section) => toFeatureItem(section))
    .filter((item): item is Extract<AtelierCatalogItem, { type: "feature" }> => Boolean(item));

  return {
    id: pageData.category.slug,
    aliases: pageData.category.aliases,
    navLabel: pageData.category.nav_label,
    catalogHref: `/products?category=${encodeURIComponent(pageData.category.slug)}`,
    hero: buildHeroConfig(pageData),
    filters: buildFilterGroups(pageData),
    showingLabel: `Showing ${productItems.length} curated ${productItems.length === 1 ? "result" : "results"}`,
    sortLabel: "Curated Edit",
    products: [...productItems, ...featureItems],
    bottomSection: buildBottomSection(pageData),
  };
}
