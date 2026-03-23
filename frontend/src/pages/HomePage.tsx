import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ProductCard } from "../components/ProductCard";
import { useCart } from "../hooks/useCart";
import { api, getErrorMessage } from "../lib/api";
import type { Product } from "../types/api";
import { formatCurrency } from "../utils/format";

export function HomePage() {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busyProductId, setBusyProductId] = useState("");

  useEffect(() => {
    let active = true;

    void api
      .listProducts({ status: "active" })
      .then((response) => {
        if (active) {
          setProducts(response.data);
          setCategories(
            Array.from(
              new Set(
                response.data
                  .map((product) => product.category)
                  .filter((category) => Boolean(category))
                  .slice(0, 4)
              )
            )
          );
        }
      })
      .catch((reason) => {
        if (active) {
          setError(getErrorMessage(reason));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleAddToCart(product: Product) {
    try {
      setBusyProductId(product.id);
      await addItem({
        product_id: product.id,
        quantity: 1
      });
      setError("");
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setBusyProductId("");
    }
  }

  const featuredProducts = products.slice(0, 4);
  const heroProduct = featuredProducts[0] ?? null;
  const categoryHighlights = categories
    .map((category) => {
      const categoryProducts = products.filter((product) => product.category === category);
      const featuredProduct = categoryProducts[0];

      return {
        category,
        count: categoryProducts.length,
        featuredProduct
      };
    })
    .filter((item) => item.featuredProduct);
  const seasonalPriceRange = featuredProducts.length > 0
    ? `${formatCurrency(Math.min(...featuredProducts.map((item) => item.price)))} - ${formatCurrency(
        Math.max(...featuredProducts.map((item) => item.price))
      )}`
    : "Đang đồng bộ";
  const technicalHighlights = [
    {
      value: `${products.length}+`,
      label: "Catalog live",
      description: "Sản phẩm active lấy trực tiếp từ backend qua gateway."
    },
    {
      value: `${categories.length || 1}`,
      label: "Curated categories",
      description: "Danh mục động để điều hướng sang storefront thật."
    },
    {
      value: seasonalPriceRange,
      label: "Season range",
      description: "Khoảng giá hiện có để demo purchase flow và checkout."
    }
  ];

  return (
    <div className="page-stack">
      <section className="editorial-home-hero">
        <div className="editorial-home-hero-panel">
          <div className="editorial-home-hero-copy">
            <span className="eyebrow">Digital Atelier</span>
            <h1>Storefront demo cho hệ e-commerce Go với giao diện editorial, rõ flow và sẵn sàng test thật.</h1>
            <p>
              ND Shop giữ nguyên luồng backend microservices hiện tại nhưng trình bày theo bề mặt storefront cao cấp hơn:
              duyệt catalog, vào chi tiết sản phẩm, thêm giỏ hàng, checkout, quản lý tài khoản và khu admin riêng.
            </p>

            <div className="hero-actions">
              <Link className="primary-link" to="/products">
                Explore Collection
              </Link>
              <Link className="secondary-link" to="/register">
                Tạo tài khoản
              </Link>
            </div>
          </div>

          <div className="editorial-home-hero-metrics">
            {technicalHighlights.map((item) => (
              <article className="summary-card editorial-home-metric-card" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="editorial-home-spotlight">
          <div className="editorial-home-spotlight-media">
            {heroProduct?.image_urls[0] ?? heroProduct?.image_url ? (
              <img
                alt={heroProduct?.name || "ND Shop spotlight"}
                src={heroProduct?.image_urls[0] ?? heroProduct?.image_url}
              />
            ) : (
              <div className="editorial-home-spotlight-fallback">ND</div>
            )}
          </div>

          <div className="editorial-home-spotlight-copy">
            <span className="section-kicker">Featured Flow</span>
            <strong>{heroProduct?.name || "Catalog đang đồng bộ"}</strong>
            <p>
              {heroProduct
                ? `${heroProduct.brand || "ND Atelier"} • ${formatCurrency(heroProduct.price)}`
                : "Khi backend có sản phẩm active, spotlight sẽ hiện item đầu tiên ngay tại đây."}
            </p>
            <Link className="text-link" to={heroProduct ? `/products/${heroProduct.id}` : "/products"}>
              {heroProduct ? "Mở trang chi tiết" : "Đi tới catalog"}
            </Link>
          </div>
        </aside>
      </section>

      <section className="content-section editorial-home-categories-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Curated Categories</span>
            <h2>Mua theo danh mục nổi bật</h2>
          </div>
        </div>

        <div className="editorial-home-category-grid">
          {categoryHighlights.map((item, index) => (
            <Link
              className={`editorial-home-category-card editorial-home-category-card-${(index % 4) + 1}`}
              key={item.category}
              to={`/categories/${encodeURIComponent(item.category)}`}
            >
              {item.featuredProduct?.image_urls[0] ?? item.featuredProduct?.image_url ? (
                <img
                  alt={item.category}
                  src={item.featuredProduct?.image_urls[0] ?? item.featuredProduct?.image_url}
                />
              ) : (
                <div className="editorial-home-category-fallback">{item.category.slice(0, 1).toUpperCase()}</div>
              )}
              <div className="editorial-home-category-overlay" />
              <div className="editorial-home-category-copy">
                <span>{item.count} sản phẩm</span>
                <strong>{item.category}</strong>
                <small>{item.featuredProduct?.name || "Mở bộ sưu tập"}</small>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="content-section editorial-home-callout">
        <div className="editorial-home-callout-copy">
          <span className="section-kicker">System Story</span>
          <h2>Digital precision, storefront soul.</h2>
          <p>
            Bộ giao diện mới bọc quanh cùng data flow cũ của dự án: product service cho catalog, cart service cho giỏ,
            checkout và payment cho luồng đặt hàng, cộng thêm khu admin dành cho admin/staff.
          </p>
        </div>

        <div className="editorial-home-callout-grid">
          <article className="editorial-home-callout-card">
            <strong>Catalog API</strong>
            <span>Danh sách sản phẩm, chi tiết và phân loại hoạt động trên dữ liệu thật.</span>
          </article>
          <article className="editorial-home-callout-card">
            <strong>Redis Cart</strong>
            <span>Thêm vào giỏ và quay lại checkout với flow người dùng thực tế hơn.</span>
          </article>
          <article className="editorial-home-callout-card">
            <strong>Admin Console</strong>
            <span>Admin/staff có backend UI riêng để quản lý sản phẩm, coupon, user role và order.</span>
          </article>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Seasonal Essentials</span>
            <h2>Sản phẩm nổi bật lấy trực tiếp từ backend</h2>
          </div>
          <Link className="text-link" to="/products">
            Xem toàn bộ catalog
          </Link>
        </div>

        {error ? <div className="feedback feedback-error">{error}</div> : null}
        {featuredProducts.length > 0 ? (
          <div className="product-grid">
            {featuredProducts.map((product) => (
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
        ) : error ? null : (
          <div className="empty-card">
            <strong>Catalog hiện chưa có sản phẩm active.</strong>
            <span>Frontend đã tải xong, nhưng backend chưa có mặt hàng nào để tạo product card.</span>
            <Link className="text-link" to="/products">
              Mở trang catalog
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
