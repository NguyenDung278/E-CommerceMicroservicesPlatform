import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ProductCard } from "../components/ProductCard";
import { useCart } from "../hooks/useCart";
import { api, getErrorMessage } from "../lib/api";
import type { Product } from "../types/api";

export function CatalogPage() {
  const navigate = useNavigate();
  const { addItem } = useCart();
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
      new Set(products.map((product) => product.category).filter((category) => Boolean(category)))
    ).sort();
  }, [products]);

  const brands = useMemo(() => {
    return Array.from(new Set(products.map((product) => product.brand).filter(Boolean))).sort();
  }, [products]);

  const tags = useMemo(() => {
    return Array.from(new Set(products.flatMap((product) => product.tags).filter(Boolean))).sort();
  }, [products]);

  const sizes = useMemo(() => {
    return Array.from(
      new Set(products.flatMap((product) => product.variants.map((variant) => variant.size).filter(Boolean)))
    ).sort();
  }, [products]);

  const colors = useMemo(() => {
    return Array.from(
      new Set(products.flatMap((product) => product.variants.map((variant) => variant.color).filter(Boolean)))
    ).sort();
  }, [products]);

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

  return (
    <div className="page-stack">
      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Catalog</span>
            <h1>Danh sách sản phẩm</h1>
          </div>

          <form className="search-form" onSubmit={handleSearch}>
            <input
              placeholder="Tìm theo tên, danh mục, mô tả"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button className="ghost-button" type="submit">
              Tìm
            </button>
          </form>
        </div>

        <div className="category-filter-row">
          <button
            className={!selectedCategory ? "filter-chip filter-chip-active" : "filter-chip"}
            onClick={() => setSelectedCategory("")}
            type="button"
          >
            Tất cả
          </button>
          {categories.map((category) => (
            <button
              className={selectedCategory === category ? "filter-chip filter-chip-active" : "filter-chip"}
              key={category}
              onClick={() => setSelectedCategory(category)}
              type="button"
            >
              {category}
            </button>
          ))}
        </div>

        <div className="category-filter-row">
          <button
            className={!selectedBrand ? "filter-chip filter-chip-active" : "filter-chip"}
            onClick={() => setSelectedBrand("")}
            type="button"
          >
            Tất cả thương hiệu
          </button>
          {brands.map((brand) => (
            <button
              className={selectedBrand === brand ? "filter-chip filter-chip-active" : "filter-chip"}
              key={brand}
              onClick={() => setSelectedBrand(brand)}
              type="button"
            >
              {brand}
            </button>
          ))}
        </div>

        {tags.length > 0 ? (
          <div className="category-filter-row">
            <button
              className={!selectedTag ? "filter-chip filter-chip-active" : "filter-chip"}
              onClick={() => setSelectedTag("")}
              type="button"
            >
              Tất cả tag
            </button>
            {tags.map((tag) => (
              <button
                className={selectedTag === tag ? "filter-chip filter-chip-active" : "filter-chip"}
                key={tag}
                onClick={() => setSelectedTag(tag)}
                type="button"
              >
                #{tag}
              </button>
            ))}
          </div>
        ) : null}

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

        {sizes.length > 0 ? (
          <div className="category-filter-row">
            <button
              className={!selectedSize ? "filter-chip filter-chip-active" : "filter-chip"}
              onClick={() => setSelectedSize("")}
              type="button"
            >
              Tất cả size
            </button>
            {sizes.map((size) => (
              <button
                className={selectedSize === size ? "filter-chip filter-chip-active" : "filter-chip"}
                key={size}
                onClick={() => setSelectedSize(size ?? "")}
                type="button"
              >
                {size}
              </button>
            ))}
          </div>
        ) : null}

        {colors.length > 0 ? (
          <div className="category-filter-row">
            <button
              className={!selectedColor ? "filter-chip filter-chip-active" : "filter-chip"}
              onClick={() => setSelectedColor("")}
              type="button"
            >
              Tất cả màu
            </button>
            {colors.map((color) => (
              <button
                className={selectedColor === color ? "filter-chip filter-chip-active" : "filter-chip"}
                key={color}
                onClick={() => setSelectedColor(color ?? "")}
                type="button"
              >
                {color}
              </button>
            ))}
          </div>
        ) : null}

        {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}

        {products.length > 0 ? (
          <div className="product-grid">
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
          <div className="empty-card">
            <strong>Chưa có sản phẩm để hiển thị.</strong>
            <span>Catalog hiện đang rỗng hoặc bộ lọc hiện tại chưa khớp sản phẩm nào.</span>
          </div>
        )}

        <div className="catalog-links">
          {categories.map((category) => (
            <Link className="text-link" key={category} to={`/categories/${encodeURIComponent(category)}`}>
              Xem danh mục {category}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
