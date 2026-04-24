"use client";

import { Heart, LoaderCircle, Minus, Plus, ShoppingBag } from "lucide-react";

import {
  Field,
  Select,
  SurfaceCard,
} from "@/components/storefront-shared/storefront-ui";
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
  const stockTone =
    effectiveStock <= 0 ? "detail-stock-line-out" : "detail-stock-line-in";

  return (
    <div className="detail-copy-editorial space-y-6 lg:sticky lg:top-28">
      <div className="rounded-[1.5rem] bg-surface-container-low px-6 py-8 md:px-8">
        <p className="eyebrow">Purchase panel</p>
        <div className="detail-badge-row mt-4">
          <span className="cart-editorial-badge">{product.category || "Catalog"}</span>
          <span className="cart-editorial-badge">{product.brand || "ND Shop"}</span>
          <span className={cn("cart-editorial-badge", effectiveStock <= 0 && "bg-[#fde4e1] text-[#8c2619]")}>
            {effectiveStock <= 0 ? "Sold out" : `${effectiveStock} ready`}
          </span>
        </div>
        <h2 className="mt-5 font-serif text-4xl font-semibold tracking-[-0.04em] text-primary md:text-5xl">
          Select your preferred variant.
        </h2>
        <p className="detail-description-editorial mt-5 text-base leading-8 text-on-surface-variant">
          Product detail này đang giữ live state từ product-service, nhưng rail mua hàng đã được kéo lại nhịp editorial cũ hơn để tách phần chọn variant, quantity và checkout action rõ ràng hơn.
        </p>

        <div className="detail-utility-row mt-7 flex items-center justify-between gap-4">
          <div>
            <strong className="detail-price-display block font-serif text-4xl font-semibold tracking-[-0.03em] text-primary">
              {formatCurrency(effectivePrice)}
            </strong>
            <p className={cn("detail-stock-line mt-2 block text-sm text-on-surface-variant", stockTone)}>
              {effectiveStock <= 0
                ? "Hết hàng"
                : effectiveStock <= 5
                  ? `Còn ${effectiveStock} sản phẩm`
                  : "Còn hàng"}
            </p>
          </div>
          <button
            type="button"
            className={cn(
              "detail-save-button shrink-0 gap-2",
              isSaved && "detail-save-button-active",
            )}
            onClick={onToggleWishlist}
          >
            <Heart className="h-4 w-4" />
            {isSaved ? "Đã lưu" : "Yêu thích"}
          </button>
        </div>
      </div>

      <SurfaceCard className="detail-action-panel p-6">
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

          <div className="detail-quantity-field flex items-center gap-4">
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

          <div className="detail-actions-editorial flex flex-col gap-3 md:flex-row">
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

          <p className="detail-utility-note">
            Buy now sẽ chuyển thẳng sang checkout với product hiện tại, còn add to cart sẽ giữ lại state để bạn tiếp tục đi qua archive.
          </p>
        </div>
      </SurfaceCard>

      <div className="detail-assurance-grid">
        <div className="detail-assurance-card">
          <span>SKU</span>
          <strong>{selectedVariant?.sku || product.sku || "N/A"}</strong>
        </div>
        <div className="detail-assurance-card">
          <span>Brand</span>
          <strong>{product.brand || "ND Shop"}</strong>
        </div>
        <div className="detail-assurance-card">
          <span>Updated</span>
          <strong>{formatLongDate(product.updated_at)}</strong>
        </div>
      </div>

      <div className="detail-system-grid">
        <div className="detail-system-card detail-system-card-active">
          <strong>Cart + Wishlist</strong>
          <p>State hoạt động trực tiếp trên client recovered.</p>
        </div>
        <div className="detail-system-card">
          <strong>Checkout lane</strong>
          <p>Order sẽ được tạo rồi bàn giao cho payment-service.</p>
        </div>
        <div className="detail-system-card">
          <strong>Returns ready</strong>
          <p>Đơn đã mua quay lại luồng returns center đã phục hồi.</p>
        </div>
      </div>

      <div className="detail-mobile-buy-bar">
        <div className="detail-mobile-buy-copy">
          <span className="detail-mobile-buy-kicker">{product.category || "Product"}</span>
          <strong>{formatCurrency(effectivePrice)}</strong>
          <span>{effectiveStock <= 0 ? "Out of stock" : `${quantity} item selected`}</span>
        </div>
        <div className="detail-mobile-buy-actions">
          <button
            type="button"
            className={buttonStyles({ variant: "secondary" })}
            disabled={effectiveStock <= 0 || busy === "cart"}
            onClick={onAddToCart}
          >
            {busy === "cart" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
            <span>{busy === "cart" ? "Đang thêm..." : "Add"}</span>
          </button>
          <button
            type="button"
            className={buttonStyles()}
            disabled={effectiveStock <= 0}
            onClick={onBuyNow}
          >
            Buy now
          </button>
        </div>
      </div>
    </div>
  );
}
