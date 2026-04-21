"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { Heart, PackagePlus, Search, SlidersHorizontal, X } from "lucide-react";
import {
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  EmptyState,
  InlineAlert,
  ProductCard,
  ProductCardAction,
  ProductCardSkeleton,
  SectionHeading,
  Select,
  SurfaceCard,
  TextInput,
} from "@/components/storefront-ui";
import { useCartActions } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { productApi } from "@/lib/api/product";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import type { CatalogPageInitialData } from "@/lib/storefront/initial-data";
import { buildSearchParams, cn } from "@/lib/utils";
import type {
  Product,
  ProductPopularity,
  ProductSearchFacet,
  ProductSearchFacetValue,
  ProductSearchSuggestion,
} from "@/types/api";

type SortMode = "latest" | "price_asc" | "price_desc" | "popular" | "merchandising";

const defaultSortOptions: Array<{ label: string; value: SortMode }> = [
  { value: "latest", label: "Mới nhất" },
  { value: "merchandising", label: "Merchandising" },
  { value: "price_asc", label: "Giá tăng dần" },
  { value: "price_desc", label: "Giá giảm dần" },
  { value: "popular", label: "Phổ biến" },
];

type FilterPanelProps = {
  mobileOpen: boolean;
  category: string;
  brand: string;
  size: string;
  color: string;
  minPrice: string;
  maxPrice: string;
  savedOnly: boolean;
  categoryOptions: string[];
  brandOptions: string[];
  sizeOptions: string[];
  colorOptions: string[];
  categoryCounts: Record<string, number>;
  brandCounts: Record<string, number>;
  sizeCounts: Record<string, number>;
  colorCounts: Record<string, number>;
  onClose: () => void;
  onCategoryChange: (value: string) => void;
  onBrandChange: (value: string) => void;
  onSizeChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onMinPriceChange: (value: string) => void;
  onMaxPriceChange: (value: string) => void;
  onSavedOnlyChange: (value: boolean) => void;
  onReset: () => void;
};

function normalizeCatalogText(value: string) {
  return value.trim().toLowerCase();
}

function buildFacetCountLookup(values: ProductSearchFacetValue[] | undefined) {
  return Object.fromEntries(
    (values ?? []).map((item) => [normalizeCatalogText(item.value), item.count] as const),
  );
}

function readAssistFacetValues(facets: ProductSearchFacet[] | undefined, key: string) {
  return facets?.find((facet) => normalizeCatalogText(facet.key) === normalizeCatalogText(key))
    ?.values;
}

function buildOptionsFromValues(
  values: string[],
  counts: Record<string, number>,
  fallbackValues: string[],
) {
  const normalizedValues = Object.keys(counts);
  if (normalizedValues.length === 0) {
    return fallbackValues;
  }

  return normalizedValues
    .map((value) => {
      const matchingValue = values.find(
        (candidate) => normalizeCatalogText(candidate) === normalizeCatalogText(value),
      );
      return matchingValue || value;
    })
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
}

function buildFacetOptionLabel(value: string, counts: Record<string, number>) {
  const count = counts[normalizeCatalogText(value)];
  return typeof count === "number" && count > 0 ? `${value} (${count})` : value;
}

function applyCatalogClientTransforms(
  products: Product[],
  options: {
    popularity: ProductPopularity[];
    wishlist: string[];
    savedOnly: boolean;
    sort: SortMode;
  },
) {
  let nextProducts = products;

  if (options.savedOnly) {
    nextProducts = nextProducts.filter((product) => options.wishlist.includes(product.id));
  }

  if (options.sort === "popular" && options.popularity.length > 0) {
    const popularityRank = new Map(
      options.popularity.map((item, index) => [item.product_id, item.quantity * 1000 - index]),
    );

    nextProducts = nextProducts
      .slice()
      .sort(
        (left, right) =>
          (popularityRank.get(right.id) ?? 0) - (popularityRank.get(left.id) ?? 0),
      );
  }

  return nextProducts;
}

export function CatalogPage({
  initialCategory,
  initialData,
}: {
  initialCategory?: string;
  initialData?: CatalogPageInitialData;
}) {
  return (
    <Suspense fallback={<CatalogPageFallback />}>
      <CatalogPageContent initialCategory={initialCategory} initialData={initialData} />
    </Suspense>
  );
}

