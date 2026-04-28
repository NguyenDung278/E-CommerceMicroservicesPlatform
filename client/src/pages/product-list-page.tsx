import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "react-router-dom";
import { Filter, Search, X } from "lucide-react";
import { ProductCard } from "../components/product-card";
import { EmptyView, ErrorView, LoadingView } from "../components/status-view";
import {
  getProductSearchAssist,
  listCategories,
  listProducts,
  recordSearchAnalyticsEvent,
} from "../services/product-service";
import type { ApiMeta, Product, ProductSearchAssist, StorefrontCategory } from "../types/api";

const recentSearchesKey = "nd_recent_product_searches";
const facetFilters = [
  { key: "brand", label: "Thương hiệu" },
  { key: "tag", label: "Bộ sưu tập" },
  { key: "size", label: "Kích cỡ" },
  { key: "color", label: "Màu sắc" },
] as const;

type FacetKey = (typeof facetFilters)[number]["key"];

const defaultSortOptions = [
  { value: "latest", label: "Mới nhất" },
  { value: "merchandising", label: "Gợi ý nổi bật" },
  { value: "popular", label: "Được mua nhiều" },
  { value: "price_asc", label: "Giá thấp đến cao" },
  { value: "price_desc", label: "Giá cao đến thấp" },
];

function parsePrice(value: string) {
  const numberValue = Number(value);
  return value && Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined;
}

function getFacetValues(assist: ProductSearchAssist | null, key: FacetKey) {
  return assist?.facets?.find((facet) => facet.key === key)?.values ?? [];
}

