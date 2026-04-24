"use client";

import { StorefrontImage } from "@/components/storefront-shared/storefront-image";
import { cn } from "@/lib/utils";

type ProductImageGalleryProps = {
  activeImage: string;
  brand?: string;
  category?: string;
  deliveryPromise: string;
  images: string[];
  productName: string;
  reviewLabel: string;
  onSelectImage: (image: string) => void;
};

export function ProductImageGallery({
  activeImage,
  brand,
  category,
  deliveryPromise,
  images,
  productName,
  reviewLabel,
  onSelectImage,
}: ProductImageGalleryProps) {
  return (
    <div className="detail-media-editorial space-y-4">
      <div className="detail-main-frame overflow-hidden rounded-[1.25rem] bg-surface-container-low p-3">
        <div className="detail-gallery-nav">
          <span className="detail-gallery-nav-button">Visual dossier</span>
          <span className="detail-gallery-nav-button">{images.length} frames</span>
        </div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-[1rem] bg-surface">
          <StorefrontImage
            alt={productName}
            src={activeImage}
            fill
            priority
            sizes="(min-width: 1024px) 52vw, 100vw"
            className="object-cover"
          />
        </div>
      </div>
      <div className="detail-gallery-caption">
        <div>
          <span>Collection frame</span>
          <strong>{category || brand || "Product archive"}</strong>
        </div>
        <small>{productName}</small>
      </div>
      <div className="detail-thumbnail-row-editorial grid grid-cols-4 gap-3">
        {images.slice(0, 4).map((image) => (
          <button
            key={image}
            type="button"
            className={cn(
              "detail-thumbnail-button overflow-hidden rounded-[1rem] bg-surface-container-low",
              activeImage === image && "ring-2 ring-primary/20",
            )}
            onClick={() => onSelectImage(image)}
          >
            <div className="relative aspect-square">
              <StorefrontImage
                alt={productName}
                src={image}
                fill
                sizes="(min-width: 1024px) 12vw, 24vw"
                className="object-cover"
              />
            </div>
          </button>
        ))}
      </div>
      <div className="detail-gallery-insight-grid">
        <div className="detail-gallery-insight-card">
          <span>Review signal</span>
          <strong>{reviewLabel}</strong>
        </div>
        <div className="detail-gallery-insight-card">
          <span>Brand lane</span>
          <strong>{brand || "ND Shop editorial"}</strong>
        </div>
        <div className="detail-gallery-insight-card">
          <span>Delivery promise</span>
          <strong>{deliveryPromise}</strong>
        </div>
      </div>
    </div>
  );
}
