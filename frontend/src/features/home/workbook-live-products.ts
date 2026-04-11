import { api } from "@/services/api";
import type { Product } from "@/types/api";
import type { HomeWorkbookCategoryPage, HomeWorkbookProductReference } from "./home-workbook";

export type WorkbookLiveLookupInput = {
  productId?: string;
  name: string;
  brand?: string;
  categoryLabel?: string;
  href?: string;
};

export type WorkbookLiveLookupEntry = WorkbookLiveLookupInput & {
  lookupKey: string;
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
  return deriveWorkbookCategoryCandidates([reference.categoryLabel], reference.href);
}

export function deriveWorkbookCategoryCandidatesFromPage(pageData: HomeWorkbookCategoryPage) {
  return deriveWorkbookCategoryCandidates([pageData.navLabel, ...pageData.routeAliases]);
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
  const categoryCandidates = deriveWorkbookCategoryCandidates([entry.categoryLabel ?? ""], entry.href);

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

export function deriveWorkbookCategoryCandidates(labels: string[], href = "") {
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

async function loadProductCandidates(category: string, limit: number) {
  return api
    .listProducts({
      status: "active",
      category,
      limit,
    })
    .then((response) => response.data)
    .catch(() => [] as Product[]);
}

export async function loadWorkbookLiveProductLookup({
  entries,
  categoryCandidates = [],
  limit = 100,
}: {
  entries: WorkbookLiveLookupEntry[];
  categoryCandidates?: string[];
  limit?: number;
}) {
  if (entries.length === 0) {
    return {} as Record<string, Product>;
  }

  const candidateCategoryLookup = new Map<string, string>();

  const pushCategoryCandidates = (values: string[]) => {
    values.forEach((value) => {
      const normalized = normalizeWorkbookLiveLookupValue(value);
      if (normalized && !candidateCategoryLookup.has(normalized)) {
        candidateCategoryLookup.set(normalized, value);
      }
    });
  };

  pushCategoryCandidates(categoryCandidates);

  entries.forEach((entry) => {
    pushCategoryCandidates(deriveWorkbookCategoryCandidates([entry.categoryLabel ?? ""], entry.href));
  });

  const candidateBuckets =
    candidateCategoryLookup.size > 0
      ? await Promise.all(
          Array.from(candidateCategoryLookup.values()).map((category) =>
            loadProductCandidates(category, limit)
          )
        )
      : [];
  const candidateProducts = candidateBuckets.flat();

  if (candidateProducts.length < entries.length) {
    const fallbackProducts = await api
      .listProducts({
        status: "active",
        limit,
      })
      .then((response) => response.data)
      .catch(() => [] as Product[]);

    candidateProducts.push(...fallbackProducts);
  }

  const uniqueCandidates = dedupeWorkbookLiveProducts(candidateProducts);

  return Object.fromEntries(
    entries.flatMap((entry) => {
      const liveProduct = selectLiveProductForWorkbookEntry(entry, uniqueCandidates);

      if (!liveProduct) {
        return [];
      }

      return [[entry.lookupKey, liveProduct] as const];
    })
  );
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
