"use client";

import Link from "next/link";

import {
  SectionHeading,
} from "@/components/storefront-shared/storefront-ui";
import { StorefrontImage } from "@/components/storefront-shared/storefront-image";
import { buttonStyles } from "@/lib/button-styles";
import { fallbackImageForProduct, getProductImages } from "@/lib/utils";
import type { Product } from "@/types/api";
import { formatCurrency } from "@/utils/format";

type RelatedProductsSectionProps = {
  isSaved: (productId: string) => boolean;
  onViewProduct: (productId: string) => void;
  relatedProducts: Product[];
};

export function RelatedProductsSection({
  isSaved,
  onViewProduct,
  relatedProducts,
}: RelatedProductsSectionProps) {
  return (
    <section className="detail-look-section">
      <SectionHeading
        eyebrow="Khám phá thêm"
        title="Những lựa chọn đi cùng cùng nhịp."
        description="Các sản phẩm liên quan vẫn đi từ catalog thật, nhưng surface này được dựng lại theo kiểu editorial card của storefront thời trang lớn."
      />
      {relatedProducts.length === 0 ? (
        <div className="detail-review-empty">
          <span>Chưa có gợi ý bổ sung</span>
          <p>Khi catalog có thêm sản phẩm cùng nhịp, khu vực này sẽ tự mở rộng.</p>
        </div>
      ) : (
        <div className="detail-look-grid">
          {relatedProducts.map((item) => {
            const previewImage =
              getProductImages(item.image_url, item.image_urls)[0] ||
              fallbackImageForProduct(item.name);

            return (
              <article key={item.id} className="detail-look-card group">
                <Link
                  href={`/products/${item.id}`}
                  onClick={() => onViewProduct(item.id)}
                >
                  <div className="detail-look-media relative">
                    <StorefrontImage
                      alt={item.name}
                      src={previewImage}
                      fill
                      sizes="(min-width: 1280px) 22vw, (min-width: 768px) 44vw, 92vw"
                      className="object-cover transition duration-700 group-hover:scale-[1.04]"
                    />
                  </div>
                </Link>
                <div className="detail-look-copy">
                  <span>
                    {item.category || item.brand || "Gợi ý cùng nhịp"}
                    {isSaved(item.id) ? " • Đã lưu" : ""}
                  </span>
                  <strong>{item.name}</strong>
                  <span>{formatCurrency(item.price)}</span>
                </div>
                <button
                  type="button"
                  className={buttonStyles({ variant: "secondary" })}
                  onClick={() => onViewProduct(item.id)}
                >
                  Xem sản phẩm
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
