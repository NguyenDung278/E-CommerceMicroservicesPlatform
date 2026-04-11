import {
  findHomeWorkbookCategoryPage,
  resolveHomeWorkbookProductHref,
  type HomeWorkbookCategoryPage,
  type HomeWorkbookContent,
} from "@/features/home/home-workbook";
import { api, isHttpError } from "@/services/api";
import type { Product } from "@/types/api";
import type {
  ArchiveCategorySource,
  ArchiveFilterMap,
  ArchiveItem,
  ArchiveSortOption,
  BuildWorkbookArchiveItemInput,
} from "./archive-types";

export const archiveCategorySources: ArchiveCategorySource[] = [
  {
    label: "Men",
    identifier: "Shop Men",
  },
  {
    label: "Women",
    identifier: "Shop Women",
  },
  {
    label: "Footwear",
    identifier: "Footwear",
  },
  {
    label: "Accessories",
    identifier: "Accessories",
  },
];

const archiveAlphaSizeScale = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

export function normalizeArchiveText(value: string) {
  return value.trim().toLowerCase();
}

export function buildCategoryRoute(categoryPage: HomeWorkbookCategoryPage) {
  const identifier = categoryPage.routeAliases[0] || categoryPage.slug;
  return `/categories/${encodeURIComponent(identifier)}`;
}

export function buildArchiveFilterMap(filterTags: string[]): ArchiveFilterMap {
  const nextFilterMap: ArchiveFilterMap = {};

  filterTags.forEach((filterTag) => {
    const trimmedTag = filterTag.trim();
    if (!trimmedTag) {
      return;
    }

    const separatorIndex = trimmedTag.indexOf(":");
    if (separatorIndex < 0) {
      return;
    }

    const key = normalizeArchiveText(trimmedTag.slice(0, separatorIndex));
    const value = trimmedTag.slice(separatorIndex + 1).trim();

    if (!key || !value) {
      return;
    }

    const existingValues = nextFilterMap[key] ?? [];

    if (
      existingValues.some(
        (existingValue) => normalizeArchiveText(existingValue) === normalizeArchiveText(value)
      )
    ) {
      return;
    }

    nextFilterMap[key] = [...existingValues, value];
  });

  return nextFilterMap;
}

export function getArchiveFilterValues(filterMap: ArchiveFilterMap, key: string) {
  return filterMap[normalizeArchiveText(key)] ?? [];
}

export function hasArchiveFilterValue(filterMap: ArchiveFilterMap, key: string, expected: string) {
  const normalizedExpected = normalizeArchiveText(expected);

  return getArchiveFilterValues(filterMap, key).some(
    (value) => normalizeArchiveText(value) === normalizedExpected
  );
}

