"use client";

import { ProductCard, ProductCardAction, SectionHeading } from "@/components/storefront-ui";
import type { Product } from "@/types/api";

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
    <section>
      <SectionHeading
        eyebrow="Liên quan"
        title="Sản phẩm cùng category"
        description="Dùng tiếp dữ liệu thật từ catalog để giúp người dùng khám phá thêm."
      />
      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {relatedProducts.map((item) => (
          <ProductCard
            key={item.id}
            product={item}
            saved={isSaved(item.id)}
            actionSlot={
              <ProductCardAction onClick={() => onViewProduct(item.id)} label="Xem sản phẩm" />
            }
          />
        ))}
      </div>
    </section>
  );
}
