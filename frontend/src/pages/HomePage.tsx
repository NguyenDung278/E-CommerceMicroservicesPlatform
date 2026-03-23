import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ProductCard } from "../components/ProductCard";
import { useCart } from "../hooks/useCart";
import { api, getErrorMessage } from "../lib/api";
import type { Product } from "../types/api";

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
          setProducts(response.data.slice(0, 3));
          setCategories(
            Array.from(
              new Set(
                response.data
                  .map((product) => product.category)
                  .filter((category) => Boolean(category))
                  .slice(0, 5)
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

  return (
    <div className="page-stack">
      <section className="hero-banner">
        <div className="hero-copy">
          <span className="eyebrow">Go + Microservices Store</span>
          <h1>Frontend nhiều trang như app bán hàng thật, dễ mở rộng và dễ bảo trì.</h1>
          <p>
            Thay vì dashboard demo, frontend này tập trung vào user flow thực tế: duyệt sản phẩm,
            thêm vào giỏ, thanh toán, quản lý tài khoản và khu vực admin riêng.
          </p>

          <div className="hero-actions">
            <Link className="primary-link" to="/products">
              Mua sắm ngay
            </Link>
            <Link className="secondary-link" to="/register">
              Tạo tài khoản
            </Link>
          </div>
        </div>

        <div className="hero-summary">
          <div className="summary-card">
            <strong>Catalog service</strong>
            <span>Public API qua gateway</span>
          </div>
          <div className="summary-card">
            <strong>Cart service</strong>
            <span>Giỏ hàng chạy trên Redis</span>
          </div>
          <div className="summary-card">
            <strong>Checkout flow</strong>
            <span>Đặt hàng và thanh toán end-to-end</span>
          </div>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Mua theo danh mục</span>
            <h2>Danh mục nổi bật</h2>
          </div>
        </div>

        <div className="category-filter-row">
          {categories.map((category) => (
            <Link className="filter-chip filter-chip-link" key={category} to={`/categories/${encodeURIComponent(category)}`}>
              {category}
            </Link>
          ))}
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Sản phẩm nổi bật</span>
            <h2>Ba sản phẩm đầu tiên lấy trực tiếp từ backend thật</h2>
          </div>
          <Link className="text-link" to="/products">
            Xem toàn bộ catalog
          </Link>
        </div>

	        {error ? <div className="feedback feedback-error">{error}</div> : null}
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