export function compareArchiveFacetValue(left: string, right: string) {
  const normalizedLeft = left.trim().toUpperCase();
  const normalizedRight = right.trim().toUpperCase();
  const leftAlphaIndex = archiveAlphaSizeScale.indexOf(normalizedLeft);
  const rightAlphaIndex = archiveAlphaSizeScale.indexOf(normalizedRight);

  if (leftAlphaIndex >= 0 || rightAlphaIndex >= 0) {
    if (leftAlphaIndex === -1) {
      return 1;
    }

    if (rightAlphaIndex === -1) {
      return -1;
    }

    return leftAlphaIndex - rightAlphaIndex;
  }

  const leftNumeric = Number.parseFloat(left);
  const rightNumeric = Number.parseFloat(right);

  if (Number.isFinite(leftNumeric) && Number.isFinite(rightNumeric)) {
    return leftNumeric - rightNumeric;
  }

  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function buildWorkbookArchiveItem({
  categoryLabel,
  categoryPage,
  product,
  sequence,
}: BuildWorkbookArchiveItemInput): ArchiveItem {
  const fallbackHref = buildCategoryRoute(categoryPage);
  const finalHref = resolveHomeWorkbookProductHref({
    productId: product.productId,
    productName: product.name,
    href: product.href,
    fallbackHref,
  });
  const filterMap = buildArchiveFilterMap(product.filterTags);

  return {
    id: `workbook-${categoryPage.slug}-${product.position}-${product.name}`,
    productId: product.productId,
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl,
    imageAlt: product.imageAlt || product.name,
    href: finalHref,
    categoryLabel,
    badge: product.badge,
    subtitle: product.material || categoryPage.heroTitle || categoryLabel,
    searchIndex: normalizeArchiveText(
      [product.name, product.material, product.badge, categoryLabel, ...product.filterTags].join(
        " "
      )
    ),
    sequence,
    filterMap,
  };
}

export function buildApiArchiveItem(
  product: Product,
  categoryLabel: string,
  sequence: number
): ArchiveItem {
  const filterTags = product.tags.filter((tag) => tag.trim().includes(":"));
  const filterMap = buildArchiveFilterMap(filterTags);

  return {
    id: product.id,
    productId: product.id,
    name: product.name,
    price: product.price,
    imageUrl: product.image_urls[0] || product.image_url,
    imageAlt: product.name,
    href: `/products/${product.id}`,
    categoryLabel,
    badge: product.tags[0] ? `#${product.tags[0]}` : "",
    subtitle: product.brand || product.category || categoryLabel,
    searchIndex: normalizeArchiveText(
      [
        product.name,
        product.description,
        product.brand,
        product.category,
        categoryLabel,
        ...product.tags,
      ].join(" ")
    ),
    sequence,
    filterMap,
  };
}

export async function loadCategoryArchiveItems(
  source: ArchiveCategorySource,
  sequenceOffset: number
) {
  try {
    const storefrontResponse = await api.getStorefrontCategoryPage(source.identifier);

    return storefrontResponse.data.featured_products.map((item, index) =>
      buildApiArchiveItem(item.product, source.label, sequenceOffset + index)
    );
  } catch (reason) {
    if (!isHttpError(reason) || reason.status !== 404) {
      throw reason;
    }

    const productResponse = await api.listProducts({
      category: source.identifier,
      limit: 48,
      status: "active",
    });

    return productResponse.data.map((product, index) =>
      buildApiArchiveItem(product, source.label, sequenceOffset + index)
    );
  }
}

export function sortArchiveItems(items: ArchiveItem[], sortBy: ArchiveSortOption) {
  const nextItems = items.slice();

  switch (sortBy) {
    case "price_asc":
      return nextItems.sort((left, right) => left.price - right.price);
    case "price_desc":
      return nextItems.sort((left, right) => right.price - left.price);
    default:
      return nextItems.sort((left, right) => left.sequence - right.sequence);
  }
}

export function deriveArchiveStatusCopy(items: ArchiveItem[]) {
  if (items.length === 0) {
    return "Fresh arrivals from every collection will appear here soon.";
  }

  return `Explore ${items.length} pieces across tailoring, knitwear, footwear, and accessories.`;
}

function joinArchiveLabels(labels: string[]) {
  if (labels.length <= 1) {
    return labels.join("");
  }

  if (labels.length === 2) {
    return labels.join(" and ");
  }

  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export function buildArchiveSearchPlaceholder(content?: HomeWorkbookContent | null) {
  const labels = [
    "All Archive",
    ...(content?.categoryPages
      .map((page) => page.navLabel.trim())
      .filter(Boolean)
      .filter((label, index, values) => values.indexOf(label) === index) ?? []),
  ];

  return `Search ${joinArchiveLabels(labels)}`;
}

export function buildArchiveIndexFromWorkbook(content?: HomeWorkbookContent | null) {
  const workbookItems: ArchiveItem[] = [];
  const missingSources: ArchiveCategorySource[] = [];

  archiveCategorySources.forEach((source, sourceIndex) => {
    const categoryPage = content ? findHomeWorkbookCategoryPage(content, source.identifier) : null;

    if (!categoryPage) {
      missingSources.push(source);
      return;
    }

    workbookItems.push(
      ...categoryPage.products.map((product, productIndex) =>
        buildWorkbookArchiveItem({
          categoryLabel: source.label,
          categoryPage,
          product,
          sequence: sourceIndex * 100 + productIndex,
        })
      )
    );
  });

  return {
    workbookItems,
    missingSources,
  };
}
