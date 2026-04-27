"use client";

import { Minus, Plus, ShoppingCart } from "lucide-react";

import { buttonStyles } from "@/lib/button-styles";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/api";
import { formatCurrency } from "@/utils/format";

export function ProductPurchasePanel({
  product,
  soldOut,
  effectiveStock,
  effectivePrice,
  selectedVariantSku,
  quantity,
  busy,
  onVariantChange,
  onQuantityChange,
  onAddToCart,
  onBuyNow,
}: {
  product: Product;
  soldOut: boolean;
  effectiveStock: number;
  effectivePrice: number;
  selectedVariantSku: string;
  quantity: number;
  busy: boolean;
  onVariantChange: (sku: string) => void;
  onQuantityChange: (quantity: number) => void;
  onAddToCart: () => Promise<void>;
  onBuyNow: () => void;
}) {
  return (
    <section className="commerce-section">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
          {product.category || "Sản phẩm"}
        </span>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            soldOut ? "bg-[#fff1f0] text-error" : "bg-[#ecfdf3] text-tertiary",
          )}
        >
          {soldOut ? "Không sẵn sàng bán" : `Còn ${effectiveStock}`}
        </span>
      </div>

      <h1 className="mt-4 text-2xl font-semibold leading-tight text-on-surface md:text-3xl">
        {product.name}
      </h1>
      <strong className="mt-4 block text-3xl font-semibold text-primary">
        {formatCurrency(effectivePrice)}
      </strong>

      {product.description ? (
        <p className="mt-4 text-sm leading-7 text-on-surface-variant">{product.description}</p>
      ) : null}

      {product.variants.length > 0 ? (
        <label className="mt-5 grid gap-2 text-sm font-medium text-on-surface">
          Biến thể
          <select
            className="commerce-input"
            value={selectedVariantSku}
            onChange={(event) => onVariantChange(event.target.value)}
          >
            {product.variants.map((variant) => (
              <option key={variant.sku} value={variant.sku}>
                {variant.label} - {formatCurrency(variant.price)} - còn {variant.stock}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <span className="text-sm font-medium text-on-surface">Số lượng</span>
        <div className="flex items-center rounded-[var(--radius-lg)] border border-outline-variant bg-surface">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center text-on-surface transition hover:text-primary"
            onClick={() => onQuantityChange(quantity - 1)}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-12 text-center text-sm font-semibold">{quantity}</span>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center text-on-surface transition hover:text-primary"
            onClick={() => onQuantityChange(quantity + 1)}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className={buttonStyles({ size: "lg" })}
          disabled={busy || soldOut}
          onClick={() => void onAddToCart()}
        >
          <ShoppingCart className="h-4 w-4" />
          {busy ? "Đang thêm..." : "Thêm vào giỏ"}
        </button>
        <button
          type="button"
          className={buttonStyles({ variant: "secondary", size: "lg" })}
          disabled={soldOut}
          onClick={onBuyNow}
        >
          Mua ngay
        </button>
      </div>
    </section>
  );
}
