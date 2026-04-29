import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Flame, Layers3 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { ProductCard } from "../components/product-card";
import { EmptyView, ErrorView, LoadingView } from "../components/status-view";
import {
  getCatalogPopularity,
  getStorefrontCategory,
  listProducts,
  listProductsByIDs,
} from "../services/product-service";
import type {
  Product,
  ProductPopularity,
  StorefrontCategoryPageData,
  StorefrontEditorialSection,
} from "../types/api";

type EditorialPayload = {
  title?: string;
  heading?: string;
  subtitle?: string;
  description?: string;
  body?: string;
  cta_label?: string;
  cta_href?: string;
};

function asEditorialPayload(payload: unknown): EditorialPayload {
  if (!payload || typeof payload !== "object") {
    return {};
  }
  return payload as EditorialPayload;
}

function sectionTitle(section: StorefrontEditorialSection) {
  const payload = asEditorialPayload(section.payload);
  return payload.title || payload.heading || section.section_type;
}

function sectionBody(section: StorefrontEditorialSection) {
  const payload = asEditorialPayload(section.payload);
  return payload.description || payload.subtitle || payload.body || "";
}

export function CategoryPage() {
  const { identifier } = useParams();
  const [categoryData, setCategoryData] = useState<StorefrontCategoryPageData | null>(null);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [popularProducts, setPopularProducts] = useState<Product[]>([]);
  const [popularity, setPopularity] = useState<ProductPopularity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const featuredProducts = useMemo(
    () =>
      (categoryData?.featured_products ?? [])
        .map((featured) => featured.product)
        .filter((product): product is Product => Boolean(product)),
    [categoryData],
  );
  const publishedSections = useMemo(
    () =>
      (categoryData?.sections ?? [])
        .filter((section) => section.published)
        .sort((first, second) => first.position - second.position),
    [categoryData],
  );
  const popularityByProductId = useMemo(
    () => Object.fromEntries(popularity.map((item) => [item.product_id, item.quantity] as const)),
    [popularity],
  );

  useEffect(() => {
    let active = true;

    async function loadCategory() {
      if (!identifier) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await getStorefrontCategory(identifier);
        const [catalogResponse, popularityData] = await Promise.all([
          listProducts({
            category: data.category.slug,
            limit: 24,
            sort: "merchandising",
          }).catch(() => ({ data: [] })),
          getCatalogPopularity(8).catch(() => []),
        ]);
        const popularProductData = await listProductsByIDs(
          popularityData.map((item) => item.product_id),
        ).catch(() => []);

        if (active) {
          setCategoryData(data);
          setCategoryProducts(catalogResponse.data);
          setPopularity(popularityData);
          setPopularProducts(popularProductData);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Không tải được danh mục");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadCategory();

    return () => {
      active = false;
    };
  }, [identifier]);

  if (loading) {
    return <LoadingView label="Đang tải danh mục" />;
  }

  if (error || !categoryData) {
    return <ErrorView message={error ?? "Không tìm thấy danh mục"} />;
  }

  return (
    <div className="page-stack">
      <Link to="/" className="text-link">
        <ArrowLeft size={16} />
        Quay lại trang chủ
      </Link>

      <section className="category-detail-hero">
        <div>
          <span className="eyebrow">Category</span>
          <h1>{categoryData.category.display_name}</h1>
          <p>{categoryData.category.nav_label || categoryData.category.slug}</p>
          {categoryData.category.aliases && categoryData.category.aliases.length > 0 ? (
            <div className="chip-list">
              {categoryData.category.aliases.map((alias) => (
                <span key={alias} className="chip-button">
                  {alias}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <Link
          className="button button--primary"
          to={`/products?category=${encodeURIComponent(categoryData.category.slug)}`}
        >
          Xem catalog
        </Link>
      </section>

      {publishedSections.length > 0 ? (
        <section className="surface-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Editorial</span>
              <h2>Điểm nhấn danh mục</h2>
            </div>
            <Layers3 size={24} />
          </div>
          <div className="editorial-section-list">
            {publishedSections.map((section) => {
              const payload = asEditorialPayload(section.payload);
              return (
                <article key={section.id} className="editorial-section-card">
                  <div>
                    <strong>{sectionTitle(section)}</strong>
                    {sectionBody(section) ? <p>{sectionBody(section)}</p> : null}
                  </div>
                  {payload.cta_href && payload.cta_label ? (
                    <Link className="button button--ghost" to={payload.cta_href}>
                      {payload.cta_label}
                    </Link>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="surface-section">
        <div className="section-heading">
          <h2>Sản phẩm nổi bật</h2>
          <Link to={`/products?category=${encodeURIComponent(categoryData.category.slug)}`}>
            Xem thêm
          </Link>
        </div>
        {featuredProducts.length > 0 ? (
          <div className="product-grid">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : categoryProducts.length > 0 ? (
          <div className="product-grid">
            {categoryProducts.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyView title="Chưa có sản phẩm trong danh mục" />
        )}
      </section>

      {popularProducts.length > 0 ? (
        <section className="surface-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Popularity</span>
              <h2>Sản phẩm được mua nhiều</h2>
            </div>
            <Flame size={24} />
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
