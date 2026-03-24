import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ProductCard } from "../components/ProductCard";
import { useCart } from "../hooks/useCart";
import { api, getErrorMessage } from "../lib/api";
import type { Product } from "../types/api";
import { formatCurrency } from "../utils/format";
import "./catalog.css";

export function CatalogPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addItem } = useCart();
  const [catalogIndex, setCatalogIndex] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [submittedSearch, setSubmittedSearch] = useState(searchParams.get("search") ?? "");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [sortBy, setSortBy] = useState<"latest" | "price_asc" | "price_desc" | "popular">("latest");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [feedback, setFeedback] = useState("");
  const [busyProductId, setBusyProductId] = useState("");

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        catalogIndex
          .map((product) => product.category)
          .filter((category): category is string => Boolean(category))
      )
    ).sort();
  }, [catalogIndex]);

  const brands = useMemo(() => {
    return Array.from(
      new Set(catalogIndex.map((product) => product.brand).filter((brand): brand is string => Boolean(brand)))
    ).sort();
  }, [catalogIndex]);

  const tags = useMemo(() => {
    return Array.from(
      new Set(catalogIndex.flatMap((product) => product.tags).filter((tag): tag is string => Boolean(tag)))
    ).sort();
  }, [catalogIndex]);

  const sizes = useMemo(() => {
    return Array.from(
      new Set(
        catalogIndex.flatMap((product) =>
          product.variants.map((variant) => variant.size).filter((size): size is string => Boolean(size))
        )
      )
    ).sort();
  }, [catalogIndex]);

  const colors = useMemo(() => {
    return Array.from(
      new Set(
        catalogIndex.flatMap((product) =>
          product.variants.map((variant) => variant.color).filter((color): color is string => Boolean(color))
        )
      )
    ).sort();
  }, [catalogIndex]);

  useEffect(() => {
    const searchFromQuery = searchParams.get("search") ?? "";
    setSubmittedSearch(searchFromQuery);
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    void api
      .listProducts({ status: "active" })
      .then((response) => {
        if (active) {
          setCatalogIndex(response.data);
        }
      })
      .catch((reason) => {
        if (active) {
          setFeedback(getErrorMessage(reason));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const minPrice = Number.parseFloat(priceRange.min);
    const maxPrice = Number.parseFloat(priceRange.max);

    void api
      .listProducts({
        search: submittedSearch,
        category: selectedCategory || undefined,
        brand: selectedBrand || undefined,
        tag: selectedTag || undefined,
        status: "active",
        minPrice: Number.isFinite(minPrice) && minPrice > 0 ? minPrice : undefined,
        maxPrice: Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : undefined,
        size: selectedSize || undefined,
        color: selectedColor || undefined,
        sort: sortBy === "popular" ? "latest" : sortBy
      })
      .then(async (response) => {
        let nextProducts = response.data;
        if (sortBy === "popular") {
          try {
            const popularityResponse = await api.getProductPopularity(response.data.length || 100);
            const popularityRank = new Map(
              popularityResponse.data.map((item, index) => [item.product_id, item.quantity * 1000 - index])
            );
            nextProducts = response.data
              .slice()
              .sort((left, right) => (popularityRank.get(right.id) ?? -1) - (popularityRank.get(left.id) ?? -1));
          } catch {
            nextProducts = response.data;
          }
        }

        if (active) {
          setProducts(nextProducts);
          setFeedback("");
        }
      })
      .catch((reason) => {
        if (active) {
          setFeedback(getErrorMessage(reason));
        }
      });

    return () => {
      active = false;
    };
  }, [
    submittedSearch,
    selectedCategory,
    selectedBrand,
    selectedTag,
    selectedSize,
    selectedColor,
    sortBy,
    priceRange.min,
    priceRange.max
  ]);

  async function handleAddToCart(product: Product) {
    try {
      setBusyProductId(product.id);
      await addItem({
        product_id: product.id,
        quantity: 1
      });
      setFeedback(`${product.name} đã được thêm vào giỏ hàng.`);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusyProductId("");
    }
  }

  function handlePriceChange(field: "min" | "max", event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value.replace(/[^\d.]/g, "");
    setPriceRange((current) => ({ ...current, [field]: value }));
  }

  function clearFilters() {
    setSubmittedSearch("");
    setSelectedCategory("");
    setSelectedBrand("");
    setSelectedTag("");
    setSelectedSize("");
    setSelectedColor("");
    setSortBy("latest");
    setPriceRange({ min: "", max: "" });
  }

  const activeFilterCount = [
    submittedSearch,
    selectedCategory,
    selectedBrand,
    selectedTag,
    selectedSize,
    selectedColor,
    priceRange.min,
    priceRange.max,
    sortBy !== "latest" ? sortBy : ""
  ].filter(Boolean).length;
  const resultCountLabel = `Showing ${products.length} of ${catalogIndex.length || products.length} Objects`;
  const statusCopy = catalogIndex.length > 0
    ? `Kho dữ liệu đang online với khoảng giá ${formatCurrency(
        Math.min(...catalogIndex.map((product) => product.price))
      )} - ${formatCurrency(Math.max(...catalogIndex.map((product) => product.price)))}`
    : "Đang chờ đồng bộ danh mục từ backend";
  const selectedSummary = [
    submittedSearch ? `Search: ${submittedSearch}` : "",
    selectedCategory || "",
    selectedBrand || "",
    selectedTag ? `#${selectedTag}` : "",
    selectedSize ? `Size ${selectedSize}` : "",
    selectedColor || ""
  ]
    .filter(Boolean)
    .join(" / ");
  const colorOptions = colors.length > 0 ? colors : ["forest", "cream", "terracotta", "slate", "sage"];

  return (
    <div className="archive-shell">
      <header className="archive-editorial-header">
        <div className="archive-editorial-copy">
          <h1>The Curated Archive</h1>
          <p>
            A dialogue between traditional craftsmanship and modern silhouette. Explore our latest seasonal arrivals
            from the Digital Atelier.
          </p>
        </div>
      </header>

      <div className="archive-layout">
        <aside className="archive-sidebar">
          <section className="archive-filter-section">
            <h3>Collections</h3>
            <div className="archive-collection-list">
              <button
                className={!selectedCategory ? "archive-collection-link archive-collection-link-active" : "archive-collection-link"}
                type="button"
                onClick={() => setSelectedCategory("")}
              >
                All Archive
              </button>
              {categories.map((category) => (
                <button
                  className={
                    selectedCategory === category
                      ? "archive-collection-link archive-collection-link-active"
                      : "archive-collection-link"
                  }
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </section>

          {sizes.length > 0 ? (
            <section className="archive-filter-section">
              <h3>Size</h3>
              <div className="archive-size-grid">
                <button
                  className={!selectedSize ? "archive-size-button archive-size-button-active" : "archive-size-button"}
                  type="button"
                  onClick={() => setSelectedSize("")}
                >
                  All
                </button>
                {sizes.map((size) => (
                  <button
                    className={selectedSize === size ? "archive-size-button archive-size-button-active" : "archive-size-button"}
                    key={size}
                    type="button"
                    onClick={() => setSelectedSize(size ?? "")}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="archive-filter-section">
            <h3>Tonal Palette</h3>
            <div className="archive-color-row">
              <button
                className={!selectedColor ? "archive-color-chip archive-color-chip-active" : "archive-color-chip"}
                style={swatchStyle("forest")}
                title="Tất cả màu"
                type="button"
                onClick={() => setSelectedColor("")}
              />
              {colorOptions.map((color) => (
                <button
                  className={selectedColor === color ? "archive-color-chip archive-color-chip-active" : "archive-color-chip"}
                  key={color}
                  style={swatchStyle(color)}
                  title={color}
                  type="button"
                  onClick={() => setSelectedColor(color ?? "")}
                />
              ))}
            </div>
          </section>

          <section className="archive-filter-section">
            <h3>Value</h3>
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
          </section>

          <section className="archive-filter-section">
            <h3>The Atelier</h3>
            <div className="archive-brand-list">
              <button
                className={!selectedBrand ? "archive-brand-option archive-brand-option-active" : "archive-brand-option"}
                type="button"
                onClick={() => setSelectedBrand("")}
              >
                All Houses
              </button>
              {brands.map((brand) => (
                <button
                  className={selectedBrand === brand ? "archive-brand-option archive-brand-option-active" : "archive-brand-option"}
                  key={brand}
                  type="button"
                  onClick={() => setSelectedBrand(brand)}
                >
                  {brand}
                </button>
              ))}
            </div>
          </section>

          {tags.length > 0 ? (
            <section className="archive-filter-section">
              <h3>Signals</h3>
              <div className="archive-tag-list">
                <button
                  className={!selectedTag ? "archive-tag-button archive-tag-button-active" : "archive-tag-button"}
                  type="button"
                  onClick={() => setSelectedTag("")}
                >
                  All
                </button>
                {tags.map((tag) => (
                  <button
                    className={selectedTag === tag ? "archive-tag-button archive-tag-button-active" : "archive-tag-button"}
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <button className="archive-reset-button" type="button" onClick={clearFilters}>
            Reset Filters
          </button>

          <div className="archive-service-note">
            <span>Inventory Service</span>
            <strong>{catalogIndex.length > 0 ? "Online & synchronized" : "Waiting for sync"}</strong>
            <p>{statusCopy}</p>
          </div>
        </aside>

        <section className="archive-results">
          <div className="archive-results-toolbar">
            <span>{resultCountLabel}</span>
            <div className="archive-sort-row">
              <label htmlFor="archive-sort">Sort By</label>
              <select
                id="archive-sort"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
              >
                <option value="latest">Newest Arrivals</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="popular">Popular</option>
              </select>
            </div>
          </div>

          {selectedSummary || activeFilterCount > 0 ? (
            <p className="archive-results-summary">
              {selectedSummary || `${activeFilterCount} filters active`}
            </p>
          ) : null}

          {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}

          {products.length > 0 ? (
            <div className="archive-product-grid">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  busy={busyProductId === product.id}
                  onAddToCart={handleAddToCart}
                  onBuyNow={(selected) =>
                    navigate("/checkout", {
                      state: {
                        directProduct: {
                          id: selected.id,
                          name: selected.name,
                          price: selected.price,
                          quantity: 1
                        }
                      }
                    })
                  }
                  product={product}
                  variant="archive"
                />
              ))}
            </div>
          ) : feedback ? null : (
            <div className="empty-card catalog-empty-state archive-empty-state">
              <strong>Chưa có sản phẩm khớp bộ lọc hiện tại.</strong>
              <span>Hãy nới bộ lọc hoặc thử từ khóa khác để xem lại toàn bộ curated archive.</span>
              <button className="ghost-button" type="button" onClick={clearFilters}>
                Đặt lại bộ lọc
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function swatchStyle(color: string): CSSProperties {
  const normalized = color.trim().toLowerCase();
  const palette: Record<string, string> = {
    forest: "#061b0e",
    green: "#364c3c",
    sage: "#7d9483",
    cream: "#f5f3ee",
    white: "#fbf9f4",
    ivory: "#f5f3ee",
    beige: "#d8cab7",
    tan: "#b99572",
    brown: "#7b5b47",
    terracotta: "#d07d63",
    orange: "#d07d63",
    red: "#9b4731",
    slate: "#5b617d",
    blue: "#5b617d",
    black: "#1b1c19",
    gray: "#8f8f87",
    grey: "#8f8f87"
  };

  return {
    background: palette[normalized] ?? "#364c3c",
    border:
      normalized === "cream" || normalized === "white" || normalized === "ivory"
        ? "1px solid rgba(115, 121, 115, 0.25)"
        : undefined
  };
}
