"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  GripVertical,
  Heart,
  Minus,
  PackageSearch,
  Plus,
  RefreshCcw,
  Sparkles,
  Star,
} from "lucide-react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

import type { Product } from "@/lib/types";
import { buttonStyles } from "@/lib/button-styles";
import {
  cn,
  formatCurrency,
  getAvailabilityLabel,
  getAvailabilityTone,
  getDiscountPercent,
} from "@/lib/utils";

type ButtonSize = "sm" | "md" | "lg";

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "tertiary" | "ghost";
  size?: ButtonSize;
}) {
  return (
    <button
      className={buttonStyles({ variant, size, className })}
      type="button"
      {...props}
    />
  );
}

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-on-secondary",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="max-w-3xl">
        {eyebrow ? <p className="eyebrow mb-4">{eyebrow}</p> : null}
        <h2 className="headline-section text-primary text-balance">{title}</h2>
        {description ? (
          <p className="mt-4 max-w-2xl text-base leading-7 text-on-surface-variant md:text-lg">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function RatingStars({
  rating,
  className,
}: {
  rating: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 text-tertiary", className)}>
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = index < Math.round(rating);

        return (
          <Star
            key={`star-${index + 1}`}
            className={cn("h-3.5 w-3.5", filled ? "fill-current" : "opacity-25")}
          />
        );
      })}
      <span className="ml-1 text-xs font-medium text-on-surface-variant">
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

export function PriceLockup({
  price,
  compareAtPrice,
  className,
}: {
  price: number;
  compareAtPrice?: number;
  className?: string;
}) {
  const discount = getDiscountPercent(price, compareAtPrice);

  return (
    <div className={cn("flex flex-col items-end gap-1 text-right", className)}>
      <span className="text-base font-medium text-primary md:text-lg">
        {formatCurrency(price)}
      </span>
      {compareAtPrice ? (
        <span className="text-xs text-outline line-through">
          {formatCurrency(compareAtPrice)}
        </span>
      ) : null}
      {discount ? (
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-tertiary">
          {discount}% off
        </span>
      ) : null}
    </div>
  );
}

export function QuantityStepper({
  quantity,
  onIncrease,
  onDecrease,
  className,
}: {
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 rounded-full bg-surface-container-low px-3 py-2 text-primary",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        className="rounded-full p-1 text-outline transition hover:text-primary"
        onClick={onDecrease}
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-4 text-center text-sm font-medium">{quantity}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        className="rounded-full p-1 text-outline transition hover:text-primary"
        onClick={onIncrease}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ProductCard({
  product,
  className,
  wishlisted = false,
  onAddToCart,
  onToggleWishlist,
  priority = false,
  dragHandle,
  isDragging = false,
}: {
  product: Product;
  className?: string;
  wishlisted?: boolean;
  onAddToCart?: (product: Product) => void;
  onToggleWishlist?: (productId: string) => void;
  priority?: boolean;
  dragHandle?: HTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
}) {
  return (
    <motion.article
      layout
      className={cn(
        "group flex h-full flex-col rounded-[1.65rem] p-3 transition-colors duration-500 hover:bg-surface-container-low/70",
        isDragging && "scale-[0.99] opacity-70",
        className,
      )}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 240, damping: 24 }}
    >
      <div className="relative overflow-hidden rounded-[1.4rem] bg-surface-container-low">
        <Link
          href={`/product/${product.slug}`}
          className="relative block aspect-[0.78] overflow-hidden"
        >
          <Image
            src={product.image}
            alt={product.name}
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition duration-700 group-hover:scale-[1.045]"
          />
        </Link>

        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {product.badges[0] ? <Badge>{product.badges[0]}</Badge> : null}
        </div>

        <div className="absolute right-4 top-4 flex flex-col gap-2">
          {dragHandle ? (
            <button
              aria-label={`Drag ${product.name}`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-background/90 text-primary shadow-sm backdrop-blur-md transition hover:bg-background"
              type="button"
              {...dragHandle}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : null}
          {onToggleWishlist ? (
            <button
              type="button"
              aria-label={
                wishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name}`
              }
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full bg-background/90 text-primary shadow-sm backdrop-blur-md transition hover:bg-background",
                wishlisted && "bg-primary text-on-primary",
              )}
              onClick={() => onToggleWishlist(product.id)}
            >
              <Heart className={cn("h-4 w-4", wishlisted && "fill-current")} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-1 flex-col gap-3 px-1 pb-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-outline">
              {product.category}
            </p>
            <Link
              href={`/product/${product.slug}`}
              className="font-serif text-xl font-semibold tracking-[-0.03em] text-primary transition hover:text-tertiary-container"
            >
              {product.name}
            </Link>
          </div>
          <PriceLockup price={product.price} compareAtPrice={product.compareAtPrice} />
        </div>

        <p className="text-sm leading-6 text-on-surface-variant">{product.subtitle}</p>

        <div className="mt-auto flex items-center justify-between gap-4">
          <div>
            <RatingStars rating={product.rating} />
            <p
              className={cn(
                "mt-2 text-[11px] font-semibold uppercase tracking-[0.22em]",
                getAvailabilityTone(product.availability),
              )}
            >
              {getAvailabilityLabel(product)}
            </p>
          </div>
          {onAddToCart ? (
            <Button size="sm" className="shrink-0" onClick={() => onAddToCart(product)}>
              Add to cart
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}

export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-[1.65rem] p-3", className)}>
      <div className="aspect-[0.78] rounded-[1.4rem] bg-surface-container-low" />
      <div className="mt-5 space-y-3 px-1">
        <div className="h-3 w-20 rounded-full bg-surface-container-high" />
        <div className="h-5 w-3/4 rounded-full bg-surface-container-high" />
        <div className="h-3 w-full rounded-full bg-surface-container-high" />
        <div className="h-3 w-5/6 rounded-full bg-surface-container-high" />
        <div className="flex items-center justify-between pt-3">
          <div className="h-8 w-28 rounded-full bg-surface-container-high" />
          <div className="h-8 w-24 rounded-full bg-surface-container-high" />
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "editorial-card flex flex-col items-center justify-center rounded-[2rem] px-6 py-16 text-center",
        className,
      )}
    >
      <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high">
        <PackageSearch className="h-7 w-7 text-primary" />
      </div>
      <h3 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
        {title}
      </h3>
      <p className="mt-4 max-w-lg text-sm leading-7 text-on-surface-variant md:text-base">
        {description}
      </p>
      {action ? <div className="mt-8">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
  className,
}: {
  title: string;
  description: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "editorial-card rounded-[2rem] border border-error/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.52),rgba(255,255,255,0.12))] px-6 py-14",
        className,
      )}
    >
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-error/8">
          <AlertCircle className="h-7 w-7 text-error" />
        </div>
        <h3 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
          {title}
        </h3>
        <p className="mt-4 text-sm leading-7 text-on-surface-variant md:text-base">
          {description}
        </p>
        {onRetry ? (
          <Button className="mt-8" onClick={onRetry}>
            <RefreshCcw className="h-4 w-4" />
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function MicroHighlight({
  icon,
  title,
  copy,
  className,
}: {
  icon?: ReactNode;
  title: string;
  copy: string;
  className?: string;
}) {
  return (
    <div className={cn("editorial-card rounded-[1.5rem] p-6", className)}>
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-primary shadow-sm">
        {icon ?? <Sparkles className="h-5 w-5" />}
      </div>
      <h3 className="font-serif text-xl font-semibold tracking-[-0.03em] text-primary">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-7 text-on-surface-variant">{copy}</p>
    </div>
  );
}
