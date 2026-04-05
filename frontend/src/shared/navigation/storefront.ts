export type StorefrontNavigationItem = {
  label: string;
  to: string;
  aliases: string[];
  identifier?: string;
};

export const storefrontBrandHref = "/";
export const storefrontArchiveHref = "/products";
export const storefrontCartHref = "/cart";

export function normalizeStorefrontNavigationToken(value: string) {
  return value.trim().toLowerCase();
}

export function getStorefrontCategoryHref(categoryName: string) {
  return `/categories/${encodeURIComponent(categoryName)}`;
}

const storefrontArchiveCategoryMappings = [
  {
    label: "Men",
    tokens: ["shop men", "shop-men", "men"],
  },
  {
    label: "Women",
    tokens: ["shop women", "shop-women", "women"],
  },
  {
    label: "Footwear",
    tokens: ["footwear"],
  },
  {
    label: "Accessories",
    tokens: ["accessories"],
  },
] as const;

const storefrontAutoAddCategoryTokens = [
  "shop men",
  "shop-men",
  "men",
  "shop women",
  "shop-women",
  "women",
  "shopwear",
  "footwear",
  "accessories",
];

export const storefrontArchiveCategoryLabels = storefrontArchiveCategoryMappings.map(
  (category) => category.label
);

function splitStorefrontNavigationWords(value: string) {
  return value.split(/[\s-]+/).filter(Boolean);
}

function matchesStorefrontCategoryToken(
  normalizedCategory: string,
  token: string
) {
  if (normalizedCategory === token) {
    return true;
  }

  const categoryWords = splitStorefrontNavigationWords(normalizedCategory);
  const tokenWords = splitStorefrontNavigationWords(token);

  if (tokenWords.length === 0 || categoryWords.length < tokenWords.length) {
    return false;
  }

  for (let index = 0; index <= categoryWords.length - tokenWords.length; index += 1) {
    const matchesToken = tokenWords.every(
      (tokenWord, offset) => categoryWords[index + offset] === tokenWord
    );

    if (matchesToken) {
      return true;
    }
  }

  return false;
}

export function getStorefrontArchiveCategoryLabel(categoryName: string) {
  const normalizedCategory = normalizeStorefrontNavigationToken(categoryName);

  if (!normalizedCategory) {
    return "";
  }

  return (
    storefrontArchiveCategoryMappings.find(({ tokens }) =>
      tokens.some((token) =>
        matchesStorefrontCategoryToken(normalizedCategory, token)
      )
    )?.label ?? ""
  );
}

export function isStorefrontArchiveCategory(categoryName: string) {
  return Boolean(getStorefrontArchiveCategoryLabel(categoryName));
}

export function isStorefrontAutoAddCategory(categoryName: string) {
  const normalizedCategory = normalizeStorefrontNavigationToken(categoryName);

  if (!normalizedCategory) {
    return false;
  }

  return storefrontAutoAddCategoryTokens.some(
    (token) => matchesStorefrontCategoryToken(normalizedCategory, token)
  );
}

export const storefrontArchiveNavigationItem: StorefrontNavigationItem = {
  label: "All Archive",
  to: storefrontArchiveHref,
  aliases: ["All Archive", "archive", "all-archive"],
};

export const storefrontCoreCategoryNavigation: StorefrontNavigationItem[] = [
  {
    label: "Men",
    identifier: "Shop Men",
    aliases: ["Shop Men", "shop-men", "Men", "men"],
    to: getStorefrontCategoryHref("Shop Men"),
  },
  {
    label: "Women",
    identifier: "Shop Women",
    aliases: ["Shop Women", "shop-women", "Women", "women"],
    to: getStorefrontCategoryHref("Shop Women"),
  },
  {
    label: "Footwear",
    identifier: "Footwear",
    aliases: ["Footwear", "footwear"],
    to: getStorefrontCategoryHref("Footwear"),
  },
  {
    label: "Accessories",
    identifier: "Accessories",
    aliases: ["Accessories", "accessories"],
    to: getStorefrontCategoryHref("Accessories"),
  },
];

export const storefrontFallbackNavigation: StorefrontNavigationItem[] = [
  storefrontArchiveNavigationItem,
  ...storefrontCoreCategoryNavigation,
];

function getNavigationTokens(item: StorefrontNavigationItem) {
  return Array.from(
    new Set(
      [item.identifier, item.label, ...item.aliases]
        .map((value) => normalizeStorefrontNavigationToken(value || ""))
        .filter(Boolean)
    )
  );
}

function isSameNavigationItem(
  left: StorefrontNavigationItem,
  right: StorefrontNavigationItem
) {
  if (left.to === right.to) {
    return true;
  }

  const rightTokens = new Set(getNavigationTokens(right));
  return getNavigationTokens(left).some((token) => rightTokens.has(token));
}

export function mergeWithStorefrontNavigation(
  items: StorefrontNavigationItem[]
) {
  const mergedItems = items.filter(
    (item) => !isSameNavigationItem(item, storefrontArchiveNavigationItem)
  );

  for (const coreItem of storefrontCoreCategoryNavigation) {
    if (!mergedItems.some((item) => isSameNavigationItem(item, coreItem))) {
      mergedItems.push(coreItem);
    }
  }

  return [storefrontArchiveNavigationItem, ...mergedItems];
}
