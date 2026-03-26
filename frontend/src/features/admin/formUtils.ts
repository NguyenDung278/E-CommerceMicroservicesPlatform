import type { ProductVariant } from "../../types/api";
import { sanitizeText, sanitizeUrl, toPositiveFloat } from "../../utils/sanitize";

export type VariantFormRow = {
  id: string;
  label: string;
  sku: string;
  size: string;
  color: string;
  price: string;
  stock: string;
};

export type ProductFormState = {
  name: string;
  description: string;
  price: string;
  stock: string;
  category: string;
  brand: string;
  status: string;
  sku: string;
  tags: string;
  imageUrls: string[];
  manualImageUrl: string;
  variants: VariantFormRow[];
};

export type CouponFormState = {
  code: string;
  description: string;
  discountType: "fixed" | "percentage";
  discountValue: string;
  minOrderAmount: string;
  usageLimit: string;
  expiresAt: string;
  active: boolean;
};

export const productStatusOptions = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "inactive", label: "Inactive" },
] as const;

export const reportWindowOptions = [7, 30, 90] as const;

const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function createRowId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `variant-${crypto.randomUUID()}`;
  }

  return `variant-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyVariant(): VariantFormRow {
  return {
    id: createRowId(),
    label: "",
    sku: "",
    size: "",
    color: "",
    price: "",
    stock: "0",
  };
}

export function createDefaultProductForm(): ProductFormState {
  return {
    name: "",
    description: "",
    price: "",
    stock: "0",
    category: "",
    brand: "",
    status: "active",
    sku: "",
    tags: "",
    imageUrls: [],
    manualImageUrl: "",
    variants: [],
  };
}

export function createDefaultCouponForm(): CouponFormState {
  return {
    code: "",
    description: "",
    discountType: "percentage",
    discountValue: "",
    minOrderAmount: "0",
    usageLimit: "0",
    expiresAt: "",
    active: true,
  };
}

export function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => sanitizeText(tag).toLowerCase())
    .filter(Boolean);
}

export function parseVariantRows(rows: VariantFormRow[]) {
  const errors: string[] = [];

  const variants = rows
    .filter((row) => row.label || row.sku || row.price || row.stock)
    .map((row, index) => {
      const price = toPositiveFloat(row.price);
      const stock = Number.parseInt(row.stock, 10);
      const label = sanitizeText(row.label);
      const sku = sanitizeText(row.sku);

      if (!label || !sku || price <= 0 || stock < 0 || Number.isNaN(stock)) {
        errors.push(`Biến thể #${index + 1} cần đủ tên, SKU, giá > 0 và tồn kho >= 0.`);
      }

      return {
        label,
        sku,
        size: sanitizeText(row.size),
        color: sanitizeText(row.color),
        price,
        stock: Number.isNaN(stock) ? 0 : stock,
      } satisfies ProductVariant;
    });

  return { variants, errors };
}

export function toVariantFormRow(variant: ProductVariant): VariantFormRow {
  return {
    id: `variant-${variant.sku}`,
    label: variant.label,
    sku: variant.sku,
    size: variant.size ?? "",
    color: variant.color ?? "",
    price: String(variant.price),
    stock: String(variant.stock),
  };
}

export function toOptionalIsoDateTime(value: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

export function normalizeProductImageUrls(urls: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  urls.forEach((imageUrl) => {
    const sanitized = sanitizeUrl(imageUrl);
    if (!sanitized || seen.has(sanitized)) {
      return;
    }

    seen.add(sanitized);
    normalized.push(sanitized);
  });

  return normalized;
}

export function mergeImageUrls(current: string[], incoming: string[]) {
  return normalizeProductImageUrls([...current, ...incoming]);
}

export function validateSelectedImageFiles(files: File[]) {
  const errors: string[] = [];
  const accepted: File[] = [];

  files.forEach((file) => {
    if (!file.type.startsWith("image/")) {
      errors.push(`${file.name} không phải file ảnh hợp lệ.`);
      return;
    }

    if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
      errors.push(`${file.name} vượt quá giới hạn 5MB mỗi file.`);
      return;
    }

    accepted.push(file);
  });

  return {
    files: accepted,
    errors,
  };
}
