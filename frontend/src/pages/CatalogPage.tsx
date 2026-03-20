import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  const [feedback, setFeedback] = useState("");
  const [busyProductId, setBusyProductId] = useState("");

  const categories = useMemo(() => {
    return Array.from(
      new Set(products.map((product) => product.category).filter((category) => Boolean(category)))
    ).sort();
  }, [products]);

  useEffect(() => {
    let active = true;

    void api
      .listProducts({
        search: submittedSearch,
        category: selectedCategory || undefined
      })
      .then((response) => {
        if (active) {
          setProducts(response.data);
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
  }, [submittedSearch, selectedCategory]);

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

        {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}

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
