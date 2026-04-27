import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "react-router-dom";
import { ProductCard } from "../components/product-card";
import { EmptyView, ErrorView, LoadingView } from "../components/status-view";
import { listCategories, listProducts } from "../services/product-service";
import type { ApiMeta, Product, StorefrontCategory } from "../types/api";

export function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<StorefrontCategory[]>([]);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const search = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";
  const cursor = searchParams.get("cursor") ?? "";

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      try {
        setLoading(true);
        setError(null);
        const [categoryData, productResponse] = await Promise.all([
          listCategories().catch(() => []),
          listProducts({ search, category, cursor, limit: 24 }),
        ]);

        if (active) {
          setCategories(categoryData);
          setProducts(productResponse.data);
          setMeta(productResponse.meta ?? null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Không tải được danh sách sản phẩm");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProducts();

    return () => {
      active = false;
    };
  }, [category, cursor, search]);

  function setCategory(value: string) {
    startTransition(() => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("cursor");
        if (value) {
          next.set("category", value);
        } else {
          next.delete("category");
        }
        return next;
      });
    });
  }

  function goNext() {
    if (!meta?.next_cursor) {
      return;
    }

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("cursor", meta.next_cursor ?? "");
      return next;
    });
  }

  if (loading && !isPending) {
    return <LoadingView label="Đang tải danh sách sản phẩm" />;
  }

  return (
    <div className="page-stack">
      <section className="surface-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Product feed</span>
            <h1>Danh sách sản phẩm</h1>
          </div>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Tất cả danh mục</option>
            {categories.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.nav_label || item.display_name}
              </option>
            ))}
          </select>
        </div>

        {error ? <ErrorView message={error} /> : null}

        {!error && products.length === 0 ? (
          <EmptyView title="Không có sản phẩm phù hợp">
            Thử đổi từ khóa hoặc danh mục rồi tải lại.
          </EmptyView>
        ) : null}

        {products.length > 0 ? (
          <>
            <div className="product-grid">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            {meta?.has_next ? (
              <div className="pagination-row">
                <button className="button button--secondary" type="button" onClick={goNext}>
                  Xem tiếp
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
