"use client";

import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";

import { formatStorefrontSyncLabel } from "@/components/storefront/storefront-shared";
import { StorefrontImage } from "@/components/storefront-shared/storefront-image";
import { buttonStyles } from "@/lib/button-styles";
import { cn } from "@/lib/utils";
import { formatCurrency, formatShippingMethodLabel } from "@/utils/format";

import type { CheckoutShippingOption, DraftItem } from "@/components/storefront/checkout/checkout-shared";

export function CheckoutOrderSummary({
  draftItems,
  isSyncingProducts,
  lastSyncedAt,
  selectedShipping,
  subtotal,
  total,
  isSubmitting,
  hasStockConflict,
  isAuthenticated,
  loginHref,
}: {
  draftItems: DraftItem[];
  isSyncingProducts: boolean;
  lastSyncedAt: Date | null;
  selectedShipping: CheckoutShippingOption;
  subtotal: number;
  total: number;
  isSubmitting: boolean;
  hasStockConflict: boolean;
  isAuthenticated: boolean;
  loginHref: string;
}) {
  return (
    <aside className="grid h-fit gap-4 lg:sticky lg:top-24">
      <section className="commerce-section">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-on-surface">Đơn hàng</h2>
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            <RefreshCw className={cn("h-4 w-4 text-primary", isSyncingProducts && "animate-spin")} />
            {formatStorefrontSyncLabel(lastSyncedAt)}
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {draftItems.map((item) => {
            const stockConflict =
              item.status !== "active" || item.stock <= 0 || item.quantity > item.stock;

            return (
              <div
                key={item.product_id}
                className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-[var(--radius-lg)] bg-surface-container-low p-3"
              >
                <div className="relative h-14 w-14 overflow-hidden rounded-[var(--radius-md)] bg-surface-container-low">
                  <StorefrontImage alt={item.name} src={item.imageUrl} fill sizes="56px" className="object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-on-surface">{item.name}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {item.quantity} x {formatCurrency(item.price)}
                  </p>
                  {stockConflict ? (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-error">
                      <TriangleAlert className="h-4 w-4" />
                      {item.status !== "active"
                        ? "Đã ngừng bán"
                        : item.stock <= 0
                          ? "Hết hàng"
                          : `Chỉ còn ${item.stock}`}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 border-t border-outline-variant pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-on-surface-variant">Tạm tính</span>
            <strong>{formatCurrency(subtotal)}</strong>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-on-surface-variant">
              {formatShippingMethodLabel(selectedShipping.value)}
            </span>
            <strong>{formatCurrency(selectedShipping.fee)}</strong>
          </div>
          <div className="flex justify-between gap-4 border-t border-outline-variant pt-3">
            <span className="text-on-surface-variant">Tổng cộng</span>
            <strong className="text-xl text-primary">{formatCurrency(total)}</strong>
          </div>
        </div>

        <button
          type="submit"
          className={cn(buttonStyles({ size: "lg" }), "mt-5 w-full")}
          disabled={isSubmitting || hasStockConflict}
        >
          {isSubmitting ? "Đang tạo đơn..." : "Đặt hàng"}
        </button>
        {!isAuthenticated ? (
          <Link href={loginHref} className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "mt-3 w-full")}>
            Đăng nhập để thanh toán
          </Link>
        ) : null}
      </section>
    </aside>
  );
}
