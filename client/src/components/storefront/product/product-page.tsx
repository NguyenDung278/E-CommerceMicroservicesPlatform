"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ProductGallery } from "@/components/storefront/product/product-gallery";
import { ProductPurchasePanel } from "@/components/storefront/product/product-purchase-panel";
import { ProductSyncPanel } from "@/components/storefront/product/product-sync-panel";
import { storefrontSyncIntervalMs } from "@/components/storefront/storefront-shared";
import {
  RecoveredEditorialFooter,
  RecoveredStorefrontHeader,
} from "@/components/storefront-shared/recovered-storefront-chrome";
import { EmptyState, InlineAlert, LoadingScreen } from "@/components/storefront-shared/storefront-ui";
import { useCartActions } from "@/hooks/useCart";
import { productApi } from "@/lib/api/product";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import type { ProductPageInitialData } from "@/lib/storefront/initial-data";
import { fallbackImageForProduct, getProductImages } from "@/lib/utils";
import type { Product, ProductVariant } from "@/types/api";

function resolveVariantStock(product: Product, variant: ProductVariant | null) {
  return variant ? variant.stock : product.stock;
}

function resolveVariantPrice(product: Product, variant: ProductVariant | null) {
  return variant ? variant.price : product.price;
}

export function ProductPage({
  productId,
  initialData,
}: {
  productId: string;
  initialData?: ProductPageInitialData;
}) {
  const router = useRouter();
  const { addItem } = useCartActions();
  const [product, setProduct] = useState<Product | null>(initialData?.product ?? null);
  const [activeImage, setActiveImage] = useState("");
  const [selectedVariantSku, setSelectedVariantSku] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(initialData?.feedback ?? "");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const syncProduct = useCallback(async () => {
    try {
      const response = await productApi.getProductById(productId);
      setProduct(response.data);
      setFeedback("");
      setLastSyncedAt(new Date());
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void syncProduct();
    const intervalId = window.setInterval(() => void syncProduct(), storefrontSyncIntervalMs);
    const handleFocus = () => void syncProduct();

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [syncProduct]);

  const images = useMemo(
    () => (product ? getProductImages(product.image_url, product.image_urls) : []),
    [product],
  );
  const selectedVariant = product?.variants.find((variant) => variant.sku === selectedVariantSku) ?? null;
  const effectiveStock = product ? resolveVariantStock(product, selectedVariant) : 0;
  const effectivePrice = product ? resolveVariantPrice(product, selectedVariant) : 0;
  const soldOut = effectiveStock <= 0 || product?.status !== "active";

  useEffect(() => {
    if (!product) {
      return;
    }

    const nextImages = getProductImages(product.image_url, product.image_urls);
    const fallbackImage = nextImages[0] || fallbackImageForProduct(product.name);

    if (!activeImage || !nextImages.includes(activeImage)) {
      setActiveImage(fallbackImage);
    }

    if (product.variants.length > 0) {
      const hasSelectedVariant = product.variants.some((variant) => variant.sku === selectedVariantSku);
      if (!hasSelectedVariant) {
        setSelectedVariantSku(product.variants[0].sku);
        setQuantity(1);
      }
    } else if (selectedVariantSku) {
      setSelectedVariantSku("");
    }
  }, [activeImage, product, selectedVariantSku]);

  function updateQuantity(nextQuantity: number) {
    const maxQuantity = Math.max(1, Math.min(9, effectiveStock || 1));
    setQuantity(Math.min(maxQuantity, Math.max(1, nextQuantity)));
  }

  async function handleAddToCart() {
    if (!product || soldOut) {
      return;
    }

    try {
      setBusy(true);
      await addItem({ product_id: product.id, quantity });
      setFeedback(`Đã thêm ${quantity} x ${product.name} vào giỏ hàng.`);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  function handleBuyNow() {
    if (!product || soldOut) {
      return;
    }

    router.push(`/checkout?buy_now=${encodeURIComponent(product.id)}&qty=${quantity}`);
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <RecoveredStorefrontHeader />
        <LoadingScreen label="Đang tải sản phẩm..." />
      </main>
    );
  }

  if (!product) {
    return (
      <main className="min-h-screen bg-background">
        <RecoveredStorefrontHeader />
        <section className="shell py-10">
          <EmptyState
            title="Không tìm thấy sản phẩm"
            description="Sản phẩm này không còn tồn tại hoặc đã được gỡ khỏi catalog."
            action={
              <Link href="/products" className={buttonStyles({ variant: "secondary" })}>
                Quay lại catalog
              </Link>
            }
          />
        </section>
      </main>
    );
  }

  const galleryImages = (images.length ? images : [fallbackImageForProduct(product.name)]).slice(0, 5);
  return (
    <main className="min-h-screen bg-background">
      <RecoveredStorefrontHeader />

      <section className="shell py-6">
        {feedback ? (
          <div className="mb-4">
            <InlineAlert tone={feedback.startsWith("Đã") ? "success" : "info"}>{feedback}</InlineAlert>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <ProductGallery
            productName={product.name}
            activeImage={activeImage}
            images={galleryImages}
            onSelectImage={setActiveImage}
          />

          <aside className="grid h-fit gap-4 lg:sticky lg:top-24">
            <ProductPurchasePanel
              product={product}
              soldOut={soldOut}
              effectiveStock={effectiveStock}
              effectivePrice={effectivePrice}
              selectedVariantSku={selectedVariantSku}
              quantity={quantity}
              busy={busy}
              onVariantChange={(sku) => {
                setSelectedVariantSku(sku);
                setQuantity(1);
              }}
              onQuantityChange={updateQuantity}
              onAddToCart={handleAddToCart}
              onBuyNow={handleBuyNow}
            />
            <ProductSyncPanel
              isLoading={isLoading}
              lastSyncedAt={lastSyncedAt}
              selectedSku={selectedVariant?.sku || product.sku}
              updatedAt={product.updated_at}
            />
          </aside>
        </div>
      </section>

      <RecoveredEditorialFooter />
    </main>
  );
}
