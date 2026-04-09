import type { Product } from "@/types/api";
import type { HomeWorkbookCategoryPage, HomeWorkbookProductReference } from "./home-workbook";

type WorkbookLiveLookupInput = {
  productId?: string;
  name: string;
  brand?: string;
  categoryLabel?: string;
  href?: string;
};

export function normalizeWorkbookLiveLookupValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function dedupeWorkbookLiveProducts(products: Product[]) {
  const uniqueProducts = new Map<string, Product>();

  for (const product of products) {
    if (!product.id.trim()) {
      continue;
    }

    if (!uniqueProducts.has(product.id)) {
      uniqueProducts.set(product.id, product);
    }
  }

  return Array.from(uniqueProducts.values());
}

export function deriveWorkbookCategoryCandidatesFromReference(
  reference: Pick<HomeWorkbookProductReference, "categoryLabel" | "href">
) {
  return buildWorkbookCategoryCandidates([reference.categoryLabel], reference.href);
}

export function deriveWorkbookCategoryCandidatesFromPage(pageData: HomeWorkbookCategoryPage) {
  return buildWorkbookCategoryCandidates([pageData.navLabel, ...pageData.routeAliases]);
}

export function selectLiveProductForWorkbookEntry(
  entry: WorkbookLiveLookupInput,
  candidates: Product[]
) {
  const targetId = normalizeWorkbookLiveLookupValue(entry.productId ?? "");
  const targetName = normalizeWorkbookLiveLookupValue(entry.name);

  if (!targetName && !targetId) {
    return null;
  }

  if (targetId) {
    const directIdentifierMatch =
      candidates.find((candidate) => normalizeWorkbookLiveLookupValue(candidate.id) === targetId) ??
      candidates.find((candidate) => normalizeWorkbookLiveLookupValue(candidate.sku) === targetId);

    if (directIdentifierMatch) {
      return directIdentifierMatch;
    }
  }

  const exactNameMatches = candidates.filter(
    (candidate) => normalizeWorkbookLiveLookupValue(candidate.name) === targetName
  );

  if (exactNameMatches.length === 0) {
    return null;
  }

  const targetBrand = normalizeWorkbookLiveLookupValue(entry.brand ?? "");
  const categoryCandidates = buildWorkbookCategoryCandidates([entry.categoryLabel ?? ""], entry.href);

  return (
    exactNameMatches.find(
      (candidate) =>
        targetBrand.length > 0 &&
        normalizeWorkbookLiveLookupValue(candidate.brand) === targetBrand
    ) ??
    exactNameMatches.find((candidate) =>
      categoryCandidates.some(
        (categoryCandidate) =>
          normalizeWorkbookLiveLookupValue(candidate.category) === categoryCandidate
      )
    ) ??
    exactNameMatches[0]
  );
}

function buildWorkbookCategoryCandidates(labels: string[], href = "") {
  const candidates = new Map<string, string>();

  for (const label of labels) {
    const trimmed = label.trim();
    const normalized = normalizeWorkbookLiveLookupValue(trimmed);
    if (normalized && !candidates.has(normalized)) {
      candidates.set(normalized, trimmed);
    }
  }

  const hrefCategory = parseCategoryValueFromHref(href);
  if (hrefCategory) {
    const normalizedHrefCategory = normalizeWorkbookLiveLookupValue(hrefCategory);
    if (normalizedHrefCategory && !candidates.has(normalizedHrefCategory)) {
      candidates.set(normalizedHrefCategory, hrefCategory);
    }
  }

  return Array.from(candidates.values());
}

function parseCategoryValueFromHref(href: string) {
  const trimmedHref = href.trim();
  if (!trimmedHref.startsWith("/categories/")) {
    return "";
  }

  const rawValue = trimmedHref.slice("/categories/".length).split("?")[0]?.split("#")[0] ?? "";
  if (!rawValue) {
    return "";
  }

  try {
    return decodeURIComponent(rawValue).trim();
  } catch {
    return rawValue.trim();
  }
}
