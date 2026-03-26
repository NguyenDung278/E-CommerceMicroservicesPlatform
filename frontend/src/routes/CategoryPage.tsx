import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ProductCard } from "../ui/product/ProductCard";
import { useCart } from "../hooks/useCart";
import { api, getErrorMessage } from "../lib/api";
import type { Product } from "../types/api";
import { formatCurrency } from "../utils/format";
import "./CategoryPage.css";

export function CategoryPage() {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { categoryName = "" } = useParams();
  const category = decodeURIComponent(categoryName);

  const [products, setProducts] = useState<Product[]>([]);
  const [feedback, setFeedback] = useState("");
  const [busyProductId, setBusyProductId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    void api
      .listProducts({ category, limit: 48, status: "active" })
      .then((response) => {
        if (active) {
          setProducts(response.data);
          setFeedback("");
        }
      })
      .catch((reason) => {
        if (active) {
          setFeedback(getErrorMessage(reason));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [category]);

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

  const featuredProduct = products[0] ?? null;
  const brands = Array.from(new Set(products.map((product) => product.brand).filter(Boolean))).slice(0, 4);
  const priceRange =
    products.length > 0
      ? `${formatCurrency(Math.min(...products.map((product) => product.price)))} - ${formatCurrency(
          Math.max(...products.map((product) => product.price))
        )}`
      : "Đang đồng bộ";
  const totalStock = products.reduce((sum, product) => sum + product.stock, 0);
  const categoryMetrics = [
    {
      label: "Active items",
      value: `${products.length}`,
      description: "Số lượng sản phẩm đang hiển thị cho danh mục này."
    },
    {
      label: "Brands",
      value: `${brands.length}`,
      description: brands.length > 0 ? brands.join(", ") : "Sẽ hiện khi backend trả về dữ liệu."
    },
    {
      label: "Price range",
      value: priceRange,
      description: `Tổng tồn kho hiện có: ${totalStock}`
    }
  ];

  return (
    <div className="page-stack category-page">
      <section className="category-hero">
        <div className="category-hero-panel">
          <div className="category-hero-copy">
            <span className="eyebrow">Category Focus</span>
            <h1>{category}</h1>
            <p>
              Bộ sưu tập theo danh mục giúp bạn test nhanh luồng storefront thật mà vẫn giữ visual đồng bộ với phần
              catalog và product detail mới.
            </p>
          </div>

          {brands.length > 0 ? (
            <div className="category-chip-row">
              {brands.map((brand) => (
                <span className="product-tag-chip" key={brand}>
                  {brand}
                </span>
              ))}
            </div>
          ) : null}

          <div className="category-metric-grid">
            {categoryMetrics.map((item) => (
              <article className="summary-card category-metric-card" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.description}</p>
              </article>
            ))}
          </div>

          <div className="hero-actions">
            <Link className="primary-link" to="/products">
              Quay lại catalog
            </Link>
            {featuredProduct ? (
              <Link className="secondary-link" to={`/products/${featuredProduct.id}`}>
                Mở sản phẩm nổi bật
              </Link>
            ) : null}
          </div>
        </div>

        <aside className="category-feature-card">
          <div className="category-feature-media">
            {featuredProduct?.image_urls[0] ?? featuredProduct?.image_url ? (
              <img
                alt={featuredProduct?.name || category}
                src={featuredProduct?.image_urls[0] ?? featuredProduct?.image_url}
              />
            ) : (
              <div className="category-feature-fallback">{category.slice(0, 1).toUpperCase()}</div>
            )}
          </div>

          <div className="category-feature-copy">
            <span className="section-kicker">Featured Item</span>
            <strong>{featuredProduct?.name || "Đang chờ sản phẩm active"}</strong>
            <p>
              {featuredProduct
                ? `${featuredProduct.brand || "ND Atelier"} • ${formatCurrency(featuredProduct.price)}`
                : "Khi danh mục có sản phẩm active, màn này sẽ highlight item đầu tiên ngay tại đây."}
            </p>
          </div>
        </aside>
      </section>

      <section className="content-section category-results-section">
        <div className="section-heading category-results-head">
          <div>
            <span className="section-kicker">Category Listing</span>
            <h2>Sản phẩm trong danh mục {category}</h2>
          </div>
          <span className="category-results-caption">
            {products.length > 0 ? `${products.length} sản phẩm active` : "Chưa có dữ liệu hiển thị"}
          </span>
        </div>

        {feedback ? (
          <div className={products.length > 0 ? "feedback feedback-info" : "feedback feedback-error"}>{feedback}</div>
        ) : null}

        {isLoading ? (
          <div className="page-state">Đang tải danh mục...</div>
        ) : products.length > 0 ? (
          <div className="product-grid category-product-grid">
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
          <div className="empty-card category-empty-state">
            <span className="section-kicker">Empty Category</span>
            <strong>Danh mục này chưa có sản phẩm active.</strong>
            <span>Bạn có thể quay lại catalog để xem các mặt hàng khác đang hiển thị.</span>
            <Link className="text-link" to="/products">
              Quay lại catalog
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
