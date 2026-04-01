import { productApi } from "@/lib/api/product";
import {
  peekCachedResource,
  readCachedResource,
  writeCachedResource,
} from "@/lib/resources/cache";
import type { Product } from "@/types/api";

const PRODUCT_RESOURCE_TTL_MS = 20_000;

function productResourceKey(productId: string) {
  return `product:${productId}`;
}

function cacheProduct(product: Product) {
  writeCachedResource(productResourceKey(product.id), product, {
    ttlMs: PRODUCT_RESOURCE_TTL_MS,
  });
}

export function peekProductResource(productId: string) {
  return peekCachedResource<Product>(productResourceKey(productId));
}

export async function readProductResource(
  productId: string,
  options?: { forceRefresh?: boolean },
) {
  return readCachedResource(
    productResourceKey(productId),
    async () => {
      const response = await productApi.getProductById(productId);
      return response.data;
    },
    {
      ttlMs: PRODUCT_RESOURCE_TTL_MS,
      forceRefresh: options?.forceRefresh,
    },
  );
}

export async function readProductLookupResource(productIds: string[]) {
  const uniqueProductIds = Array.from(new Set(productIds.filter(Boolean)));
  if (uniqueProductIds.length === 0) {
    return {};
  }

  const productLookup: Record<string, Product> = {};
  const missingProductIds: string[] = [];

  uniqueProductIds.forEach((productId) => {
    const cachedProduct = peekProductResource(productId);
    if (cachedProduct) {
      productLookup[productId] = cachedProduct;
      return;
    }

    missingProductIds.push(productId);
  });

  if (missingProductIds.length > 0) {
    try {
      const response = await productApi.getProductsByIds(missingProductIds);
      response.data.forEach((product) => {
        cacheProduct(product);
        productLookup[product.id] = product;
      });
    } catch {
      const results = await Promise.allSettled(
        missingProductIds.map(async (productId) => [productId, await readProductResource(productId)] as const),
      );

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          const [productId, product] = result.value;
          productLookup[productId] = product;
        }
      });
    }
  }

  return Object.fromEntries(
    uniqueProductIds
      .map((productId) => [productId, productLookup[productId]] as const)
      .filter((entry): entry is [string, Product] => Boolean(entry[1])),
  );
}

export async function readProductListResource(productIds: string[]) {
  const productLookup = await readProductLookupResource(productIds);

  return productIds
    .map((productId) => productLookup[productId])
    .filter((product): product is Product => Boolean(product));
}
