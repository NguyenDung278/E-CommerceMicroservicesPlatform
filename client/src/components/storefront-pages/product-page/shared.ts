"use client";

import { productApi } from "@/lib/api/product";
import { isHttpError } from "@/lib/errors/handler";
import type {
  Product,
  ProductReview,
  ProductReviewList,
  ProductReviewSummary,
  ProductVariant,
} from "@/types/api";

export type ReviewFormState = {
  rating: number;
  comment: string;
};

export type ProductPageBusyState = "" | "cart" | "review" | "delete-review";

const emptyReviewSummary: ProductReviewSummary = {
  average_rating: 0,
  review_count: 0,
  rating_breakdown: { one: 0, two: 0, three: 0, four: 0, five: 0 },
};

export const emptyReviewList: ProductReviewList = {
  summary: emptyReviewSummary,
  items: [],
};

export function getDefaultVariant(product: Product) {
  return product.variants.find((variant) => variant.stock > 0) ?? product.variants[0] ?? null;
}

export function getSelectedVariant(product: Product | null, selectedVariantSku: string): ProductVariant | null {
  if (!product) {
    return null;
  }

  return (
    product.variants.find((variant) => variant.sku === selectedVariantSku) ??
    getDefaultVariant(product) ??
    null
  );
}

export async function getMyProductReviewOrNull(token: string, productId: string): Promise<ProductReview | null> {
  return productApi
    .getMyProductReview(token, productId)
    .then((response) => response.data)
    .catch((reason) => {
      if (isHttpError(reason) && reason.status === 404) {
        return null;
      }

      throw reason;
    });
}