function readRecentSearches() {
  try {
    const parsed = JSON.parse(localStorage.getItem(recentSearchesKey) ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function writeRecentSearch(query: string) {
  const clean = query.trim();
  if (!clean) {
    return readRecentSearches();
  }

  const next = [clean, ...readRecentSearches().filter((item) => item !== clean)].slice(0, 6);
  localStorage.setItem(recentSearchesKey, JSON.stringify(next));
  return next;
}

export function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<StorefrontCategory[]>([]);
  const [assist, setAssist] = useState<ProductSearchAssist | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const search = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";
  const brand = searchParams.get("brand") ?? "";
  const tag = searchParams.get("tag") ?? "";
  const size = searchParams.get("size") ?? "";
  const color = searchParams.get("color") ?? "";
  const sort = searchParams.get("sort") ?? "latest";
  const cursor = searchParams.get("cursor") ?? "";
  const minPrice = searchParams.get("min_price") ?? "";
  const maxPrice = searchParams.get("max_price") ?? "";
  const [searchDraft, setSearchDraft] = useState(search);
  const [priceDraft, setPriceDraft] = useState({ min: minPrice, max: maxPrice });

  const selectedCategory = categories.find((item) => item.slug === category);
  const sortOptions =
    assist?.sort_options && assist.sort_options.length > 0
      ? assist.sort_options
      : defaultSortOptions;
  const activeFilterCount = useMemo(
    () =>
      [
        search,
        category,
        brand,
        tag,
        size,
        color,
        minPrice,
        maxPrice,
        sort !== "latest" ? sort : "",
      ].filter(Boolean).length,
    [brand, category, color, maxPrice, minPrice, search, size, sort, tag],
  );

  useEffect(() => {
    setRecentSearches(readRecentSearches());
  }, []);

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  useEffect(() => {
    setPriceDraft({ min: minPrice, max: maxPrice });
  }, [maxPrice, minPrice]);

  useEffect(() => {
    if (search.trim()) {
      setRecentSearches(writeRecentSearch(search));
    }
  }, [search]);

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      try {
        setLoading(true);
        setError(null);
        const [categoryData, productResponse, assistData] = await Promise.all([
          listCategories().catch(() => []),
          listProducts({
            search,
            category,
            brand,
            tag,
            cursor,
            sort,
            min_price: parsePrice(minPrice),
            max_price: parsePrice(maxPrice),
            size,
            color,
            limit: 24,
          }),
          getProductSearchAssist({ query: search, category, status: "active", limit: 8 }).catch(
            () => null,
          ),
        ]);

        if (active) {
          setCategories(Array.isArray(categoryData) ? categoryData : []);
          setProducts(productResponse.data);
          setMeta(productResponse.meta ?? null);
          setAssist(assistData);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Không tải được danh sách sản phẩm");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProducts();

    return () => {
      active = false;
    };
  }, [brand, category, color, cursor, maxPrice, minPrice, search, size, sort, tag]);

  function setFilter(key: string, value: string) {
    if (value) {
      void recordSearchAnalyticsEvent({
        source: "product_list",
        event_kind: "filter_apply",
        query: key === "search" ? value : search,
        category,
        filter_key: key,
        filter_value: value,
      }).catch(() => undefined);
    }

    startTransition(() => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("cursor");
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
        return next;
      });
    });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilter("search", searchDraft.trim());
  }

  function submitPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const min = priceDraft.min.trim();
    const max = priceDraft.max.trim();
    if (min || max) {
      void recordSearchAnalyticsEvent({
        source: "product_list",
        event_kind: "filter_apply",
        query: search,
        category,
        filter_key: "price",
        filter_value: `${min || "0"}-${max || "max"}`,
      }).catch(() => undefined);
    }

    startTransition(() => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("cursor");
        if (parsePrice(min)) {
          next.set("min_price", min);
        } else {
          next.delete("min_price");
        }
        if (parsePrice(max)) {
          next.set("max_price", max);
        } else {
          next.delete("max_price");
        }
        return next;
      });
    });
  }

  function clearFilters() {
    startTransition(() => {
      setSearchParams(new URLSearchParams());
    });
  }

  function applyRecentSearch(value: string) {
    setFilter("search", value);
  }

  function goNext() {
    if (!meta?.next_cursor) {
      return;
    }

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("cursor", meta.next_cursor ?? "");
      return next;
    });
  }

  function trackProductClick(product: Product) {
    if (!search.trim()) {
      return;
    }

    void recordSearchAnalyticsEvent({
      source: "product_list",
      event_kind: "result_click",
      query: search,
      category,
      filter_key: "product_id",
      filter_value: product.id,
    }).catch(() => undefined);
  }

  if (loading && !isPending) {
    return <LoadingView label="Đang tải danh sách sản phẩm" />;
  }

  return (
    <div className="page-stack">
      <section className="category-landing">
        <div>
          <span className="eyebrow">Product discovery</span>
          <h1>{selectedCategory?.display_name || "Tìm sản phẩm phù hợp"}</h1>
          <p>
            {assist
              ? `${assist.result_count} kết quả liên quan`
              : "Lọc nhanh theo danh mục, giá và thuộc tính."}
          </p>
        </div>
        <form className="category-landing__search" onSubmit={submitSearch}>
          <Search size={18} />
          <input
            value={searchDraft}
            placeholder="Tìm sản phẩm, thương hiệu, SKU"
            onChange={(event) => setSearchDraft(event.target.value)}
          />
          <button type="submit">Tìm</button>
        </form>
      </section>

      <section className="discovery-layout">
        <aside className="filter-sidebar">
          <div className="filter-sidebar__title">
            <div>
              <span className="eyebrow">Filters</span>
              <h2>Bộ lọc</h2>
            </div>
            <Filter size={20} />
          </div>

          {activeFilterCount > 0 ? (
            <button className="chip-button chip-button--clear" type="button" onClick={clearFilters}>
              <X size={14} />
              Xóa {activeFilterCount} bộ lọc
            </button>
          ) : null}

          <label>
            Sắp xếp
            <select value={sort} onChange={(event) => setFilter("sort", event.target.value)}>
              {sortOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <div className="filter-group">
            <strong>Danh mục</strong>
            <div className="chip-list">
              <button
                className={`chip-button${!category ? " is-active" : ""}`}
                type="button"
                onClick={() => setFilter("category", "")}
              >
                Tất cả
              </button>
              {categories.map((item) => (
                <button
                  key={item.slug}
                  className={`chip-button${category === item.slug ? " is-active" : ""}`}
                  type="button"
                  onClick={() => setFilter("category", item.slug)}
                >
                  {item.nav_label || item.display_name}
                </button>
              ))}
            </div>
          </div>

          <form className="filter-group" onSubmit={submitPrice}>
            <strong>Khoảng giá</strong>
            <div className="price-filter">
              <input
                inputMode="numeric"
                placeholder="Từ"
                value={priceDraft.min}
                onChange={(event) =>
                  setPriceDraft((current) => ({ ...current, min: event.target.value }))
                }
              />
              <input
                inputMode="numeric"
                placeholder="Đến"
                value={priceDraft.max}
                onChange={(event) =>
                  setPriceDraft((current) => ({ ...current, max: event.target.value }))
                }
              />
            </div>
            <button className="button button--secondary" type="submit">
              Áp dụng giá
            </button>
          </form>

          {facetFilters.map((facet) => {
            const values = getFacetValues(assist, facet.key).slice(0, 8);
            if (values.length === 0) {
              return null;
            }

            const activeValue = searchParams.get(facet.key) ?? "";
            return (
              <div className="filter-group" key={facet.key}>
                <strong>{facet.label}</strong>
                <div className="chip-list">
                  {values.map((item) => (
                    <button
                      key={`${facet.key}-${item.value}`}
                      className={`chip-button${activeValue === item.value ? " is-active" : ""}`}
                      type="button"
                      onClick={() =>
                        setFilter(facet.key, activeValue === item.value ? "" : item.value)
                      }
                    >
                      {item.value}
                      <span>{item.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </aside>

        <div className="surface-section discovery-results">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Catalog</span>
              <h2>{search ? `Kết quả cho "${search}"` : "Danh sách sản phẩm"}</h2>
              {assist?.applied_synonyms && assist.applied_synonyms.length > 0 ? (
                <p>Đã mở rộng tìm kiếm: {assist.applied_synonyms.join(", ")}</p>
              ) : null}
            </div>
          </div>

          {recentSearches.length > 0 ? (
            <div className="recent-searches">
              <span>Tìm gần đây</span>
              {recentSearches.map((item) => (
                <button key={item} type="button" onClick={() => applyRecentSearch(item)}>
                  {item}
                </button>
              ))}
            </div>
          ) : null}

          {error ? <ErrorView message={error} /> : null}

          {!error && products.length === 0 ? (
            <EmptyView title="Không có sản phẩm phù hợp">
              Thử đổi từ khóa, khoảng giá hoặc danh mục rồi tải lại.
            </EmptyView>
          ) : null}

          {products.length > 0 ? (
            <>
              <div className="product-grid">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onProductClick={trackProductClick}
                  />
                ))}
              </div>
              {meta?.has_next ? (
                <div className="pagination-row">
                  <button className="button button--secondary" type="button" onClick={goNext}>
                    Xem tiếp
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
