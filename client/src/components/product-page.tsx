"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Heart,
  Package,
  Shield,
  TimerReset,
  Truck,
} from "lucide-react";
import { useState } from "react";

import { getProductBySlug, reviewHighlights } from "@/data/storefront";
import type { Product } from "@/lib/types";
import { cn, formatCurrency, getAvailabilityLabel } from "@/lib/utils";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  Badge,
  Button,
  ProductCard,
  QuantityStepper,
  RatingStars,
  SectionHeading,
} from "@/components/storefront-ui";
import { useStorefront } from "@/store/storefront-provider";

const architectureCards = [
  {
    icon: <Shield className="h-5 w-5" />,
    title: "Privacy-safe checkout",
    copy: "Clear focus states and stronger affordances make the buy box easier to trust without drifting off-brand.",
  },
  {
    icon: <Package className="h-5 w-5" />,
    title: "Live inventory",
    copy: "Stock and low-quantity language are visible early, matching the platform direction in the repo guidelines.",
  },
  {
    icon: <Truck className="h-5 w-5" />,
    title: "Shipping clarity",
    copy: "Delivery notes and post-purchase cues are surfaced before the user commits, reducing uncertainty.",
  },
];

export function ProductPage({ product }: { product: Product }) {
  const [selectedImage, setSelectedImage] = useState(product.gallery[0] ?? product.image);
  const [selectedColor, setSelectedColor] = useState(product.colors[0]?.name ?? "Default");
  const [selectedSize, setSelectedSize] = useState(
    product.sizes.find((size) => size.inStock)?.label ?? product.sizes[0]?.label ?? "One Size",
  );
  const [quantity, setQuantity] = useState(1);
  const { addToCart, toggleWishlist, wishlist } = useStorefront();

  const relatedProducts = product.relatedSlugs
    .map((slug) => getProductBySlug(slug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const isWishlisted = wishlist.includes(product.id);

  return (
    <>
      <SiteHeader />
      <main className="shell section-spacing">
        <nav className="mb-8 flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-outline">
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href={`/catalog?department=${product.department}`}>{product.department}</Link>
          <span>/</span>
          <span className="text-primary">{product.name}</span>
        </nav>

        <section className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-[2rem] bg-surface-container-low">
              <div className="relative aspect-[1.02]">
                <Image
                  src={selectedImage}
                  alt={product.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 55vw"
                  className="object-cover"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {product.gallery.map((image) => (
                <button
                  key={image}
                  type="button"
                  className={cn(
                    "relative overflow-hidden rounded-[1.4rem] border transition",
                    selectedImage === image
                      ? "border-primary shadow-editorial"
                      : "border-outline-variant/30 bg-surface-container-low",
                  )}
                  onClick={() => setSelectedImage(image)}
                >
                  <div className="relative aspect-[0.95]">
                    <Image
                      src={image}
                      alt={`${product.name} gallery image`}
                      fill
                      sizes="(max-width: 768px) 33vw, 18vw"
                      className="object-cover"
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="eyebrow">{product.collection}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {product.badges.map((badge) => (
                <Badge key={badge}>{badge}</Badge>
              ))}
            </div>
            <h1 className="mt-6 font-serif text-4xl font-semibold tracking-[-0.04em] text-primary md:text-6xl">
              {product.shortName ?? product.name}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-on-surface-variant md:text-lg">
              {product.subtitle}
            </p>

            <div className="mt-6 flex items-center gap-4">
              <RatingStars rating={product.rating} className="text-tertiary" />
              <span className="text-sm text-on-surface-variant">
                {product.reviewCount} verified reviews
              </span>
            </div>

            <div className="mt-8 flex items-end gap-4">
              <p className="font-serif text-4xl font-semibold tracking-[-0.03em] text-primary">
                {formatCurrency(product.price)}
              </p>
              {product.compareAtPrice ? (
                <p className="pb-1 text-sm text-outline line-through">
                  {formatCurrency(product.compareAtPrice)}
                </p>
              ) : null}
            </div>

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary">
              {getAvailabilityLabel(product)}
            </p>

            <div className="mt-10 rounded-[1.8rem] bg-surface-container-low p-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-outline">
                  Color
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {product.colors.map((color) => (
                    <button
                      key={color.name}
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition",
                        selectedColor === color.name
                          ? "border-primary bg-primary text-on-primary"
                          : "border-outline-variant bg-background text-primary hover:border-primary/40",
                      )}
                      onClick={() => setSelectedColor(color.name)}
                    >
                      <span
                        className="h-4 w-4 rounded-full border border-white/20"
                        style={{ backgroundColor: color.swatch }}
                      />
                      {color.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-outline">
                  Size
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {product.sizes.map((size) => (
                    <button
                      key={size.label}
                      type="button"
                      disabled={!size.inStock}
                      className={cn(
                        "rounded-2xl border px-3 py-3 text-sm transition",
                        selectedSize === size.label
                          ? "border-primary bg-primary text-on-primary"
                          : "border-outline-variant bg-background text-primary hover:border-primary/40",
                        !size.inStock && "cursor-not-allowed opacity-35",
                      )}
                      onClick={() => setSelectedSize(size.label)}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <QuantityStepper
                  quantity={quantity}
                  onDecrease={() => setQuantity((value) => Math.max(1, value - 1))}
                  onIncrease={() => setQuantity((value) => Math.min(9, value + 1))}
                />
                <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                  <Button
                    className="flex-1"
                    size="lg"
                    onClick={() =>
                      addToCart({
                        productId: product.id,
                        quantity,
                        selectedColor,
                        selectedSize,
                      })
                    }
                  >
                    Add to cart
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="sm:px-5"
                    onClick={() => toggleWishlist(product.id)}
                  >
                    <Heart className={cn("h-4 w-4", isWishlisted && "fill-current")} />
                    {isWishlisted ? "Saved" : "Save"}
                  </Button>
                </div>
              </div>

              <div className="mt-8 space-y-3 text-sm text-on-surface-variant">
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-primary" />
                  Complimentary shipping on orders above $1,000
                </div>
                <div className="flex items-center gap-3">
                  <TimerReset className="h-4 w-4 text-primary" />
                  Free size exchange within 14 days
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-6">
              <div>
                <h2 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                  The Wearer&apos;s Note
                </h2>
                <p className="mt-3 text-base leading-8 text-on-surface-variant">
                  {product.story}
                </p>
              </div>
              <div className="grid gap-4 rounded-[1.8rem] bg-surface-container-low p-6 sm:grid-cols-2">
                {product.specs.map((spec) => (
                  <div key={spec.label}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-outline">
                      {spec.label}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-primary">{spec.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-20">
          <SectionHeading
            eyebrow="System architecture"
            title="Product detail now explains why the experience feels reliable, not just why the product looks good."
            description="These cards translate the UX improvements into trust signals. They stay within the Stitch visual language but add more explicit reassurance for real buyers."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {architectureCards.map((card, index) => (
              <motion.div
                key={card.title}
                whileHover={{ y: -4 }}
                className={cn(
                  "rounded-[1.7rem] p-6",
                  index === 1
                    ? "bg-primary text-on-primary shadow-editorial"
                    : "bg-surface-container-low text-primary",
                )}
              >
                <div
                  className={cn(
                    "inline-flex h-12 w-12 items-center justify-center rounded-full",
                    index === 1 ? "bg-white/12" : "bg-background",
                  )}
                >
                  {card.icon}
                </div>
                <h3 className="mt-5 font-serif text-2xl font-semibold tracking-[-0.03em]">
                  {card.title}
                </h3>
                <p
                  className={cn(
                    "mt-3 text-sm leading-7",
                    index === 1 ? "text-on-primary/78" : "text-on-surface-variant",
                  )}
                >
                  {card.copy}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mt-20">
          <SectionHeading
            eyebrow="The wearer’s voice"
            title="Reviews are still editorial, but easier to scan."
            description="Shorter cards, more contrast and a simpler hierarchy make social proof feel trustworthy without cluttering the premium layout."
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {reviewHighlights.map((review) => (
              <div key={review.id} className="rounded-[1.6rem] bg-surface-container-low p-6">
                <RatingStars rating={review.rating} />
                <p className="mt-5 text-sm leading-7 text-on-surface-variant">
                  “{review.quote}”
                </p>
                <div className="mt-6 border-t border-outline-variant/25 pt-4">
                  <p className="font-medium text-primary">{review.author}</p>
                  <p className="text-sm text-on-surface-variant">
                    {review.role} · {review.createdAt}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20">
          <SectionHeading
            eyebrow="Complete the look"
            title="Related pieces"
            description="These are wired to the shared product dataset, so this rail is reusable across future PDPs."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard
                key={relatedProduct.id}
                product={relatedProduct}
                wishlisted={wishlist.includes(relatedProduct.id)}
                onToggleWishlist={toggleWishlist}
                onAddToCart={(selectedProduct) =>
                  addToCart({ productId: selectedProduct.id })
                }
              />
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