function CatalogPageContent({
  initialCategory,
  initialData,
}: {
  initialCategory?: string;
  initialData?: CatalogPageInitialData;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { addItem } = useCartActions();
  const { wishlist, isSaved, toggleWishlist } = useWishlist();

  const [catalogIndex, setCatalogIndex] = useState<Product[]>(() => initialData?.catalogIndex ?? []);
  const [listingProducts, setListingProducts] = useState<Product[]>(() => initialData?.products ?? []);
  const [popularity, setPopularity] = useState<ProductPopularity[]>(() => initialData?.popularity ?? []);
  const [feedback, setFeedback] = useState(initialData?.feedback ?? "");
  const [busyProductId, setBusyProductId] = useState("");
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoadingIndex, setIsLoadingIndex] = useState(!initialData);
  const [isLoadingProducts, setIsLoadingProducts] = useState(!initialData);
  const [isPending, startTransition] = useTransition();
  const skipInitialIndexLoad = useRef(Boolean(initialData));
  const skipInitialProductLoad = useRef(Boolean(initialData));
  const [searchSuggestions, setSearchSuggestions] = useState<ProductSearchSuggestion[]>([]);
  const [assistResultCount, setAssistResultCount] = useState(0);
  const [searchHint, setSearchHint] = useState("");
  const [sortOptions, setSortOptions] = useState(defaultSortOptions);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [brandCounts, setBrandCounts] = useState<Record<string, number>>({});
  const [sizeCounts, setSizeCounts] = useState<Record<string, number>>({});
  const [colorCounts, setColorCounts] = useState<Record<string, number>>({});
  const lastRecordedFilterSignature = useRef("");

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [category, setCategory] = useState(initialCategory ?? searchParams.get("category") ?? "");
  const [brand, setBrand] = useState(searchParams.get("brand") ?? "");
  const [size, setSize] = useState(searchParams.get("size") ?? "");
  const [color, setColor] = useState(searchParams.get("color") ?? "");
  const [sort, setSort] = useState<SortMode>((searchParams.get("sort") as SortMode) || "latest");
  const [minPrice, setMinPrice] = useState(searchParams.get("min_price") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("max_price") ?? "");
  const [savedOnly, setSavedOnly] = useState(searchParams.get("saved") === "1");

  const deferredSearch = useDeferredValue(search);
  const liveRegionTimer = useRef<number | null>(null);
  const products = useMemo(
    () =>
      applyCatalogClientTransforms(listingProducts, {
        popularity,
        wishlist,
        savedOnly,
        sort,
      }),
    [listingProducts, popularity, savedOnly, sort, wishlist],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  useEffect(() => {
    if (initialCategory) {
      setCategory(initialCategory);
    }
  }, [initialCategory]);

  useEffect(() => {
    return () => {
      if (liveRegionTimer.current) {
        window.clearTimeout(liveRegionTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (skipInitialIndexLoad.current) {
      skipInitialIndexLoad.current = false;
      return;
    }

    let active = true;

    setIsLoadingIndex(true);
    void Promise.all([
      productApi.listProducts({ status: "active", limit: 120 }),
      productApi.getProductPopularity(120).catch(() => ({ data: [] as ProductPopularity[] })),
    ])
      .then(([catalogResponse, popularityResponse]) => {
        if (!active) {
          return;
        }

        setCatalogIndex(catalogResponse.data);
        setPopularity(popularityResponse.data);
        setFeedback("");
      })
      .catch((reason) => {
        if (!active) {
          return;
        }

        setCatalogIndex([]);
        setPopularity([]);
        setFeedback(getErrorMessage(reason));
      })
      .finally(() => {
        if (active) {
          setIsLoadingIndex(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const query = buildSearchParams({
      search: deferredSearch.trim() || undefined,
      category: category || undefined,
      brand: brand || undefined,
      size: size || undefined,
      color: color || undefined,
      sort: sort !== "latest" ? sort : undefined,
      min_price: minPrice || undefined,
      max_price: maxPrice || undefined,
      saved: savedOnly ? "1" : undefined,
    });

    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [brand, category, color, deferredSearch, maxPrice, minPrice, pathname, router, savedOnly, size, sort]);

  useEffect(() => {
    let active = true;

    void productApi
      .getSearchAssist({
        query: deferredSearch.trim() || undefined,
        category: category || undefined,
        status: "active",
        limit: 8,
      })
      .then((response) => {
        if (!active) {
          return;
        }

        const categoryFacetValues = readAssistFacetValues(response.data.facets, "category");
        const brandFacetValues = readAssistFacetValues(response.data.facets, "brand");
        const sizeFacetValues = readAssistFacetValues(response.data.facets, "size");
        const colorFacetValues = readAssistFacetValues(response.data.facets, "color");

        setSearchSuggestions(
          response.data.suggestions.filter(
            (suggestion) =>
              normalizeCatalogText(suggestion.value) !== normalizeCatalogText(deferredSearch),
          ),
        );
        setAssistResultCount(response.data.result_count);
        setCategoryCounts(buildFacetCountLookup(categoryFacetValues));
        setBrandCounts(buildFacetCountLookup(brandFacetValues));
        setSizeCounts(buildFacetCountLookup(sizeFacetValues));
        setColorCounts(buildFacetCountLookup(colorFacetValues));

        const nextSortOptions = response.data.sort_options
          .map((option) => ({
            label: option.label,
            value: option.value as SortMode,
          }))
          .filter((option) =>
            ["latest", "price_asc", "price_desc", "popular", "merchandising"].includes(
              option.value,
            ),
          );
        setSortOptions(nextSortOptions.length > 0 ? nextSortOptions : defaultSortOptions);

        if (response.data.applied_synonyms.length > 0) {
          setSearchHint(`Bao gồm từ liên quan: ${response.data.applied_synonyms.join(", ")}.`);
          return;
        }

        if (
          response.data.resolved_query &&
          normalizeCatalogText(response.data.resolved_query) !==
            normalizeCatalogText(deferredSearch)
        ) {
          setSearchHint(`Đang hiển thị kết quả gần đúng cho "${response.data.resolved_query}".`);
          return;
        }

        setSearchHint("");
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setSearchSuggestions([]);
        setAssistResultCount(0);
        setSearchHint("");
        setSortOptions(defaultSortOptions);
        setCategoryCounts({});
        setBrandCounts({});
        setSizeCounts({});
        setColorCounts({});
      });

    return () => {
      active = false;
    };
  }, [category, deferredSearch]);

  useEffect(() => {
    if (skipInitialProductLoad.current) {
      skipInitialProductLoad.current = false;
      return;
    }

    let active = true;

    setIsLoadingProducts(true);
    void productApi
      .listProducts({
        search: deferredSearch.trim() || undefined,
        category: category || undefined,
        brand: brand || undefined,
        size: size || undefined,
        color: color || undefined,
        status: "active",
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        sort: sort === "popular" ? "latest" : sort,
        limit: 80,
      })
      .then((response) => {
        if (!active) {
          return;
        }

        setListingProducts(response.data);
        setFeedback("");
      })
      .catch((reason) => {
        if (!active) {
          return;
        }

        setListingProducts([]);
        setFeedback(getErrorMessage(reason));
      })
      .finally(() => {
        if (active) {
          setIsLoadingProducts(false);
        }
      });

    return () => {
      active = false;
    };
  }, [brand, category, color, deferredSearch, maxPrice, minPrice, size, sort]);

  const categoryOptions = useMemo(
    () =>
      buildOptionsFromValues(
        catalogIndex.map((product) => product.category).filter(Boolean),
        categoryCounts,
        Array.from(new Set(catalogIndex.map((product) => product.category).filter(Boolean))).sort(),
      ),
    [catalogIndex, categoryCounts],
  );
  const brandOptions = useMemo(
    () =>
      buildOptionsFromValues(
        catalogIndex.map((product) => product.brand).filter(Boolean),
        brandCounts,
        Array.from(new Set(catalogIndex.map((product) => product.brand).filter(Boolean))).sort(),
      ),
    [brandCounts, catalogIndex],
  );
  const sizeOptions = useMemo(
    () => {
      const fallbackValues = Array.from(
        new Set(
          catalogIndex.flatMap((product) =>
            product.variants
              .map((variant) => variant.size)
              .filter((item): item is string => Boolean(item)),
          ),
        ),
      ).sort();
      return buildOptionsFromValues(fallbackValues, sizeCounts, fallbackValues);
    },
    [catalogIndex, sizeCounts],
  );
  const colorOptions = useMemo(
    () => {
      const fallbackValues = Array.from(
        new Set(
          catalogIndex.flatMap((product) =>
            product.variants
              .map((variant) => variant.color)
              .filter((item): item is string => Boolean(item)),
          ),
        ),
      ).sort();
      return buildOptionsFromValues(fallbackValues, colorCounts, fallbackValues);
    },
    [catalogIndex, colorCounts],
  );

  const activeProduct =
    activeProductId
      ? products.find((product) => product.id === activeProductId) ??
        catalogIndex.find((product) => product.id === activeProductId) ??
        null
      : null;
  const isAssistSummaryActive = Boolean(
    (deferredSearch.trim() || category) && !brand && !size && !color && !minPrice && !maxPrice && !savedOnly,
  );

  function announce(message: string) {
    setAnnouncement(message);
    if (liveRegionTimer.current) {
      window.clearTimeout(liveRegionTimer.current);
    }
    liveRegionTimer.current = window.setTimeout(() => setAnnouncement(""), 2400);
  }

  async function handleAddToCart(product: Product) {
    try {
      setBusyProductId(product.id);
      await addItem({ product_id: product.id, quantity: 1 });
      announce("Đã thêm sản phẩm vào giỏ hàng.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusyProductId("");
    }
  }

  function handleToggleWishlist(productId: string) {
    const wasSaved = isSaved(productId);
    toggleWishlist(productId);
    announce(wasSaved ? "Đã bỏ khỏi danh sách yêu thích." : "Đã lưu vào danh sách yêu thích.");
  }

  function resetFilters() {
    setSearch("");
    setCategory(initialCategory ?? "");
    setBrand("");
    setSize("");
    setColor("");
    setSort("latest");
    setMinPrice("");
    setMaxPrice("");
    setSavedOnly(false);
  }

  function handleSelectSearchSuggestion(suggestion: ProductSearchSuggestion) {
    startTransition(() => {
      if (suggestion.kind === "category") {
        setCategory(suggestion.value);
        setSearch("");
        return;
      }

      if (suggestion.kind === "brand") {
        setBrand(suggestion.value);
        setSearch("");
        return;
      }

      setSearch(suggestion.value);
    });
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveProductId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveProductId(null);

    const productId = String(event.active.id);
    const overId = String(event.over?.id ?? "");
    const product = products.find((item) => item.id === productId);

    if (!product) {
      return;
    }

    if (overId === "drop-cart") {
      void handleAddToCart(product);
    }

    if (overId === "drop-wishlist") {
      handleToggleWishlist(product.id);
    }
  }

  const recordFilterAnalytics = useCallback((resultCount: number) => {
    const normalizedSearch = deferredSearch.trim();
    const activeFilters = [
      category ? { key: "category", value: category } : null,
      brand ? { key: "brand", value: brand } : null,
      size ? { key: "size", value: size } : null,
      color ? { key: "color", value: color } : null,
      minPrice ? { key: "min_price", value: minPrice } : null,
      maxPrice ? { key: "max_price", value: maxPrice } : null,
      savedOnly ? { key: "saved", value: "1" } : null,
    ].filter((entry): entry is { key: string; value: string } => Boolean(entry));

    const signature = JSON.stringify({
      search: normalizedSearch,
      category,
      brand,
      size,
      color,
      minPrice,
      maxPrice,
      savedOnly,
      resultCount,
    });
    if (lastRecordedFilterSignature.current === signature) {
      return;
    }
    lastRecordedFilterSignature.current = signature;

    activeFilters.forEach((filter) => {
      void productApi.recordSearchEvent({
        source: "catalog",
        event_kind: "filter_apply",
        query: normalizedSearch || undefined,
        category: category || undefined,
        filter_key: filter.key,
        filter_value: filter.value,
      });
    });
  }, [brand, category, color, deferredSearch, maxPrice, minPrice, savedOnly, size]);

  function handleProductNavigate(product: Product) {
    const query = deferredSearch.trim();
    if (!query) {
      return;
    }

    void productApi.recordSearchEvent({
      source: "catalog",
      event_kind: "result_click",
      query,
      category: category || product.category || undefined,
    });
  }

  useEffect(() => {
    if (isLoadingProducts) {
      return;
    }

    recordFilterAnalytics(listingProducts.length);
  }, [isLoadingProducts, listingProducts.length, recordFilterAnalytics]);

  return (
    <>
      <SiteHeader />
      <main className="shell section-spacing">
        <SectionHeading
          eyebrow="Catalog"
          title="Tìm kiếm, lọc và sắp xếp trực tiếp trên dữ liệu thật của product-service."
          description="Các bộ lọc, query params, trạng thái rỗng và kéo thả đều dùng dữ liệu thật để bạn kiểm thử storefront end-to-end thay vì data mẫu."
        />

        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>

        <div className="mt-10 flex flex-col gap-4 rounded-[1.8rem] bg-surface-container-low p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3 rounded-full bg-background px-4 py-3">
              <Search className="h-4 w-4 text-outline" />
              <TextInput
                aria-label="Tìm kiếm sản phẩm"
                className="border-0 bg-transparent py-0 shadow-none"
                placeholder="Tìm theo tên, mô tả, brand hoặc category..."
                value={search}
                onChange={(event) => startTransition(() => setSearch(event.target.value))}
              />
            </div>

            {search.trim() && searchSuggestions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {searchSuggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.kind}-${suggestion.value}`}
                    type="button"
                    className="rounded-full border border-outline-variant/30 bg-background px-3 py-2 text-xs font-medium text-primary transition hover:border-outline hover:bg-surface"
                    onClick={() => handleSelectSearchSuggestion(suggestion)}
                  >
                    {suggestion.value}
                    <span className="ml-2 text-on-surface-variant">
                      {suggestion.kind} {suggestion.match_count}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {searchHint ? (
              <p className="text-sm leading-7 text-on-surface-variant">{searchHint}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "lg:hidden")}
              onClick={() => setIsFilterOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Bộ lọc
            </button>

            <Select
              aria-label="Sắp xếp sản phẩm"
              className="min-w-44"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortMode)}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {feedback ? (
          <div className="mt-6">
            <InlineAlert tone="error">{feedback}</InlineAlert>
          </div>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <CatalogFilters {...{
            mobileOpen: isFilterOpen,
            category,
            brand,
            size,
            color,
            minPrice,
            maxPrice,
            savedOnly,
            categoryOptions,
            brandOptions,
            sizeOptions,
            colorOptions,
            categoryCounts,
            brandCounts,
            sizeCounts,
            colorCounts,
            onClose: () => setIsFilterOpen(false),
            onCategoryChange: setCategory,
            onBrandChange: setBrand,
            onSizeChange: setSize,
            onColorChange: setColor,
            onMinPriceChange: setMinPrice,
            onMaxPriceChange: setMaxPrice,
            onSavedOnlyChange: setSavedOnly,
            onReset: resetFilters,
          }} />

          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-on-surface-variant">
              <span>
                Hiển thị <strong className="text-primary">{products.length}</strong>
                {isAssistSummaryActive ? (
                  <>
                    {" "}
                    / <strong className="text-primary">{assistResultCount}</strong> kết quả gợi ý
                  </>
                ) : (
                  <>
                    {" "}
                    / {catalogIndex.length || products.length} sản phẩm
                  </>
                )}
              </span>
              <span>{isPending || isLoadingProducts ? "Đang cập nhật kết quả..." : "Kết quả đã đồng bộ"}</span>
            </div>

            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {isLoadingIndex || isLoadingProducts ? (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <ProductCardSkeleton key={index} />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <EmptyState
                  title="Không có sản phẩm phù hợp"
                  description="Hãy nới bộ lọc hoặc thử từ khóa khác. Query params vẫn được giữ nguyên để bạn có thể chia sẻ trạng thái tìm kiếm này."
                  action={
                    <button
                      type="button"
                      className={buttonStyles({ variant: "secondary" })}
                      onClick={resetFilters}
                    >
                      Xóa bộ lọc
                    </button>
                  }
                />
              ) : (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {products.map((product) => (
                    <DraggableCatalogCard
                      key={product.id}
                      product={product}
                      saved={isSaved(product.id)}
                      busy={busyProductId === product.id}
                      onAddToCart={() => void handleAddToCart(product)}
                      onNavigate={() => handleProductNavigate(product)}
                      onToggleWishlist={() => handleToggleWishlist(product.id)}
                    />
                  ))}
                </div>
              )}

              <div className="fixed bottom-5 right-5 z-40 flex flex-col gap-3">
                <DropDock
                  id="drop-cart"
                  label="Kéo vào giỏ hàng"
                  icon={<PackagePlus className="h-4 w-4" />}
                />
                <DropDock
                  id="drop-wishlist"
                  label="Kéo vào yêu thích"
                  icon={<Heart className="h-4 w-4" />}
                />
              </div>

              <DragOverlay>
                {activeProduct ? (
                  <div className="w-[320px] rounded-[2rem] bg-background/96 p-3 shadow-editorial backdrop-blur-xl">
                    <ProductCard product={activeProduct} saved={isSaved(activeProduct.id)} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function CatalogPageFallback() {
  return (
    <>
      <SiteHeader />
      <main className="shell section-spacing">
        <SectionHeading
          eyebrow="Catalog"
          title="Đang tải catalog sản phẩm"
          description="Storefront đang đồng bộ bộ lọc và query params trước khi hiển thị dữ liệu thật từ product-service."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function CatalogFilters(props: FilterPanelProps) {
  const content = (
    <SurfaceCard className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Filters</p>
          <h3 className="mt-3 font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
            Lọc catalog
          </h3>
        </div>
        <button
          type="button"
          className={buttonStyles({ variant: "tertiary" })}
          onClick={props.onReset}
        >
          Reset
        </button>
      </div>

      <div className="mt-6 space-y-5">
        <Select
          aria-label="Lọc theo danh mục"
          value={props.category}
          onChange={(event) => props.onCategoryChange(event.target.value)}
        >
          <option value="">Tất cả category</option>
          {props.categoryOptions.map((item) => (
            <option key={item} value={item}>
              {buildFacetOptionLabel(item, props.categoryCounts)}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Lọc theo thương hiệu"
          value={props.brand}
          onChange={(event) => props.onBrandChange(event.target.value)}
        >
          <option value="">Tất cả brand</option>
          {props.brandOptions.map((item) => (
            <option key={item} value={item}>
              {buildFacetOptionLabel(item, props.brandCounts)}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Select
            aria-label="Lọc theo kích cỡ"
            value={props.size}
            onChange={(event) => props.onSizeChange(event.target.value)}
          >
            <option value="">Mọi size</option>
            {props.sizeOptions.map((item) => (
              <option key={item} value={item}>
                {buildFacetOptionLabel(item, props.sizeCounts)}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Lọc theo màu sắc"
            value={props.color}
            onChange={(event) => props.onColorChange(event.target.value)}
          >
            <option value="">Mọi màu</option>
            {props.colorOptions.map((item) => (
              <option key={item} value={item}>
                {buildFacetOptionLabel(item, props.colorCounts)}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextInput
            aria-label="Giá tối thiểu"
            placeholder="Giá từ"
            value={props.minPrice}
            onChange={(event) =>
              props.onMinPriceChange(event.target.value.replace(/[^\d.]/g, ""))
            }
          />
          <TextInput
            aria-label="Giá tối đa"
            placeholder="Giá đến"
            value={props.maxPrice}
            onChange={(event) =>
              props.onMaxPriceChange(event.target.value.replace(/[^\d.]/g, ""))
            }
          />
        </div>

        <label className="flex items-center gap-3 rounded-[1.25rem] bg-surface px-4 py-4 text-sm text-on-surface">
          <input
            checked={props.savedOnly}
            type="checkbox"
            onChange={(event) => props.onSavedOnlyChange(event.target.checked)}
          />
          Chỉ xem sản phẩm đã lưu
        </label>
      </div>
    </SurfaceCard>
  );

  return (
    <>
      <div className="hidden lg:block">{content}</div>
      {props.mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-primary/25 px-4 py-24 lg:hidden">
          <div className="mx-auto max-w-md">
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-background text-primary"
                onClick={props.onClose}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {content}
          </div>
        </div>
      ) : null}
    </>
  );
}

function DraggableCatalogCard({
  product,
  saved,
  busy,
  onAddToCart,
  onNavigate,
  onToggleWishlist,
}: {
  product: Product;
  saved: boolean;
  busy: boolean;
  onAddToCart: () => void;
  onNavigate: () => void;
  onToggleWishlist: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: product.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("transition", isDragging && "opacity-40")}
    >
      <div {...attributes} {...listeners}>
        <ProductCard
          product={product}
          saved={saved}
          onNavigate={onNavigate}
          footerSlot={
            <button
              type="button"
              className="text-sm font-medium text-tertiary hover:text-tertiary-container"
              onClick={onToggleWishlist}
            >
              {saved ? "Đã lưu" : "Lưu yêu thích"}
            </button>
          }
          actionSlot={
            <ProductCardAction
              onClick={onAddToCart}
              disabled={product.stock <= 0}
              loading={busy}
            />
          }
        />
      </div>
    </div>
  );
}

function DropDock({
  id,
  label,
  icon,
}: {
  id: string;
  label: string;
  icon: ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <motion.div
      ref={setNodeRef}
      animate={{ scale: isOver ? 1.04 : 1 }}
      className={cn(
        "flex items-center gap-3 rounded-full px-5 py-3 shadow-editorial backdrop-blur-xl",
        isOver ? "bg-primary text-on-primary" : "bg-background/90 text-primary",
      )}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </motion.div>
  );
}
