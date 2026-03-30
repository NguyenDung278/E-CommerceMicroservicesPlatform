"use client";

import Link from "next/link";

import { EmptyState, InlineAlert, LoadingScreen } from "@/components/storefront-ui";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { buttonStyles } from "@/lib/button-styles";
import { fallbackImageForProduct } from "@/lib/utils";

import { ProductImageGallery } from "./product-page/product-image-gallery";
import { ProductPurchasePanel } from "./product-page/product-purchase-panel";
import { ProductReviewsSection } from "./product-page/product-reviews-section";
import { RelatedProductsSection } from "./product-page/related-products-section";
import { useProductPageState } from "./product-page/use-product-page-state";

export function ProductPage({ productId }: { productId: string }) {
  const {
    activeImage,
    busy,
    effectivePrice,
    effectiveStock,
    feedback,
    images,
    isAuthenticated,
    isLoading,
    isReviewLoading,
    isSaved,
    myReview,
    product,
    quantity,
    relatedProducts,
    requireAuth,
    reviewFeedback,
    reviewForm,
    reviewList,
    selectedVariant,
    selectedVariantSku,
    setActiveImage,
    setReviewForm,
    setSelectedVariantSku,
    toggleWishlist,
    updateQuantity,
    handleAddToCart,
    handleBuyNow,
    handleDeleteReview,
    handleReviewSubmit,
    handleViewRelatedProduct,
  } = useProductPageState(productId);

  if (isLoading) {
    return (
      <>
        <SiteHeader />
        <LoadingScreen label="Đang tải chi tiết sản phẩm..." />
        <SiteFooter />
      </>
    );
  }

  if (!product) {
    return (
      <>
        <SiteHeader />
        <main className="shell section-spacing">
          <EmptyState
            title="Không tìm thấy sản phẩm"
            description="ID sản phẩm có thể không tồn tại hoặc không còn khả dụng trong catalog active."
            action={
              <Link href="/products" className={buttonStyles({ variant: "secondary" })}>
                Quay lại catalog
              </Link>
            }
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  const galleryImages = (images.length ? images : [fallbackImageForProduct(product.name)]).slice(0, 4);
  const activeGalleryImage = activeImage || galleryImages[0];

  return (
    <>
      <SiteHeader />
      <main className="shell section-spacing space-y-16">
        {feedback ? <InlineAlert tone="info">{feedback}</InlineAlert> : null}

        <section className="grid gap-10 lg:grid-cols-[1.08fr_minmax(0,0.92fr)] lg:items-start">
          <ProductImageGallery
            activeImage={activeGalleryImage}
            images={galleryImages}
            productName={product.name}
            onSelectImage={setActiveImage}
          />

          <ProductPurchasePanel
            busy={busy}
            effectivePrice={effectivePrice}
            effectiveStock={effectiveStock}
            isSaved={isSaved(product.id)}
            onAddToCart={() => void handleAddToCart()}
            onBuyNow={handleBuyNow}
            onDecreaseQuantity={() => updateQuantity(quantity - 1)}
            onIncreaseQuantity={() => updateQuantity(quantity + 1)}
            onToggleWishlist={() => toggleWishlist(product.id)}
            onVariantChange={setSelectedVariantSku}
            product={product}
            quantity={quantity}
            selectedVariant={selectedVariant}
            selectedVariantSku={selectedVariantSku}
          />
        </section>

        <ProductReviewsSection
          busy={busy}
          isAuthenticated={isAuthenticated}
          isReviewLoading={isReviewLoading}
          myReview={myReview}
          onCommentChange={(comment) => setReviewForm((current) => ({ ...current, comment }))}
          onDeleteReview={() => void handleDeleteReview()}
          onRatingChange={(rating) => setReviewForm((current) => ({ ...current, rating }))}
          onRequireAuth={requireAuth}
          onSubmit={(event) => void handleReviewSubmit(event)}
          reviewFeedback={reviewFeedback}
          reviewForm={reviewForm}
          reviewList={reviewList}
        />

        <RelatedProductsSection
          isSaved={isSaved}
          onViewProduct={handleViewRelatedProduct}
          relatedProducts={relatedProducts}
        />
      </main>
      <SiteFooter />
    </>
  );
}
