"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";

import { CatalogFilters } from "@/components/storefront/catalog/catalog-filters";
import { CatalogResults } from "@/components/storefront/catalog/catalog-results";
import {
  buildCatalogCategories,
  catalogPageSize,
  fetchCatalogProducts,
  normalizeCatalogPage,
  normalizeCatalogSort,
  sortCatalogProducts,
} from "@/components/storefront/catalog/catalog-shared";
import { formatStorefrontSyncLabel, storefrontSyncIntervalMs } from "@/components/storefront/storefront-shared";
import {
  RecoveredEditorialFooter,
  RecoveredStorefrontHeader,
} from "@/components/storefront-shared/recovered-storefront-chrome";
import { LoadingScreen } from "@/components/storefront-shared/storefront-ui";
import { useCartActions } from "@/hooks/useCart";
import { getErrorMessage } from "@/lib/errors/handler";
import type { CatalogPageInitialData, CatalogSortMode } from "@/lib/storefront/initial-data";
import { buildSearchParams } from "@/lib/utils";
import type { Product } from "@/types/api";

export function CatalogPage({
  initialCategory,
  initialData,
}: {
  initialCategory?: string;
  initialData?: CatalogPageInitialData;
}) {
  return (
    <Suspense fallback={<LoadingScreen label="Đang tải catalog..." />}>
      <CatalogPageContent initialCategory={initialCategory} initialData={initialData} />
    </Suspense>
  );
}

function CatalogPageContent({
  initialCategory,
  initialData,
}: {
  initialCategory?: string;
  initialData?: CatalogPageInitialData;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addItem } = useCartActions();

  const initialSearch = searchParams.get("search") ?? "";
  const initialSort = normalizeCatalogSort(searchParams.get("sort"));
  const initialPage = normalizeCatalogPage(searchParams.get("page"));
  const initialSelectedCategory = initialCategory || searchParams.get("category") || "";

  const [products, setProducts] = useState<Product[]>(
    () => initialData?.catalogIndex ?? initialData?.products ?? [],
  );
  const [search, setSearch] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState(initialSelectedCategory);
  const [sortMode, setSortMode] = useState<CatalogSortMode>(initialSort);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [error, setError] = useState(initialData?.feedback ?? "");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(!initialData);
  const [busyProductId, setBusyProductId] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const deferredSearch = useDeferredValue(search);

  const popularityRank = useMemo(
    () =>
      new Map(
        (initialData?.popularity ?? []).map((item, index) => [
          item.product_id,
          item.quantity * 1000 - index,
        ]),
      ),
    [initialData?.popularity],
  );

  const syncProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      const nextProducts = await fetchCatalogProducts();
      setProducts(nextProducts);
      setError("");
      setLastSyncedAt(new Date());
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void syncProducts();
    const intervalId = window.setInterval(() => void syncProducts(), storefrontSyncIntervalMs);
    const handleFocus = () => void syncProducts();

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [syncProducts]);

  const categories = useMemo(() => buildCatalogCategories(products), [products]);
  const filteredProducts = useMemo(() => {
    const normalizedQuery = deferredSearch.trim().toLowerCase();
    const nextProducts = products.filter((product) => {
      const matchesCategory = !selectedCategory || product.category === selectedCategory;
      const matchesQuery =
        !normalizedQuery ||
        [product.name, product.category, product.description, product.sku, product.tags.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });

    return sortCatalogProducts(nextProducts, sortMode, popularityRank);
  }, [deferredSearch, popularityRank, products, selectedCategory, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / catalogPageSize));
  const page = Math.min(currentPage, totalPages);
  const visibleProducts = filteredProducts.slice((page - 1) * catalogPageSize, page * catalogPageSize);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    const query = buildSearchParams({
      search: search.trim() || undefined,
      category: selectedCategory || undefined,
      sort: sortMode !== "latest" ? sortMode : undefined,
      page: page > 1 ? page : undefined,
    });

    router.replace(query ? `/products?${query}` : "/products", { scroll: false });
  }, [page, router, search, selectedCategory, sortMode]);

  async function handleAddToCart(product: Product) {
    try {
      setBusyProductId(product.id);
      await addItem({ product_id: product.id, quantity: 1 });
      setNotice(`Đã thêm ${product.name} vào giỏ hàng.`);
    } catch (reason) {
      setNotice(getErrorMessage(reason));
    } finally {
      setBusyProductId("");
    }
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setCurrentPage(1);
  }

  function handleCategoryChange(value: string) {
    setSelectedCategory(value);
    setCurrentPage(1);
  }

  function handleSortChange(value: CatalogSortMode) {
    setSortMode(value);
    setCurrentPage(1);
  }

  function handleClearFilters() {
    setSearch("");
    setSelectedCategory("");
    setSortMode("latest");
    setCurrentPage(1);
  }

  return (
    <main className="min-h-screen bg-background">
      <RecoveredStorefrontHeader />

      <section className="commerce-page-head">
        <div className="shell grid gap-5 py-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end">
          <div>
            <p className="eyebrow">Catalog bán hàng</p>
            <h1 className="mt-2 text-3xl font-semibold text-on-surface md:text-[2.6rem]">
              Toàn bộ sản phẩm hoạt động, lọc nhanh theo nhu cầu mua hàng.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-on-surface-variant">
              Catalog chỉ giữ ba lớp điều khiển cần thiết: tìm kiếm, danh mục và sắp xếp.
            </p>
          </div>

          <div className="metric-tile">
            <p className="text-sm text-on-surface-variant">Đồng bộ catalog</p>
            <strong className="mt-3 block text-2xl font-semibold text-on-surface">
              {formatStorefrontSyncLabel(lastSyncedAt)}
            </strong>
            <p className="mt-2 text-sm text-on-surface-variant">Tự làm mới mỗi 5 giây từ dữ liệu admin.</p>
          </div>
        </div>
      </section>

      <section className="shell py-6">
        <CatalogFilters
          search={search}
          selectedCategory={selectedCategory}
          sortMode={sortMode}
          categories={categories}
          onSearchChange={handleSearchChange}
          onCategoryChange={handleCategoryChange}
          onSortChange={handleSortChange}
        />
      </section>

      <CatalogResults
        filteredCount={filteredProducts.length}
        page={page}
        totalPages={totalPages}
        visibleProducts={visibleProducts}
        hasProducts={products.length > 0}
        isLoading={isLoading}
        error={error}
        notice={notice}
        busyProductId={busyProductId}
        onAddToCart={handleAddToCart}
        onClearFilters={handleClearFilters}
        onPreviousPage={() => setCurrentPage((current) => Math.max(1, current - 1))}
        onNextPage={() => setCurrentPage((current) => Math.min(totalPages, current + 1))}
      />

      <RecoveredEditorialFooter />
    </main>
  );
}
