import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  findHomeWorkbookCategoryPage,
  resolveHomeWorkbookProductHref,
  type HomeWorkbookCategoryPage,
  type HomeWorkbookCategoryProduct,
} from "@/features/home/home-workbook";
import { useHomeWorkbook } from "@/features/home/use-home-workbook";
import { api, getErrorMessage, isHttpError } from "@/services/api";
import { StorefrontOverlayHeader } from "@/components/navigation/storefront-overlay-header";
import { formatCurrency } from "@/utils/format";
import type { Product } from "@/types/api";
import "@/styles/pages/storefront/catalog-page.css";

type ArchiveCategorySource = {
  label: string;
  identifier: string;
};

type ArchiveFilterSection = "category" | "size" | "price";

type ArchiveFilterMap = Record<string, string[]>;

type ArchiveItem = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  imageAlt: string;
  href: string;
  categoryLabel: string;
  badge: string;
  subtitle: string;
  searchIndex: string;
  sequence: number;
  filterMap: ArchiveFilterMap;
};

const archiveCategorySources: ArchiveCategorySource[] = [
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

function normalizeArchiveText(value: string) {
  return value.trim().toLowerCase();
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function buildCategoryRoute(categoryPage: HomeWorkbookCategoryPage) {
  const identifier = categoryPage.routeAliases[0] || categoryPage.slug;
  return `/categories/${encodeURIComponent(identifier)}`;
}

function buildArchiveFilterMap(filterTags: string[]): ArchiveFilterMap {
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

function getArchiveFilterValues(filterMap: ArchiveFilterMap, key: string) {
  return filterMap[normalizeArchiveText(key)] ?? [];
}

function hasArchiveFilterValue(filterMap: ArchiveFilterMap, key: string, expected: string) {
  const normalizedExpected = normalizeArchiveText(expected);

  return getArchiveFilterValues(filterMap, key).some(
    (value) => normalizeArchiveText(value) === normalizedExpected
  );
}

function compareArchiveFacetValue(left: string, right: string) {
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

function buildWorkbookArchiveItem(
  categoryPage: HomeWorkbookCategoryPage,
  product: HomeWorkbookCategoryProduct,
  categoryLabel: string,
  sequence: number
): ArchiveItem {
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

function buildApiArchiveItem(
  product: Product,
  categoryLabel: string,
  sequence: number
): ArchiveItem {
  const filterTags = product.tags.filter((tag) => tag.trim().includes(":"));
  const filterMap = buildArchiveFilterMap(filterTags);

  return {
    id: product.id,
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

async function loadCategoryArchiveItems(source: ArchiveCategorySource, sequenceOffset: number) {
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

function sortArchiveItems(items: ArchiveItem[], sortBy: "latest" | "price_asc" | "price_desc") {
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

function ArchiveActionLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  if (isExternalHref(href)) {
    return (
      <a className={className} href={href} rel="noreferrer" target="_blank">
        {children}
      </a>
    );
  }

  return (
    <Link className={className} to={href}>
      {children}
    </Link>
  );
}

export function CatalogPage() {
  const [searchParams] = useSearchParams();
  const { content, status: workbookStatus } = useHomeWorkbook();
  const [archiveIndex, setArchiveIndex] = useState<ArchiveItem[]>([]);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const deferredSearchInput = useDeferredValue(searchInput);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [sortBy, setSortBy] = useState<"latest" | "price_asc" | "price_desc">("latest");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFiltersPanelOpen, setIsFiltersPanelOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<ArchiveFilterSection, boolean>>({
    category: true,
    size: true,
    price: true,
  });

  useEffect(() => {
    setSearchInput(searchParams.get("search") ?? "");
  }, [searchParams]);

  useEffect(() => {
    if (!content && (workbookStatus === "loading" || workbookStatus === "refreshing")) {
      setIsLoading(true);
      return undefined;
    }

    let active = true;

    async function loadArchive() {
      setIsLoading(true);
      setFeedback("");

      const workbookItems: ArchiveItem[] = [];
      const missingSources: ArchiveCategorySource[] = [];

      archiveCategorySources.forEach((source, sourceIndex) => {
        const categoryPage = content
          ? findHomeWorkbookCategoryPage(content, source.identifier)
          : null;

        if (!categoryPage) {
          missingSources.push(source);
          return;
        }

        workbookItems.push(
          ...categoryPage.products.map((product, productIndex) =>
            buildWorkbookArchiveItem(
              categoryPage,
              product,
              source.label,
              sourceIndex * 100 + productIndex
            )
          )
        );
      });

      const fallbackItemGroups = await Promise.all(
        missingSources.map((source, sourceIndex) =>
          loadCategoryArchiveItems(source, (archiveCategorySources.length + sourceIndex) * 100)
        )
      );

      if (!active) {
        return;
      }

      setArchiveIndex([...workbookItems, ...fallbackItemGroups.flat()]);
      setFeedback("");
      setIsLoading(false);
    }

    void loadArchive().catch((reason) => {
      if (!active) {
        return;
      }

      setArchiveIndex([]);
      setFeedback(getErrorMessage(reason));
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [content, workbookStatus]);

  function toggleFilterSection(section: ArchiveFilterSection) {
    startTransition(() => {
      setOpenSections((current) => ({
        ...current,
        [section]: !current[section],
      }));
    });
  }

  function handleCategorySelection(nextCategory: string) {
    startTransition(() => {
      setSelectedCategory(nextCategory);
    });
  }

  function handleSizeSelection(nextSize: string) {
    startTransition(() => {
      setSelectedSize((current) => (current === nextSize ? "" : nextSize));
    });
  }

  function handlePriceChange(field: "min" | "max", event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value.replace(/[^\d.]/g, "");
    setPriceRange((current) => ({ ...current, [field]: value }));
  }

  function clearFilters() {
    startTransition(() => {
      setSearchInput("");
      setSelectedCategory("");
      setSelectedSize("");
      setSortBy("latest");
      setPriceRange({ min: "", max: "" });
    });
  }

  const availableSizeOptions = useMemo(() => {
    const sizeOptions = new Map<string, string>();

    archiveCategorySources.forEach((source) => {
      const categoryPage = content
        ? findHomeWorkbookCategoryPage(content, source.identifier)
        : null;

      if (!categoryPage) {
        return;
      }

      categoryPage.filters.forEach((filter) => {
        if (normalizeArchiveText(filter.filterKey) !== "size") {
          return;
        }

        filter.options.forEach((option) => {
          const trimmedOption = option.trim();
          if (!trimmedOption) {
            return;
          }

          sizeOptions.set(normalizeArchiveText(trimmedOption), trimmedOption);
        });
      });
    });

    archiveIndex.forEach((item) => {
      getArchiveFilterValues(item.filterMap, "size").forEach((size) => {
        const trimmedSize = size.trim();
        if (!trimmedSize) {
          return;
        }

        sizeOptions.set(normalizeArchiveText(trimmedSize), trimmedSize);
      });
    });

    return Array.from(sizeOptions.values()).sort(compareArchiveFacetValue);
  }, [archiveIndex, content]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = normalizeArchiveText(deferredSearchInput);
    const minPrice = Number.parseFloat(priceRange.min);
    const maxPrice = Number.parseFloat(priceRange.max);

    const nextItems = archiveIndex.filter((item) => {
      if (selectedCategory && item.categoryLabel !== selectedCategory) {
        return false;
      }

      if (selectedSize && !hasArchiveFilterValue(item.filterMap, "size", selectedSize)) {
        return false;
      }

      if (normalizedSearch && !item.searchIndex.includes(normalizedSearch)) {
        return false;
      }

      if (Number.isFinite(minPrice) && minPrice > 0 && item.price < minPrice) {
        return false;
      }

      if (Number.isFinite(maxPrice) && maxPrice > 0 && item.price > maxPrice) {
        return false;
      }

      return true;
    });

    return sortArchiveItems(nextItems, sortBy);
  }, [
    archiveIndex,
    deferredSearchInput,
    priceRange.max,
    priceRange.min,
    selectedCategory,
    selectedSize,
    sortBy,
  ]);

  const activeFilterCount = [
    searchInput,
    selectedCategory,
    selectedSize,
    priceRange.min,
    priceRange.max,
    sortBy !== "latest" ? sortBy : "",
  ].filter(Boolean).length;
  const resultCountLabel = `Showing ${filteredItems.length} of ${
    archiveIndex.length || filteredItems.length
  } Products`;
  const statusCopy =
    archiveIndex.length > 0
      ? `Nguon du lieu dang dong bo truc tiep tu 4 trang category voi khoang gia ${formatCurrency(
          Math.min(...archiveIndex.map((item) => item.price))
        )} - ${formatCurrency(Math.max(...archiveIndex.map((item) => item.price)))}`
      : "Dang cho dong bo du lieu tu cac category pages";
  const selectedSummary = [
    searchInput ? `Search: ${searchInput}` : "",
    selectedCategory ? `Category: ${selectedCategory}` : "",
    selectedSize ? `Size: ${selectedSize}` : "",
    priceRange.min ? `Min: ${formatCurrency(Number(priceRange.min) || 0)}` : "",
    priceRange.max ? `Max: ${formatCurrency(Number(priceRange.max) || 0)}` : "",
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <div className="archive-shell">
      <section className="archive-hero">
        <div className="archive-hero-surface">
          <StorefrontOverlayHeader tone="light" />

          <header className="archive-editorial-header">
            <div className="archive-editorial-copy">
              <span className="archive-editorial-kicker">Curated Navigation</span>
              <h1>The Curated Archive</h1>
            </div>
          </header>
        </div>
      </section>

      <div className="archive-layout">
        <aside
          className={
            isFiltersPanelOpen ? "archive-sidebar archive-sidebar-open" : "archive-sidebar"
          }
          id="archive-filters-panel"
        >
          <section className="archive-filter-section">
            <button
              aria-expanded={openSections.category}
              className="archive-filter-toggle"
              type="button"
              onClick={() => toggleFilterSection("category")}
            >
              <span className="archive-filter-toggle-copy">
                <strong>CATEGORY</strong>
                <small>{selectedCategory || "All Archive"}</small>
              </span>
              <span aria-hidden="true" className="archive-filter-toggle-icon">
                {openSections.category ? "-" : "+"}
              </span>
            </button>

            {openSections.category ? (
              <div className="archive-collection-list">
                <button
                  className={
                    !selectedCategory
                      ? "archive-collection-link archive-collection-link-active"
                      : "archive-collection-link"
                  }
                  type="button"
                  onClick={() => handleCategorySelection("")}
                >
                  All Archive
                </button>
                {archiveCategorySources.map((source) => (
                  <button
                    className={
                      selectedCategory === source.label
                        ? "archive-collection-link archive-collection-link-active"
                        : "archive-collection-link"
                    }
                    key={source.label}
                    type="button"
                    onClick={() => handleCategorySelection(source.label)}
                  >
                    {source.label}
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="archive-filter-section">
            <button
              aria-expanded={openSections.size}
              className="archive-filter-toggle"
              type="button"
              onClick={() => toggleFilterSection("size")}
            >
              <span className="archive-filter-toggle-copy">
                <strong>SIZE</strong>
                <small>{selectedSize || "All sizes"}</small>
              </span>
              <span aria-hidden="true" className="archive-filter-toggle-icon">
                {openSections.size ? "-" : "+"}
              </span>
            </button>

            {openSections.size ? (
              availableSizeOptions.length > 0 ? (
                <div className="archive-size-grid">
                  {availableSizeOptions.map((size) => (
                    <button
                      className={
                        selectedSize === size
                          ? "archive-size-button archive-size-button-active"
                          : "archive-size-button"
                      }
                      key={size}
                      type="button"
                      onClick={() => handleSizeSelection(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="archive-filter-empty">
                  No size metadata has arrived from the category pages yet.
                </p>
              )
            ) : null}
          </section>

          <section className="archive-filter-section">
            <button
              aria-expanded={openSections.price}
              className="archive-filter-toggle"
              type="button"
              onClick={() => toggleFilterSection("price")}
            >
              <span className="archive-filter-toggle-copy">
                <strong>PRICE RANGE</strong>
                <small>
                  {priceRange.min || priceRange.max
                    ? `${priceRange.min || "0"} - ${priceRange.max || "Any"}`
                    : "Any price"}
                </small>
              </span>
              <span aria-hidden="true" className="archive-filter-toggle-icon">
                {openSections.price ? "-" : "+"}
              </span>
            </button>

            {openSections.price ? (
              <div className="archive-value-grid">
                <label className="archive-value-field">
                  <span>Min</span>
                  <input
                    inputMode="decimal"
                    placeholder="150"
                    value={priceRange.min}
                    onChange={(event) => handlePriceChange("min", event)}
                  />
                </label>
                <label className="archive-value-field">
                  <span>Max</span>
                  <input
                    inputMode="decimal"
                    placeholder="2500"
                    value={priceRange.max}
                    onChange={(event) => handlePriceChange("max", event)}
                  />
                </label>
              </div>
            ) : null}
          </section>

          <button className="archive-reset-button" type="button" onClick={clearFilters}>
            Reset Filters
          </button>

          <div className="archive-service-note">
            <span>Category Pages</span>
            <strong>
              {archiveIndex.length > 0
                ? "Synced from /categories routes"
                : "Waiting for category data"}
            </strong>
            <p>{statusCopy}</p>
          </div>
        </aside>

        <section className="archive-results">
          <div className="archive-results-toolbar">
            <span>{resultCountLabel}</span>
            <div className="archive-results-controls">
              <label className="archive-inline-search" htmlFor="archive-search">
                <input
                  id="archive-search"
                  name="search"
                  placeholder="Search across All Archive, Men, Women, Footwear and Accessories"
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
              </label>

              {searchInput ? (
                <button
                  className="archive-reset-button archive-search-clear"
                  type="button"
                  onClick={() => setSearchInput("")}
                >
                  Clear
                </button>
              ) : null}

              <div className="archive-toolbar-sort">
                <span className="archive-toolbar-sort-label">
                  <span>Sort</span>
                  <span>By</span>
                </span>
                <label className="archive-toolbar-sort-field" htmlFor="archive-sort">
                  <select
                    id="archive-sort"
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                  >
                    <option value="latest">Category Order</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                  </select>
                </label>
              </div>

              <button
                aria-controls="archive-filters-panel"
                aria-expanded={isFiltersPanelOpen}
                className="archive-filters-toggle"
                type="button"
                onClick={() => setIsFiltersPanelOpen((current) => !current)}
              >
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </button>
            </div>
          </div>

          {selectedSummary || activeFilterCount > 0 ? (
            <p className="archive-results-summary">
              {selectedSummary || `${activeFilterCount} filters active`}
            </p>
          ) : null}

          {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}

          {isLoading ? (
            <div className="page-state">Dang tai du lieu tu cac category pages...</div>
          ) : filteredItems.length > 0 ? (
            <div className="archive-product-grid">
              {filteredItems.map((item) => (
                <ArchiveActionLink
                  className="archive-editorial-card"
                  href={item.href}
                  key={item.id}
                >
                  <div className="archive-editorial-card-media">
                    {item.imageUrl ? (
                      <img alt={item.imageAlt || item.name} src={item.imageUrl} />
                    ) : (
                      <div className="archive-editorial-card-fallback">
                        {item.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}

                    {item.badge ? (
                      <span className="archive-editorial-card-badge">{item.badge}</span>
                    ) : null}
                  </div>

                  <div className="archive-editorial-card-copy">
                    <span>{item.badge || item.categoryLabel}</span>
                    <strong>{item.name}</strong>
                    <p>{item.subtitle}</p>
                    <em>{formatCurrency(item.price)}</em>
                  </div>
                </ArchiveActionLink>
              ))}
            </div>
          ) : feedback ? null : (
            <div className="empty-card catalog-empty-state archive-empty-state">
              <strong>Chua co san pham khop bo loc hien tai.</strong>
              <span>
                Hay no gioi han muc gia hoac quay lai All Archive de xem toan bo noi dung tu 4 trang
                category.
              </span>
              <button className="ghost-button" type="button" onClick={clearFilters}>
                Dat lai bo loc
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
