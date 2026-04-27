import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ProductCard } from "../components/product-card";
import { EmptyView, ErrorView, LoadingView } from "../components/status-view";
import { getStorefrontHome, listProducts } from "../services/product-service";
import type { Product, StorefrontCategory, StorefrontHomeData } from "../types/api";

function collectFeaturedProducts(home: StorefrontHomeData): Product[] {
  return home.category_pages.flatMap((page) =>
    page.featured_products.map((featured) => featured.product),
  );
}

export function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<StorefrontCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    let active = true;

    async function loadHome() {
      try {
        setLoading(true);
        const home = await getStorefrontHome();
        const featuredProducts = collectFeaturedProducts(home);

        if (featuredProducts.length > 0) {
          if (active) {
            setCategories(home.categories);
            setProducts(featuredProducts);
          }
          return;
        }

        const productResponse = await listProducts({ limit: 12, sort: "newest" });
        if (active) {
          setCategories(home.categories);
          setProducts(productResponse.data);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Không tải được trang chủ");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadHome();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <LoadingView label="Đang tải sản phẩm nổi bật" />;
  }

  if (error) {
    return <ErrorView message={error} />;
  }

  return (
    <div className="page-stack">
      <section className="hero-section">
        <div>
          <span className="eyebrow">Marketplace deals</span>
          <p></p>
          <Link className="button button--primary" to="/products">
            Xem tất cả sản phẩm
          </Link>
        </div>
      </section>

      {categories.length > 0 ? (
        <section className="surface-section">
          <div className="section-heading">
            <h2>Danh mục</h2>
            <Link to="/products">Xem sản phẩm</Link>
          </div>
          <div className="category-row">
            {categories.map((category) => (
              <Link
                key={category.slug}
                to={`/products?category=${encodeURIComponent(category.slug)}`}
                className="category-pill"
              >
                {category.nav_label || category.display_name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="surface-section">
        <div className="section-heading">
          <h2>Sản phẩm nổi bật</h2>
          <Link to="/products">Xem thêm</Link>
        </div>
        {products.length > 0 ? (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyView title="Chưa có sản phẩm" />
        )}
      </section>
    </div>
  );
}
