"use client";

import Link from "next/link";

import {
  EmptyState,
  InlineAlert,
  ProductCard,
  ProductCardAction,
  ProductCardSkeleton,
} from "@/components/storefront-shared/storefront-ui";
import { buttonStyles } from "@/lib/button-styles";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/api";

import { catalogPageSize } from "@/components/storefront/catalog/catalog-shared";

export function CatalogResults({
  filteredCount,
  page,
  totalPages,
  visibleProducts,
  hasProducts,
  isLoading,
  error,
  notice,
  busyProductId,
  onAddToCart,
  onClearFilters,
  onPreviousPage,
  onNextPage,
}: {
  filteredCount: number;
  page: number;
  totalPages: number;
  visibleProducts: Product[];
  hasProducts: boolean;
  isLoading: boolean;
  error: string;
  notice: string;
  busyProductId: string;
  onAddToCart: (product: Product) => Promise<void>;
  onClearFilters: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}) {
  return (
    <section className="shell pb-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Kết quả</p>
          <h2 className="mt-2 text-2xl font-semibold text-on-surface">{filteredCount} sản phẩm</h2>
        </div>
        <p className="text-sm text-on-surface-variant">
          Trang {page}/{totalPages}
        </p>
      </div>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {notice ? (
        <div className="mt-4">
          <InlineAlert tone={notice.startsWith("Đã") ? "success" : "info"}>{notice}</InlineAlert>
        </div>
      ) : null}

      {isLoading && !hasProducts ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: catalogPageSize }).map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      ) : visibleProducts.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Không có sản phẩm phù hợp"
            description="Điều chỉnh lại từ khóa, danh mục hoặc sắp xếp để xem thêm sản phẩm."
            action={
              <button
                type="button"
                className={buttonStyles({ variant: "secondary" })}
                onClick={onClearFilters}
              >
                Xóa bộ lọc
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {visibleProducts.map((product) => {
              const soldOut = product.stock <= 0 || product.status !== "active";

              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  actionSlot={
                    <div className="grid w-full grid-cols-2 gap-2">
                      <ProductCardAction
                        onClick={() => void onAddToCart(product)}
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

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              className={buttonStyles({ variant: "secondary", size: "md" })}
              disabled={page <= 1}
              onClick={onPreviousPage}
            >
              Trang trước
            </button>
            <div className="rounded-[var(--radius-lg)] border border-outline-variant bg-surface px-4 py-2 text-sm font-medium text-on-surface">
              {page} / {totalPages}
            </div>
            <button
              type="button"
              className={buttonStyles({ variant: "secondary", size: "md" })}
              disabled={page >= totalPages}
              onClick={onNextPage}
            >
              Trang sau
            </button>
          </div>
        </>
      )}
    </section>
  );
}
