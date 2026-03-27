"use client";

import Link from "next/link";
import { LoaderCircle, ShoppingBag, Sparkles } from "lucide-react";
import type { TextareaHTMLAttributes } from "react";

import { buttonStyles } from "@/lib/button-styles";
import { cn, fallbackImageForProduct, getProductImages, getStatusTone } from "@/lib/utils";
import type { Product } from "@/types/api";
import { formatCurrency } from "@/utils/format";

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-secondary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-secondary",
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
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 className="headline-section mt-4 text-primary">{title}</h2>
        {description ? (
          <p className="mt-5 max-w-2xl text-base leading-8 text-on-surface-variant md:text-lg">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function SurfaceCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[2rem] bg-surface-container-low", className)}>{children}</div>
  );
}

export function InlineAlert({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "error"
      ? "bg-[#fde4e1] text-[#7c2417]"
      : tone === "success"
        ? "bg-[#e5efe8] text-[#1b4a2c]"
        : "bg-surface-container-high text-on-surface";

  return (
    <div className={cn("rounded-[1.5rem] px-5 py-4 text-sm leading-7", toneClass)}>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <SurfaceCard className="p-8 text-center md:p-12">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface text-primary">
        <Sparkles className="h-5 w-5" />
      </div>
      <h3 className="mt-5 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
        {title}
      </h3>
      <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-on-surface-variant">
        {description}
      </p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </SurfaceCard>
  );
}

export function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="shell flex min-h-[60vh] items-center justify-center">
      <div className="flex items-center gap-3 rounded-full bg-surface-container-low px-6 py-4 text-sm font-medium text-primary">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        <span>{label}</span>
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone = getStatusTone(status);
  const className =
    tone === "emerald"
      ? "bg-[#ddebe1] text-[#254f34]"
      : tone === "amber"
        ? "bg-[#f8edd2] text-[#865d19]"
        : tone === "red"
          ? "bg-[#fde4e1] text-[#8c2619]"
          : "bg-surface-container-high text-on-surface";

  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]", className)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="animate-pulse rounded-[2rem] bg-surface-container-low p-4">
      <div className="aspect-[4/5] rounded-[1.5rem] bg-surface-container-high" />
      <div className="mt-4 h-3 w-24 rounded-full bg-surface-container-high" />
      <div className="mt-3 h-7 w-3/4 rounded-full bg-surface-container-high" />
      <div className="mt-3 h-4 w-1/2 rounded-full bg-surface-container-high" />
      <div className="mt-5 h-11 rounded-full bg-surface-container-high" />
    </div>
  );
}

export function ProductCard({
  product,
  saved,
  actionSlot,
  footerSlot,
}: {
  product: Product;
  saved?: boolean;
  actionSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
}) {
  const images = getProductImages(product.image_url, product.image_urls);
  const previewImage = images[0] || fallbackImageForProduct(product.name);
  const soldOut = product.stock <= 0;
  const lowStock = product.stock > 0 && product.stock <= 5;

  return (
    <article className="group rounded-[2rem] bg-surface transition hover:bg-surface-container-low">
      <Link href={`/products/${product.id}`} className="block overflow-hidden rounded-[2rem]">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-surface-container-low">
          <img
            alt={product.name}
            src={previewImage}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]"
          />
          <div className="pointer-events-none absolute inset-x-4 top-4 flex items-center justify-between gap-3">
            <Badge className="bg-background/90 text-primary">{product.category || "Catalog"}</Badge>
            {saved ? <Badge className="bg-tertiary text-white">Saved</Badge> : null}
          </div>
        </div>
      </Link>

      <div className="px-2 pb-2 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-tertiary">
              {product.brand || "Commerce Platform"}
            </p>
            <Link href={`/products/${product.id}`} className="mt-2 block font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
              {product.name}
            </Link>
          </div>
          <div className="text-right">
            <strong className="block text-base font-semibold text-primary">{formatCurrency(product.price)}</strong>
            <span className="mt-1 block text-xs text-on-surface-variant">
              {soldOut ? "Hết hàng" : lowStock ? `Còn ${product.stock}` : "Còn hàng"}
            </span>
          </div>
        </div>

        <p className="mt-3 line-clamp-2 text-sm leading-7 text-on-surface-variant">
          {product.description}
        </p>

        {footerSlot ? <div className="mt-4">{footerSlot}</div> : null}

        {actionSlot ? (
          <div className="mt-5">{actionSlot}</div>
        ) : (
          <Link href={`/products/${product.id}`} className={cn(buttonStyles({ variant: "secondary" }), "w-full")}>
            Xem chi tiết
          </Link>
        )}
      </div>
    </article>
  );
}

export function ProductCardAction({
  onClick,
  disabled,
  loading,
  label = "Thêm vào giỏ",
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={cn(buttonStyles({ size: "md" }), "w-full")}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
      <span>{loading ? "Đang thêm..." : label}</span>
    </button>
  );
}

export function Field({
  label,
  htmlFor,
  required,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-3" htmlFor={htmlFor}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
        {label} {required ? <span className="text-tertiary">*</span> : null}
      </span>
      {children}
      {error ? <span className="block text-sm text-error">{error}</span> : null}
    </label>
  );
}

export function TextInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "minimal-input rounded-none border-b border-outline-variant px-0 py-3 text-sm text-on-surface placeholder:text-outline focus:border-primary",
        className,
      )}
    />
  );
}

export function TextArea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-28 w-full rounded-[1.5rem] bg-surface px-4 py-4 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/15",
        className,
      )}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-[1.25rem] bg-surface px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/15",
        className,
      )}
    >
      {children}
    </select>
  );
}

export function PageLinkCard({
  href,
  title,
  copy,
  badge,
}: {
  href: string;
  title: string;
  copy: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[2rem] bg-surface-container-low p-6 transition hover:-translate-y-1 hover:bg-surface-container-high"
    >
      {badge ? <Badge>{badge}</Badge> : null}
      <h3 className="mt-4 font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-7 text-on-surface-variant">{copy}</p>
      <span className="mt-5 inline-flex text-sm font-medium text-primary transition group-hover:translate-x-1">
        Mở trang →
      </span>
    </Link>
  );
}

