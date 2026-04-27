"use client";

import Link from "next/link";
import { Boxes, RefreshCw, Search, ShoppingCart, Tags } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";

import {
  RecoveredEditorialFooter,
  RecoveredStorefrontHeader,
} from "@/components/storefront-shared/recovered-storefront-chrome";
import {
  EmptyState,
  InlineAlert,
  ProductCard,
  ProductCardAction,
  ProductCardSkeleton,
} from "@/components/storefront-shared/storefront-ui";
import { useCartActions } from "@/hooks/useCart";
import { productApi } from "@/lib/api/product";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import type { HomePageInitialData } from "@/lib/storefront/initial-data";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/api";
import { formatTime } from "@/utils/format";

const syncIntervalMs = 5_000;

type HomeState = {
  products: Product[];
  error: string;
  isLoading: boolean;
  lastSyncedAt: Date | null;
};

function buildCategories(products: Product[]) {
  return Array.from(new Set(products.map((product) => product.category.trim()).filter(Boolean))).sort(
    (left, right) => left.localeCompare(right, "vi"),
  );
}

function sortProducts(products: Product[]) {
  return products.slice().sort((left, right) => {
    const stockScore = Number(right.stock > 0) - Number(left.stock > 0);
    if (stockScore !== 0) {
      return stockScore;
    }

    return right.updated_at.localeCompare(left.updated_at);
  });
}

function formatSyncLabel(value: Date | null) {
  return value ? formatTime(value) : "Chưa đồng bộ";
}

