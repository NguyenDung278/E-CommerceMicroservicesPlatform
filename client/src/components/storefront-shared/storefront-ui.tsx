"use client";

import Link from "next/link";
import { LoaderCircle, ShoppingBag, Sparkles } from "lucide-react";
import type { TextareaHTMLAttributes } from "react";

import { StorefrontImage } from "@/components/storefront-shared/storefront-image";
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
        "inline-flex items-center rounded-full bg-secondary-container px-3 py-1 text-xs font-semibold uppercase tracking-normal text-secondary",
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
        <h2 className="headline-section mt-3 text-on-surface">{title}</h2>
        {description ? (
          <p className="mt-4 max-w-2xl text-base leading-7 text-on-surface-variant">
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
    <div className={cn("commerce-section", className)}>{children}</div>
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
      ? "border-[#fda29b] bg-[#fff1f0] text-[#8a2a1f]"
      : tone === "success"
        ? "border-[#a6f4c5] bg-[#ecfdf3] text-[#05603a]"
        : "border-outline-variant bg-surface-container-low text-on-surface";

  return (
    <div className={cn("rounded-[var(--radius-xl)] border px-4 py-3 text-sm leading-6 shadow-[0_10px_26px_-24px_rgba(17,24,39,0.42)]", toneClass)}>
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
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[var(--radius-xl)] bg-secondary-container text-secondary">
        <Sparkles className="h-5 w-5" />
      </div>
      <h3 className="mt-5 text-2xl font-semibold text-on-surface md:text-3xl">
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
      <div className="flex items-center gap-3 rounded-[var(--radius-xl)] border border-outline-variant bg-surface px-6 py-4 text-sm font-semibold text-primary shadow-[var(--shadow-card)]">
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
      ? "bg-[#ecfdf3] text-[#05603a]"
      : tone === "amber"
        ? "bg-[#fffaeb] text-[#93370d]"
        : tone === "red"
          ? "bg-[#fff1f0] text-[#8a2a1f]"
          : "bg-surface-container-high text-on-surface";

  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-normal", className)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-2xl)] border border-outline-variant bg-surface shadow-[var(--shadow-card)]">
      <div className="aspect-[4/5] animate-pulse bg-surface-container" />
      <div className="grid gap-3 p-4">
        <div className="h-3 w-24 animate-pulse rounded-full bg-surface-container" />
        <div className="h-6 w-4/5 animate-pulse rounded-full bg-surface-container" />
        <div className="h-4 w-1/2 animate-pulse rounded-full bg-surface-container" />
        <div className="h-10 animate-pulse rounded-[var(--radius-lg)] bg-surface-container" />
      </div>
    </div>
  );
}

export function ProductCard({
  product,
  saved,
  actionSlot,
  footerSlot,
  onNavigate,
}: {
  product: Product;
  saved?: boolean;
  actionSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
  onNavigate?: () => void;
}) {
  const images = getProductImages(product.image_url, product.image_urls);
  const previewImage = images[0] || fallbackImageForProduct(product.name);
  const soldOut = product.stock <= 0;
  const lowStock = product.stock > 0 && product.stock <= 5;

  return (
    <article className="commerce-card group overflow-hidden">
      <Link
        href={`/products/${product.id}`}
        className="block overflow-hidden"
        onClick={onNavigate}
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-surface-container-low">
          <StorefrontImage
            alt={product.name}
            src={previewImage}
            fill
            sizes="(min-width: 1280px) 29vw, (min-width: 768px) 42vw, 92vw"
            className="object-cover transition duration-500 group-hover:scale-[1.04]"
          />
          <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between gap-3">
            <Badge className="bg-background/94 text-primary shadow-[0_10px_20px_-18px_rgba(17,24,39,0.42)]">
              {product.category || "Catalog"}
            </Badge>
            {saved ? (
              <Badge className="bg-primary text-on-primary">
                Đã lưu
              </Badge>
            ) : null}
          </div>
        </div>
      </Link>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={`/products/${product.id}`}
              className="mt-1 block line-clamp-2 text-base font-semibold leading-snug text-on-surface hover:text-primary"
              onClick={onNavigate}
            >
              {product.name}
            </Link>
            <p className="mt-2 text-sm text-on-surface-variant">
              {soldOut ? "Hết hàng" : lowStock ? `Sắp hết: còn ${product.stock}` : `Còn ${product.stock} sản phẩm`}
            </p>
          </div>
          <strong className="shrink-0 text-lg font-semibold text-primary">{formatCurrency(product.price)}</strong>
        </div>

        <p className="line-clamp-2 min-h-11 text-sm leading-6 text-on-surface-variant">
          {product.description || "Giá và tồn kho được cập nhật trực tiếp từ catalog quản trị."}
        </p>

        <div className="flex items-end justify-between gap-4 pt-2">
          <div className="min-h-10">
            {footerSlot ? footerSlot : (
              <span className="text-xs text-on-surface-variant">
                {soldOut ? "Hết hàng" : lowStock ? `Còn ${product.stock}` : "Còn hàng"}
              </span>
            )}
          </div>
          {actionSlot ? actionSlot : (
            <Link href={`/products/${product.id}`} className={buttonStyles({ variant: "secondary" })}>
              Xem chi tiết
            </Link>
          )}
        </div>
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
      className={buttonStyles({ size: "md" })}
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
      className="group rounded-[1.5rem] bg-surface-container-low p-6 transition hover:-translate-y-1 hover:bg-surface-container-high"
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
