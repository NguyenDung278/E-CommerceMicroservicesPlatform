"use client";

import { Heart, LoaderCircle, Minus, Plus, ShoppingBag } from "lucide-react";

import { Field, Select, SurfaceCard } from "@/components/storefront-ui";
import { buttonStyles } from "@/lib/button-styles";
import { cn } from "@/lib/utils";
import type { Product, ProductVariant } from "@/types/api";
import { formatCurrency, formatLongDate } from "@/utils/format";

import type { ProductPageBusyState } from "./shared";

type ProductPurchasePanelProps = {
  busy: ProductPageBusyState;
  effectivePrice: number;
  effectiveStock: number;
  isSaved: boolean;
  onAddToCart: () => void;
  onBuyNow: () => void;
  onDecreaseQuantity: () => void;
  onIncreaseQuantity: () => void;
  onToggleWishlist: () => void;
  onVariantChange: (sku: string) => void;
  product: Product;
  quantity: number;
  selectedVariant: ProductVariant | null;
  selectedVariantSku: string;
};

export function ProductPurchasePanel({
  busy,
  effectivePrice,
  effectiveStock,
  isSaved,
  onAddToCart,
  onBuyNow,
  onDecreaseQuantity,
  onIncreaseQuantity,
  onToggleWishlist,
  onVariantChange,
  product,
  quantity,
  selectedVariant,
  selectedVariantSku,
}: ProductPurchasePanelProps) {
  return (
    <div className="space-y-6 lg:sticky lg:top-28">
      <div className="rounded-[1.25rem] bg-surface-container-low px-6 py-8 md:px-8">
        <p className="eyebrow">{product.category || "Catalog"}</p>
        <h1 className="mt-4 font-serif text-4xl font-semibold tracking-[-0.04em] text-primary md:text-5xl">
          {product.name}
        </h1>
        <p className="mt-5 text-base leading-8 text-on-surface-variant">{product.description}</p>

        <div className="mt-7 flex items-center justify-between gap-4">
          <div>
            <strong className="block font-serif text-4xl font-semibold tracking-[-0.03em] text-primary">
              {formatCurrency(effectivePrice)}
            </strong>
            <span className="mt-2 block text-sm text-on-surface-variant">
              {effectiveStock <= 0
                ? "Hết hàng"
                : effectiveStock <= 5
                  ? `Còn ${effectiveStock} sản phẩm`
                  : "Còn hàng"}
            </span>
          </div>
          <button
            type="button"
            className={cn(buttonStyles({ variant: "secondary" }), "shrink-0")}
            onClick={onToggleWishlist}
          >
            <Heart className="h-4 w-4" />
            {isSaved ? "Đã lưu" : "Yêu thích"}
          </button>
        </div>
      </div>

      <SurfaceCard className="p-6">
        <div className="grid gap-5">
          {product.variants.length > 0 ? (
            <Field htmlFor="variant-select" label="Biến thể">
              <Select
                id="variant-select"
                value={selectedVariantSku}
                onChange={(event) => onVariantChange(event.target.value)}
              >
                {product.variants.map((variant) => (
                  <option key={variant.sku} value={variant.sku}>
                    {variant.label}
                    {variant.color ? ` - ${variant.color}` : ""}
                    {variant.size ? ` - ${variant.size}` : ""}
                    {variant.stock <= 0 ? " (Hết hàng)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <div className="flex items-center gap-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
              Số lượng
            </span>
            <div className="flex items-center gap-3 rounded-full bg-surface px-3 py-2">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-low text-primary"
                onClick={onDecreaseQuantity}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-6 text-center text-sm font-semibold text-primary">{quantity}</span>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-low text-primary"
                onClick={onIncreaseQuantity}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <button
              type="button"
              className={cn(buttonStyles({ size: "lg" }), "w-full md:flex-1")}
              disabled={effectiveStock <= 0 || busy === "cart"}
              onClick={onAddToCart}
            >
              {busy === "cart" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ShoppingBag className="h-4 w-4" />
              )}
              <span>{busy === "cart" ? "Đang thêm..." : "Thêm vào giỏ"}</span>
            </button>
            <button
              type="button"
              className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full md:flex-1")}
              disabled={effectiveStock <= 0}
              onClick={onBuyNow}
            >
              Mua ngay
            </button>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard className="p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">SKU</p>
            <p className="mt-2 text-sm text-primary">{selectedVariant?.sku || product.sku || "N/A"}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">Brand</p>
            <p className="mt-2 text-sm text-primary">{product.brand || "Commerce Platform"}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">Cập nhật</p>
            <p className="mt-2 text-sm text-primary">{formatLongDate(product.updated_at)}</p>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
