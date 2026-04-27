"use client";

import type { ReactNode } from "react";

import { cn, fallbackImageForProduct } from "@/lib/utils";
import type { CreateProductData } from "@/lib/api/product";
import type { Order, Product } from "@/types/api";
import { formatStatusLabel, formatTime } from "@/utils/format";

export type ProductStatus = "draft" | "active" | "inactive";

export type ProductFormState = {
  name: string;
  description: string;
  price: string;
  stock: string;
  category: string;
  sku: string;
  status: ProductStatus;
  imageUrl: string;
};

export const reportWindows = [7, 30, 90] as const;
export const productStatuses: ProductStatus[] = ["draft", "active", "inactive"];
export const orderStatusFilters = [
  { value: "all", label: "Tất cả đơn" },
  { value: "pending", label: "Chờ xử lý" },
  { value: "paid", label: "Đã thanh toán" },
  { value: "shipped", label: "Đang giao" },
  { value: "delivered", label: "Đã giao" },
  { value: "cancelled", label: "Đã hủy" },
];

export const emptyProductForm: ProductFormState = {
  name: "",
  description: "",
  price: "",
  stock: "0",
  category: "",
  sku: "",
  status: "active",
  imageUrl: "",
};

export const inputClassName = "commerce-input";
export const labelClassName = "grid gap-2 text-sm font-medium text-on-surface";

export function getProductImage(product: Product) {
  return product.image_urls[0] || product.image_url || fallbackImageForProduct(product.name);
}

export function dedupeProducts(products: Product[]) {
  return Array.from(new Map(products.map((product) => [product.id, product])).values()).sort(
    (left, right) => right.updated_at.localeCompare(left.updated_at),
  );
}

export function productToForm(product: Product): ProductFormState {
  return {
    name: product.name,
    description: product.description,
    price: String(product.price),
    stock: String(product.stock),
    category: product.category,
    sku: product.sku,
    status: productStatuses.includes(product.status as ProductStatus)
      ? (product.status as ProductStatus)
      : "draft",
    imageUrl: product.image_url || product.image_urls[0] || "",
  };
}

export function buildProductPayload(form: ProductFormState): CreateProductData {
  const name = form.name.trim();
  const price = Number(form.price);
  const stock = Number.parseInt(form.stock, 10);
  const imageUrl = form.imageUrl.trim();

  if (!name) {
    throw new Error("Tên sản phẩm là bắt buộc.");
  }
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Giá sản phẩm phải lớn hơn 0.");
  }
  if (!Number.isInteger(stock) || stock < 0) {
    throw new Error("Tồn kho phải là số nguyên không âm.");
  }

  return {
    name,
    description: form.description.trim(),
    price,
    stock,
    category: form.category.trim(),
    brand: "",
    tags: [],
    status: form.status,
    sku: form.sku.trim(),
    variants: [],
    image_url: imageUrl,
    image_urls: imageUrl ? [imageUrl] : [],
  };
}

export function formatSyncLabel(value: Date | null) {
  return value ? formatTime(value) : "Chưa đồng bộ";
}

export function canCancelOrder(order: Order) {
  const normalized = order.status.trim().toLowerCase();
  return !["cancelled", "delivered", "completed", "refunded"].includes(normalized);
}

export function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const className =
    normalized.includes("cancel") || normalized.includes("inactive")
      ? "bg-[#fef3f2] text-error"
      : normalized.includes("pending") || normalized.includes("draft")
        ? "bg-[#fffaeb] text-[#b54708]"
        : "bg-[#ecfdf3] text-tertiary";

  return (
    <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", className)}>
      {formatStatusLabel(status)}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: string | number;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="metric-tile">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-on-surface-variant">{label}</span>
        <span className="text-primary">{icon}</span>
      </div>
      <strong className="mt-3 block text-2xl font-semibold text-on-surface">{value}</strong>
      <p className="mt-2 text-sm text-on-surface-variant">{description}</p>
    </div>
  );
}
