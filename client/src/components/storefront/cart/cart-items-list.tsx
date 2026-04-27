"use client";

import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";

import { resolveStorefrontProductImage } from "@/components/storefront/storefront-shared";
import { StorefrontImage } from "@/components/storefront-shared/storefront-image";
import { EmptyState } from "@/components/storefront-shared/storefront-ui";
import { buttonStyles } from "@/lib/button-styles";
import { cn } from "@/lib/utils";
import type { CartItem, Product } from "@/types/api";
import { formatCurrency } from "@/utils/format";

export function CartItemsList({
  items,
  productMap,
  busyProductId,
  onUpdateQuantity,
  onRemove,
}: {
  items: CartItem[];
  productMap: Record<string, Product>;
  busyProductId: string;
  onUpdateQuantity: (productId: string, quantity: number) => Promise<void>;
  onRemove: (productId: string) => Promise<void>;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Giỏ hàng đang trống"
        description="Thêm sản phẩm từ catalog để tiếp tục mua hàng."
        action={
          <Link href="/products" className={buttonStyles({ variant: "secondary" })}>
            Xem catalog
          </Link>
        }
      />
    );
  }

  return (
    <>
      {items.map((item) => {
        const product = productMap[item.product_id];
        const stock = product?.stock;
        const price = product?.price ?? item.price;
        const isBusy = busyProductId === item.product_id;
        const stockWarning = typeof stock === "number" && item.quantity > stock;
        const inactiveWarning = product?.status && product.status !== "active";

        return (
          <article
            key={item.product_id}
            className="commerce-card grid grid-cols-[92px_minmax(0,1fr)] gap-4 p-3 md:grid-cols-[120px_minmax(0,1fr)_180px]"
          >
            <Link
              href={`/products/${item.product_id}`}
              className="relative aspect-square overflow-hidden rounded-[var(--radius-lg)] bg-surface-container-low"
            >
              <StorefrontImage
                alt={item.name}
                src={resolveStorefrontProductImage(product, item.name)}
                fill
                sizes="120px"
                className="object-cover"
              />
            </Link>

            <div className="min-w-0">
              <Link
                href={`/products/${item.product_id}`}
                className="line-clamp-2 text-sm font-semibold text-on-surface hover:text-primary"
              >
                {product?.name || item.name}
              </Link>
              <p className="mt-1 text-sm text-on-surface-variant">{product?.category || "Sản phẩm"}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <span>{formatCurrency(price)} / sản phẩm</span>
                <strong className="text-primary">{formatCurrency(price * item.quantity)}</strong>
              </div>
              {stockWarning ? <p className="mt-2 text-sm text-error">Tồn kho hiện chỉ còn {stock}.</p> : null}
              {inactiveWarning ? (
                <p className="mt-2 text-sm text-error">Sản phẩm này hiện không còn mở bán.</p>
              ) : null}
            </div>

            <div className="col-span-2 flex items-center justify-between gap-3 md:col-span-1 md:flex-col md:items-stretch md:justify-center">
              <div className="flex items-center justify-center rounded-[var(--radius-lg)] border border-outline-variant bg-surface">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center transition hover:text-primary"
                  disabled={isBusy}
                  onClick={() => void onUpdateQuantity(item.product_id, Math.max(1, item.quantity - 1))}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center text-sm font-semibold">{item.quantity}</span>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center transition hover:text-primary"
                  disabled={isBusy || (typeof stock === "number" && item.quantity >= stock)}
                  onClick={() => void onUpdateQuantity(item.product_id, item.quantity + 1)}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "tracking-normal")}
                disabled={isBusy}
                onClick={() => void onRemove(item.product_id)}
              >
                <Trash2 className="h-4 w-4" />
                Xóa
              </button>
            </div>
          </article>
        );
      })}
    </>
  );
}
