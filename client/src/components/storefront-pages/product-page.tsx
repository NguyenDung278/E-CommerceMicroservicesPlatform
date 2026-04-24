"use client";

import Link from "next/link";

import {
  EmptyState,
  InlineAlert,
  LoadingScreen,
  SurfaceCard,
} from "@/components/storefront-shared/storefront-ui";
import {
  RecoveredEditorialFooter,
  RecoveredStorefrontHeader,
} from "@/components/storefront-shared/recovered-storefront-chrome";
import { buttonStyles } from "@/lib/button-styles";
import type { ProductPageInitialData } from "@/lib/storefront/initial-data";
import { fallbackImageForProduct } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";

import { ProductImageGallery } from "./product-page/product-image-gallery";
import { ProductPurchasePanel } from "./product-page/product-purchase-panel";
import { ProductReviewsSection } from "./product-page/product-reviews-section";
import { RelatedProductsSection } from "./product-page/related-products-section";
import { useProductPageState } from "./product-page/use-product-page-state";

export function ProductPage({
  productId,
  initialData,
}: {
  productId: string;
  initialData?: ProductPageInitialData;
}) {
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
  } = useProductPageState(productId, initialData);

  if (isLoading) {
    return (
      <main>
        <section className="shell pt-6 md:pt-8">
          <RecoveredStorefrontHeader navigation="fallback" tone="light" />
        </section>
        <LoadingScreen label="Đang tải chi tiết sản phẩm..." />
        <section className="shell pb-12">
          <RecoveredEditorialFooter />
        </section>
      </main>
    );
  }

  if (!product) {
    return (
      <main>
        <section className="shell pt-6 md:pt-8">
          <RecoveredStorefrontHeader navigation="fallback" tone="light" />
        </section>
        <section className="shell section-spacing">
          <EmptyState
            title="Không tìm thấy sản phẩm"
            description="Sản phẩm này hiện không còn hiển thị hoặc đã được thay thế bằng lựa chọn khác."
            action={
              <Link href="/products" className={buttonStyles({ variant: "secondary" })}>
                Quay lại All Archive
              </Link>
            }
          />
        </section>
        <section className="shell pb-12">
          <RecoveredEditorialFooter />
        </section>
      </main>
    );
  }

  const galleryImages = (images.length ? images : [fallbackImageForProduct(product.name)]).slice(0, 4);
  const activeGalleryImage = activeImage || galleryImages[0];
  const reviewCount = reviewList.summary.review_count;
  const averageRating = reviewCount > 0 ? reviewList.summary.average_rating.toFixed(1) : "Mới";
  const deliveryPromise =
    selectedVariant?.lead_time ||
    "Giao theo khung thời gian tiêu chuẩn để bạn dễ sắp xếp nhận hàng.";
  const editorialSignal =
    selectedVariant?.color ||
    selectedVariant?.size ||
    product.brand ||
    product.category ||
    "Tuyến sưu tập";

  return (
    <main>
      <section className="shell pt-6 md:pt-8">
        <RecoveredStorefrontHeader navigation="fallback" tone="light" />
      </section>

      <section className="shell section-spacing detail-editorial-shell space-y-10">
        <section className="grid gap-6 rounded-[2rem] border border-[#d9d2c9] bg-white/72 px-6 py-7 shadow-editorial backdrop-blur md:px-8 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <p className="eyebrow">{product.category || "Hồ sơ sản phẩm"}</p>
            <h1 className="mt-4 max-w-4xl font-serif text-5xl font-semibold tracking-[-0.05em] text-primary md:text-[4.25rem]">
              {product.name}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-on-surface-variant md:text-lg">
              {product.description}
            </p>
          </div>

          <div className="grid content-start gap-4 rounded-[1.5rem] bg-[#f6f1ea] p-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                Giá hiện tại
              </p>
              <p className="mt-2 font-serif text-3xl font-semibold tracking-[-0.04em] text-primary">
                {formatCurrency(effectivePrice)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                Tình trạng
              </p>
              <p className="mt-2 text-sm font-medium text-primary">
                {effectiveStock <= 0
                  ? "Hết hàng"
                  : effectiveStock <= 5
                    ? `Sắp hết hàng - còn ${effectiveStock}`
                    : "Sẵn sàng giao ngay"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                Thương hiệu
              </p>
              <p className="mt-2 text-sm font-medium text-primary">{product.brand || "ND Shop"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                Tín hiệu đánh giá
              </p>
              <p className="mt-2 text-sm font-medium text-primary">
                {averageRating}
                {reviewCount > 0 ? ` / 5 từ ${reviewCount} đánh giá` : " - chưa có đánh giá"}
              </p>
            </div>
          </div>
        </section>

        {feedback ? <InlineAlert tone="info">{feedback}</InlineAlert> : null}

        <section className="detail-layout-editorial grid gap-10 lg:grid-cols-[1.08fr_minmax(0,0.92fr)] lg:items-start">
          <ProductImageGallery
            activeImage={activeGalleryImage}
            brand={product.brand || undefined}
            category={product.category || undefined}
            deliveryPromise={deliveryPromise}
            images={galleryImages}
            productName={product.name}
            reviewLabel={reviewCount > 0 ? `${averageRating} / 5 từ ${reviewCount} lượt` : "Vừa mở bán"}
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

        <section className="detail-assurance-grid grid gap-5 xl:grid-cols-3">
          <SurfaceCard className="detail-assurance-card p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
              Ghi chú giao diện
            </p>
            <h2 className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
              Trang chi tiết đã được phục hồi
            </h2>
            <p className="mt-4 text-sm leading-7 text-on-surface-variant">
              Bố cục được giữ thoáng và rõ để bạn tập trung vào hình ảnh, lựa chọn biến thể và quyết định mua nhanh hơn.
            </p>
          </SurfaceCard>

          <SurfaceCard className="detail-assurance-card p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
              Cam kết giao hàng
            </p>
            <h2 className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
              {deliveryPromise}
            </h2>
            <p className="mt-4 text-sm leading-7 text-on-surface-variant">
              Variant đang chọn: <span className="font-medium text-primary">{editorialSignal}</span>.
              Sau khi đặt hàng, bạn có thể quay lại tài khoản để theo dõi tình trạng đơn và thanh toán.
            </p>
          </SurfaceCard>

          <SurfaceCard className="detail-assurance-card p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
              Bảo quản & đổi trả
            </p>
            <h2 className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
              Trung tâm đổi trả đã sẵn sàng
            </h2>
            <p className="mt-4 text-sm leading-7 text-on-surface-variant">
              Nếu sản phẩm chưa phù hợp, bạn vẫn có thể gửi yêu cầu đổi trả và theo dõi hoàn tiền trong khu vực tài khoản.
            </p>
          </SurfaceCard>
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
      </section>

      <section className="shell pb-12">
        <RecoveredEditorialFooter />
      </section>
    </main>
  );
}