export function HomePage({ initialData }: { initialData?: HomePageInitialData }) {
  const { addItem } = useCartActions();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [busyProductId, setBusyProductId] = useState("");
  const [notice, setNotice] = useState("");
  const [state, setState] = useState<HomeState>(() => ({
    products: sortProducts(initialData?.products ?? []),
    error: initialData?.error ?? "",
    isLoading: !initialData,
    lastSyncedAt: null,
  }));
  const deferredQuery = useDeferredValue(query);

  const syncProducts = useCallback(async () => {
    try {
      const response = await productApi.listProducts({
        status: "active",
        sort: "merchandising",
        limit: 96,
      });

      setState({
        products: sortProducts(response.data),
        error: "",
        isLoading: false,
        lastSyncedAt: new Date(),
      });
    } catch (reason) {
      setState((current) => ({
        ...current,
        error: getErrorMessage(reason),
        isLoading: false,
      }));
    }
  }, []);

  useEffect(() => {
    void syncProducts();
    const intervalId = window.setInterval(() => void syncProducts(), syncIntervalMs);
    const handleFocus = () => void syncProducts();

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [syncProducts]);

  const categories = useMemo(() => buildCategories(state.products), [state.products]);
  const filteredProducts = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return state.products.filter((product) => {
      const matchesCategory = !selectedCategory || product.category === selectedCategory;
      const matchesQuery =
        !normalizedQuery ||
        [product.name, product.category, product.description, product.sku, product.tags.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [deferredQuery, selectedCategory, state.products]);

  const stats = useMemo(
    () => ({
      totalProducts: state.products.length,
      categoryCount: categories.length,
      availableProducts: state.products.filter((product) => product.stock > 0).length,
    }),
    [categories.length, state.products],
  );

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

  return (
    <main className="min-h-screen bg-background">
      <RecoveredStorefrontHeader />

      <section className="commerce-page-head">
        <div className="shell grid gap-5 py-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="grid gap-5">
            <div className="max-w-4xl">
              <p className="eyebrow">Storefront tối giản</p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight text-on-surface md:text-[2.8rem]">
                Chỉ giữ những gì cần để khách nhìn thấy sản phẩm, giá và mua ngay.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-on-surface-variant">
                Catalog, giá và tồn kho được lấy trực tiếp từ admin. Không có banner, editorial
                hay thông tin gây nhiễu trong flow mua hàng.
              </p>
            </div>

            <div className="flex max-w-3xl items-center gap-3 rounded-[var(--radius-2xl)] border border-outline-variant bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
              <Search className="h-4 w-4 shrink-0 text-on-surface-variant" />
              <input
                aria-label="Tìm sản phẩm"
                className="w-full bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                placeholder="Tìm theo tên, SKU hoặc danh mục"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/products" className={buttonStyles({ size: "lg" })}>
                <ShoppingCart className="h-4 w-4" />
                Vào catalog
              </Link>
              <Link href="/checkout" className={buttonStyles({ variant: "secondary", size: "lg" })}>
                Thanh toán ngay
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="metric-tile">
              <div className="flex items-center justify-between gap-3 text-sm text-on-surface-variant">
                <span>Sản phẩm đang bán</span>
                <Boxes className="h-4 w-4 text-primary" />
              </div>
              <strong className="mt-3 block text-3xl font-semibold text-on-surface">
                {stats.totalProducts}
              </strong>
            </div>

            <div className="metric-tile">
              <div className="flex items-center justify-between gap-3 text-sm text-on-surface-variant">
                <span>Danh mục hoạt động</span>
                <Tags className="h-4 w-4 text-primary" />
              </div>
              <strong className="mt-3 block text-3xl font-semibold text-on-surface">
                {stats.categoryCount}
              </strong>
            </div>

            <div className="metric-tile">
              <div className="flex items-center justify-between gap-3 text-sm text-on-surface-variant">
                <span>Đồng bộ từ admin</span>
                <RefreshCw className={cn("h-4 w-4 text-primary", state.isLoading && "animate-spin")} />
              </div>
              <strong className="mt-3 block text-lg font-semibold text-on-surface">
                {formatSyncLabel(state.lastSyncedAt)}
              </strong>
              <p className="mt-2 text-sm text-on-surface-variant">
                Storefront tự làm mới mỗi 5 giây.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="shell py-5">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            type="button"
            className={cn("commerce-chip", !selectedCategory && "commerce-chip-active")}
            onClick={() => setSelectedCategory("")}
          >
            Tất cả
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={cn(
                "commerce-chip",
                selectedCategory === category && "commerce-chip-active",
              )}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      <section className="shell pb-10">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Live catalog</p>
            <h2 className="mt-2 text-2xl font-semibold text-on-surface">
              {filteredProducts.length} sản phẩm phù hợp
            </h2>
          </div>
          <p className="text-sm text-on-surface-variant">
            Chỉ hiển thị tên, giá, danh mục, tồn kho và thao tác mua hàng.
          </p>
        </div>

        {state.error ? <InlineAlert tone="error">{state.error}</InlineAlert> : null}
        {notice ? (
          <div className="mt-4">
            <InlineAlert tone={notice.startsWith("Đã") ? "success" : "info"}>{notice}</InlineAlert>
          </div>
        ) : null}

        {state.isLoading && state.products.length === 0 ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <ProductCardSkeleton key={index} />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="Không có sản phẩm phù hợp"
              description="Thử đổi từ khóa tìm kiếm hoặc quay về toàn bộ catalog."
              action={
                <button
                  type="button"
                  className={buttonStyles({ variant: "secondary" })}
                  onClick={() => {
                    setQuery("");
                    setSelectedCategory("");
                  }}
                >
                  Xóa bộ lọc
                </button>
              }
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {filteredProducts.map((product) => {
              const soldOut = product.stock <= 0 || product.status !== "active";

              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  actionSlot={
                    <div className="grid w-full grid-cols-2 gap-2">
                      <ProductCardAction
                        onClick={() => void handleAddToCart(product)}
                        disabled={soldOut}
                        loading={busyProductId === product.id}
                        label="Thêm"
                      />
                      <Link
                        href={`/checkout?buy_now=${encodeURIComponent(product.id)}&qty=1`}
                        className={cn(
                          buttonStyles({ variant: "secondary", size: "md" }),
                          soldOut && "pointer-events-none opacity-50",
                        )}
                      >
                        Mua ngay
                      </Link>
                    </div>
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      <RecoveredEditorialFooter />
    </main>
  );
}
