import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ProductCard } from "../components/product-card";
import { EmptyView, ErrorView, LoadingView } from "../components/status-view";
import {
  getCatalogPopularity,
  getStorefrontHome,
  listProducts,
  listProductsByIDs,
} from "../services/product-service";
import type {
  Product,
  ProductPopularity,
  StorefrontCategory,
  StorefrontHomeData,
} from "../types/api";

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
  const [popularProducts, setPopularProducts] = useState<Product[]>([]);
  const [popularity, setPopularity] = useState<ProductPopularity[]>([]);

  useEffect(() => {
    let active = true;

    async function loadHome() {
      try {
        setLoading(true);
        const [home, popularityData] = await Promise.all([
          getStorefrontHome(),
          getCatalogPopularity(8).catch(() => []),
        ]);
        const featuredProducts = collectFeaturedProducts(home);
        const popularProductData = await listProductsByIDs(
          popularityData.map((item) => item.product_id),
        ).catch(() => []);

        if (featuredProducts.length > 0) {
          if (active) {
            setCategories(home.categories);
            setProducts(featuredProducts);
            setPopularity(popularityData);
            setPopularProducts(popularProductData);
          }
          return;
        }

        const productResponse = await listProducts({ limit: 12, sort: "latest" });
        if (active) {
          setCategories(home.categories);
          setProducts(productResponse.data);
          setPopularity(popularityData);
          setPopularProducts(popularProductData);
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

  const popularityByProductId = Object.fromEntries(
    popularity.map((item) => [item.product_id, item.quantity] as const),
  );

  return (
    <div className="page-stack">
      <section className="hero-section">
        <div>
          <span className="eyebrow">ND Shop marketplace</span>
          <h1>Mua sắm giá tốt mỗi ngày</h1>
          <p>
            Tìm sản phẩm theo danh mục, theo dõi đơn hàng, thanh toán MoMo và đổi trả — tất cả
            trong một nơi.
          </p>
          <Link className="button button--hero" to="/products">
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
                to={`/categories/${encodeURIComponent(category.slug)}`}
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

      {popularProducts.length > 0 ? (
        <section className="surface-section">
          <div className="section-heading">
            <h2>Được mua nhiều</h2>
            <Link to="/products?sort=popular">Xem thêm</Link>
          </div>
          <div className="product-grid">
            {popularProducts.map((product) => (
              <div key={product.id} className="product-highlight">
                <span>{popularityByProductId[product.id] ?? 0} lượt mua</span>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
