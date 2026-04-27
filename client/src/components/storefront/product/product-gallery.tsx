"use client";

import { StorefrontImage } from "@/components/storefront-shared/storefront-image";
import { cn } from "@/lib/utils";

export function ProductGallery({
  productName,
  activeImage,
  images,
  onSelectImage,
}: {
  productName: string;
  activeImage: string;
  images: string[];
  onSelectImage: (image: string) => void;
}) {
  return (
    <section className="commerce-section p-3 md:p-4">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-xl)] bg-surface-container-low md:aspect-square">
        <StorefrontImage
          alt={productName}
          src={activeImage || images[0]}
          fill
          sizes="(min-width: 1024px) 58vw, 100vw"
          className="object-cover"
        />
      </div>

      {images.length > 1 ? (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {images.map((image) => (
            <button
              key={image}
              type="button"
              className={cn(
                "relative aspect-square overflow-hidden rounded-[var(--radius-lg)] border bg-surface-container-low transition",
                activeImage === image
                  ? "border-primary ring-2 ring-primary/15"
                  : "border-outline-variant hover:border-primary/40",
              )}
              onClick={() => onSelectImage(image)}
            >
              <StorefrontImage alt={productName} src={image} fill sizes="96px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
