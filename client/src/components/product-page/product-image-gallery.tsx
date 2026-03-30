"use client";

import { StorefrontImage } from "@/components/storefront-image";
import { cn } from "@/lib/utils";

type ProductImageGalleryProps = {
  activeImage: string;
  images: string[];
  productName: string;
  onSelectImage: (image: string) => void;
};

export function ProductImageGallery({
  activeImage,
  images,
  productName,
  onSelectImage,
}: ProductImageGalleryProps) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[1.25rem] bg-surface-container-low p-3">
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
      <div className="grid grid-cols-4 gap-3">
        {images.slice(0, 4).map((image) => (
          <button
            key={image}
            type="button"
            className={cn(
              "overflow-hidden rounded-[1rem] bg-surface-container-low",
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
    </div>
  );
}
