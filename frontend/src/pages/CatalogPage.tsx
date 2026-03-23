import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { ProductCard } from "../components/ProductCard";
import { useCart } from "../hooks/useCart";
import { api, getErrorMessage } from "../lib/api";
import type { Product } from "../types/api";
import { formatCurrency } from "../utils/format";

export function CatalogPage() {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [catalogIndex, setCatalogIndex] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
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
      new Set(catalogIndex.map((product) => product.category).filter((category) => Boolean(category)))
    ).sort();
  }, [catalogIndex]);

  const brands = useMemo(() => {
    return Array.from(new Set(catalogIndex.map((product) => product.brand).filter(Boolean))).sort();
  }, [catalogIndex]);

  const tags = useMemo(() => {
    return Array.from(new Set(catalogIndex.flatMap((product) => product.tags).filter(Boolean))).sort();
  }, [catalogIndex]);

  const sizes = useMemo(() => {
    return Array.from(
      new Set(catalogIndex.flatMap((product) => product.variants.map((variant) => variant.size).filter(Boolean)))
    ).sort();
  }, [catalogIndex]);

  const colors = useMemo(() => {
    return Array.from(
      new Set(catalogIndex.flatMap((product) => product.variants.map((variant) => variant.color).filter(Boolean)))
    ).sort();
  }, [catalogIndex]);

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
  }, [submittedSearch, selectedCategory, selectedBrand, selectedTag, selectedSize, selectedColor, sortBy, priceRange.min, priceRange.max]);

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

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  function handlePriceChange(field: "min" | "max", event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value.replace(/[^\d.]/g, "");
    setPriceRange((current) => ({ ...current, [field]: value }));
  }

  function clearFilters() {
    setSearch("");
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
  const resultCountLabel = `${products.length} / ${catalogIndex.length || products.length}`;
  const title = selectedCategory || selectedBrand || "Curated Catalog";
  const statusCopy = catalogIndex.length > 0
    ? `Kho dữ liệu đang online với khoảng giá ${formatCurrency(
        Math.min(...catalogIndex.map((product) => product.price))
      )} - ${formatCurrency(Math.max(...catalogIndex.map((product) => product.price)))}`
    : "Đang chờ đồng bộ danh mục từ backend";

  return (
    <div className="catalog-shell">
      <aside className="catalog-sidebar">
        <div className="catalog-sidebar-section">
          <span className="section-kicker">Filter Studio</span>
          <h2>Refine the collection</h2>
          <p>Dùng bộ lọc thật của storefront để kiểm tra tìm kiếm, category, brand, tag, size, color và price range.</p>
        </div>

        <form className="catalog-search-form" onSubmit={handleSearch}>
          <input
            placeholder="Search curated items..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button className="ghost-button" type="submit">
            Tìm kiếm
          </button>
        </form>

        <div className="catalog-sidebar-section">
          <div className="catalog-sidebar-head">
            <h3>Category</h3>
            <button className="catalog-clear-link" type="button" onClick={() => setSelectedCategory("")}>
              Reset
            </button>
          </div>
          <div className="catalog-sidebar-list">
            <button
              className={!selectedCategory ? "catalog-sidebar-option catalog-sidebar-option-active" : "catalog-sidebar-option"}
              type="button"
              onClick={() => setSelectedCategory("")}
            >
              Tất cả
            </button>
            {categories.map((category) => (
              <button
                className={selectedCategory === category ? "catalog-sidebar-option catalog-sidebar-option-active" : "catalog-sidebar-option"}
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="catalog-sidebar-section">
          <div className="catalog-sidebar-head">
            <h3>Brand</h3>
          </div>
          <div className="catalog-sidebar-list">
            <button
              className={!selectedBrand ? "catalog-sidebar-option catalog-sidebar-option-active" : "catalog-sidebar-option"}
              type="button"
              onClick={() => setSelectedBrand("")}
            >
              Tất cả thương hiệu
            </button>
            {brands.map((brand) => (
              <button
                className={selectedBrand === brand ? "catalog-sidebar-option catalog-sidebar-option-active" : "catalog-sidebar-option"}
                key={brand}
                type="button"
                onClick={() => setSelectedBrand(brand)}
              >
                {brand}
              </button>
            ))}
          </div>
        </div>

        <div className="catalog-sidebar-section">
          <h3>Controls</h3>
          <div className="catalog-filter-grid">
            <label className="catalog-filter-field">
              <span>Giá tối thiểu</span>
              <input
                inputMode="decimal"
                placeholder="0"
                value={priceRange.min}
                onChange={(event) => handlePriceChange("min", event)}
              />
            </label>
            <label className="catalog-filter-field">
              <span>Giá tối đa</span>
              <input
                inputMode="decimal"
                placeholder="500"
                value={priceRange.max}
                onChange={(event) => handlePriceChange("max", event)}
              />
            </label>
            <label className="catalog-filter-field">
              <span>Sort</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
                <option value="latest">Mới nhất</option>
                <option value="price_asc">Giá tăng dần</option>
                <option value="price_desc">Giá giảm dần</option>
                <option value="popular">Phổ biến</option>
              </select>
            </label>
          </div>
        </div>

        {tags.length > 0 ? (
          <div className="catalog-sidebar-section">
            <h3>Tags</h3>
            <div className="catalog-sidebar-list catalog-sidebar-list-inline">
              <button
                className={!selectedTag ? "catalog-sidebar-option catalog-sidebar-option-active" : "catalog-sidebar-option"}
                type="button"
                onClick={() => setSelectedTag("")}
              >
                Tất cả
              </button>
              {tags.map((tag) => (
                <button
                  className={selectedTag === tag ? "catalog-sidebar-option catalog-sidebar-option-active" : "catalog-sidebar-option"}
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(tag)}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {sizes.length > 0 ? (
          <div className="catalog-sidebar-section">
            <h3>Size</h3>
            <div className="catalog-sidebar-list catalog-sidebar-list-inline">
              <button
                className={!selectedSize ? "catalog-sidebar-option catalog-sidebar-option-active" : "catalog-sidebar-option"}
                type="button"
                onClick={() => setSelectedSize("")}
              >
                Tất cả
              </button>
              {sizes.map((size) => (
                <button
                  className={selectedSize === size ? "catalog-sidebar-option catalog-sidebar-option-active" : "catalog-sidebar-option"}
                  key={size}
                  type="button"
                  onClick={() => setSelectedSize(size ?? "")}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {colors.length > 0 ? (
          <div className="catalog-sidebar-section">
            <h3>Color</h3>
            <div className="catalog-sidebar-list catalog-sidebar-list-inline">
              <button
                className={!selectedColor ? "catalog-sidebar-option catalog-sidebar-option-active" : "catalog-sidebar-option"}
                type="button"
                onClick={() => setSelectedColor("")}
              >
                Tất cả
              </button>
              {colors.map((color) => (
                <button
                  className={selectedColor === color ? "catalog-sidebar-option catalog-sidebar-option-active" : "catalog-sidebar-option"}
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color ?? "")}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <button className="ghost-button catalog-reset-button" type="button" onClick={clearFilters}>
          Xóa toàn bộ bộ lọc
        </button>

        <div className="catalog-service-card">
          <span className="catalog-service-kicker">Inventory Service</span>
          <strong>{catalogIndex.length > 0 ? "Online & synchronized" : "Waiting for sync"}</strong>
          <p>{statusCopy}</p>
        </div>
      </aside>

      <section className="catalog-main">
        <section className="content-section catalog-hero-panel">
          <span className="section-kicker">Catalog</span>
          <div className="catalog-results-head">
            <div>
              <h1>{title}</h1>
              <p className="history-subtle">Showing {resultCountLabel} curated pieces đang khả dụng cho storefront.</p>
            </div>
            <div className="catalog-summary-pill">
              <strong>{activeFilterCount}</strong>
              <span>bộ lọc đang hoạt động</span>
            </div>
          </div>

          <div className="catalog-active-summary">
            {submittedSearch ? <span className="filter-chip filter-chip-active">Search: {submittedSearch}</span> : null}
            {selectedCategory ? <span className="filter-chip">{selectedCategory}</span> : null}
            {selectedBrand ? <span className="filter-chip">{selectedBrand}</span> : null}
            {selectedTag ? <span className="filter-chip">#{selectedTag}</span> : null}
            {selectedSize ? <span className="filter-chip">Size {selectedSize}</span> : null}
            {selectedColor ? <span className="filter-chip">{selectedColor}</span> : null}
            {priceRange.min || priceRange.max ? (
              <span className="filter-chip">
                {priceRange.min || "0"} - {priceRange.max || "max"}
              </span>
            ) : null}
            {sortBy !== "latest" ? <span className="filter-chip">{sortBy}</span> : null}
          </div>
        </section>

        {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}

        {products.length > 0 ? (
          <div className="product-grid product-grid-catalog">
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
              />
            ))}
          </div>
        ) : feedback ? null : (
          <div className="empty-card catalog-empty-state">
            <strong>Chưa có sản phẩm khớp bộ lọc hiện tại.</strong>
            <span>Hãy nới bộ lọc hoặc thử từ khóa khác để xem lại toàn bộ curated catalog.</span>
            <button className="ghost-button" type="button" onClick={clearFilters}>
              Đặt lại bộ lọc
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
