import { normalizeStorefrontNavigationToken } from "@/constants/storefront-navigation";
import {
  resolveHomeWorkbookProductHref,
  type HomeWorkbookCategoryPage,
  type HomeWorkbookCategoryProduct,
} from "@/features/home/home-workbook";
import {
  deriveWorkbookCategoryCandidatesFromPage,
  loadWorkbookLiveProductLookup,
} from "@/features/home/workbook-live-products";
import type { JsonObject, StorefrontCategoryPageData, StorefrontEditorialSection } from "@/types/api";

export type WorkbookCategorySortOption = "latest" | "price_asc" | "price_desc";

const fallbackCategoryImages: Record<string, string> = {
  "shop-men":
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCyUfebOMONTnvYr9ZpAON5r2sqH9cixvFEI4IUO1HgtLokw0DocOKis15vSsJ14j6mnx1QrXMXJyDrzK64DrNUI1kc34lTyj4aIPfoodV3MFa0JLPFNdllb_6HgGOigtKyydUohURWyjMOQURKHAk5z02a5vuIH_t821X1vUIusV9VajR3V14-QiTAt7WCragHu_ErX2cBuxj6cZyi0qHNw-tRhFozQO02eRzXwXB3GyXDgg6tVkt9BgTiuPHfPlE9ZdYH2sNodvYW",
  "shop-women":
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBfeL88OBqW4Ue3Wr45J2UYNHHoz1V3GIYVT6BS47pFs4Ts1ZtnuMaaioY1y7Je7oqhcYL8DLZR8KKa3pevzh2EOXaCo_M9xAJhHsGvxIeawRZyLgrBDcTQKiMMTdBJfJv4EDGj_ST1SAVOcoV-DlbA_GhmqAhboruBHvNNSjrLZExknF7AnbpG7f-BfdcG52rKGirTBwXdWoxBIaSFpozclIZ4oni5B5b2Xn7rzo1a13KiUEDsW12kfxNX2AN9xi_LfBWp-G8i2o7n",
  footwear:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuC35EijN08hEhyXUNWU2WpmdXA-xKjXvVdQOkMB4J5Rt7XVw2ILNt27Jt92PUK2lOZLOyi-wwd64M20h4a_trllHLaecxpEhm3cRJskDeuyLTz248X3saxiF9Xx7qHWTTV-Q_6G58RaZiu-8vk3yYYOiP5aflLpGRjTe6yi6EtaoQKcBvHljgI4ItMv4FXnUPfGAYVnlVFrxYoDYB6LIE9tpXNeScpgugQTJzhp_icbkXy4Ay2kMR5-SI0rGXdV2RyT8p-AYS9ZdH9w",
  accessories:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAtpa0mJyKNICckH1wefUZTbwZo2Cg73toQg0p8Gs8HN84jU1dorhR-2jnXY-oDpZbRJQTYU6z2RuFiaqR_vx_BDTT30cUs2PtZGI-fdDfLZlrhkBB-gyED-FFOC2t0Dwpfe2t6mBWGbfA-f4EbYvH1QV61hKuBF7UfI-b_NBaRjm_A3LejyFwwwvM-2t-K-zHQWiYcOHHbplLjNpn3jDEO4siwrnpdkAaVJDh28LrLN0qGfUWRCFcXRzKfNM5VvnVj7r3R8bZe5FpI",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRecord(value: unknown): JsonObject {
  return isRecord(value) ? (value as JsonObject) : {};
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function readStringFromRecord(record: JsonObject, ...keys: string[]) {
  for (const key of keys) {
    const value = readString(record[key]);
    if (value) {
      return value;
    }
  }

  return "";
}

export function getFallbackCategoryImage(
  slug: string,
  displayName: string,
  featuredImage?: string
) {
  if (featuredImage) {
    return featuredImage;
  }

  const normalizedSlug = normalizeStorefrontNavigationToken(slug);
  if (fallbackCategoryImages[normalizedSlug]) {
    return fallbackCategoryImages[normalizedSlug];
  }

  return `https://placehold.co/1200x1500/F5F3EE/1B3022?text=${encodeURIComponent(
    displayName || slug || "Category"
  )}`;
}

export function getSectionPayload(sections: StorefrontEditorialSection[], sectionTypes: string[]) {
  const match = sections.find((section) => sectionTypes.includes(section.section_type));

  return readRecord(match?.payload);
}

export function buildHeroSource(pageData: StorefrontCategoryPageData) {
  return {
    ...readRecord(pageData.category.hero),
    ...getSectionPayload(pageData.sections, ["hero-banner"]),
  };
}

function buildFilterLookupValue(filterKey: string, option: string) {
  return `${filterKey.trim().toLowerCase()}:${option.trim().toLowerCase()}`;
}

export function buildInitialFilterState(page: HomeWorkbookCategoryPage) {
  return Object.fromEntries(
    page.filters
      .filter((filter) => filter.defaultValue)
      .map((filter) => [filter.filterKey, filter.defaultValue])
  );
}

export function matchesWorkbookProductFilters(
  product: HomeWorkbookCategoryProduct,
  activeFilters: Record<string, string>
) {
  if (Object.keys(activeFilters).length === 0) {
    return true;
  }

  const normalizedTags = product.filterTags.map((tag) => tag.trim().toLowerCase());

  return Object.entries(activeFilters).every(([filterKey, option]) => {
    if (!option) {
      return true;
    }

    return normalizedTags.includes(buildFilterLookupValue(filterKey, option));
  });
}

export function sortWorkbookCategoryProducts(
  products: HomeWorkbookCategoryProduct[],
  sortBy: WorkbookCategorySortOption
) {
  const nextProducts = products.slice();

  switch (sortBy) {
    case "price_asc":
      return nextProducts.sort((left, right) => left.price - right.price);
    case "price_desc":
      return nextProducts.sort((left, right) => right.price - left.price);
    default:
      return nextProducts.sort((left, right) => left.position - right.position);
  }
}

export function formatResultsLabel(template: string, count: number) {
  if (!template.trim()) {
    return `Showing ${count} results`;
  }

  return template.replace("%count%", String(count));
}

export function buildWorkbookProductSearchIndex(product: HomeWorkbookCategoryProduct) {
  return [product.badge, product.name, product.material, product.imageAlt, ...product.filterTags]
    .join(" ")
    .trim()
    .toLowerCase();
}

export function buildInitialWorkbookSectionState(page: HomeWorkbookCategoryPage) {
  return Object.fromEntries(page.filters.map((filter) => [filter.filterKey, true]));
}

export function buildWorkbookCategoryProductLookupKey(product: HomeWorkbookCategoryProduct) {
  return product.productId || normalizeStorefrontNavigationToken(product.name);
}

export async function loadWorkbookLiveProducts(pageData: HomeWorkbookCategoryPage) {
  return loadWorkbookLiveProductLookup({
    entries: pageData.products.map((product) => ({
      lookupKey: buildWorkbookCategoryProductLookupKey(product),
      productId: product.productId,
      name: product.name,
      brand: pageData.navLabel,
      categoryLabel: pageData.navLabel,
      href: product.href,
    })),
    categoryCandidates: deriveWorkbookCategoryCandidatesFromPage(pageData),
  });
}

export function resolveWorkbookProductHref(
  product: HomeWorkbookCategoryProduct,
  fallbackHref: string
) {
  return resolveHomeWorkbookProductHref({
    productId: product.productId,
    productName: product.name,
    href: product.href,
    fallbackHref,
  });
}
