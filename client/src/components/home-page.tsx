"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  EmptyState,
  InlineAlert,
  PageLinkCard,
  ProductCard,
  ProductCardAction,
  ProductCardSkeleton,
  SectionHeading,
} from "@/components/storefront-ui";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { productApi } from "@/lib/api/product";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import { cn, fallbackImageForProduct } from "@/lib/utils";
import type { Product, ProductPopularity } from "@/types/api";
import { formatCurrency } from "@/utils/format";

type HomeState = {
  products: Product[];
  popularity: ProductPopularity[];
  isLoading: boolean;
  error: string;
};

export function HomePage() {
  const { addItem } = useCart();
  const { isSaved, toggleWishlist } = useWishlist();
  const [busyProductId, setBusyProductId] = useState("");
  const [state, setState] = useState<HomeState>({
    products: [],
    popularity: [],
    isLoading: true,
    error: "",
  });

  useEffect(() => {
    let active = true;

    void Promise.all([
      productApi.listProducts({ status: "active", limit: 12 }),
      productApi.getProductPopularity(8).catch(() => ({ data: [] as ProductPopularity[] })),
    ])
      .then(([productResponse, popularityResponse]) => {
        if (!active) {
          return;
        }

        setState({
          products: productResponse.data,
          popularity: "data" in popularityResponse ? popularityResponse.data : [],
          isLoading: false,
          error: "",
        });
      })
      .catch((reason) => {
        if (!active) {
          return;
        }

        setState({
          products: [],
          popularity: [],
          isLoading: false,
          error: getErrorMessage(reason),
        });
      });

    return () => {
      active = false;
    };
  }, []);

  const heroProduct = state.products[0] ?? null;
  const categoryCards = useMemo(() => {
    const seen = new Set<string>();
    return state.products
      .filter((product) => {
        if (!product.category || seen.has(product.category)) {
          return false;
        }
        seen.add(product.category);
        return true;
      })
      .slice(0, 4);
  }, [state.products]);

  const trendingProducts = useMemo(() => {
    const popularityRank = new Map(
      state.popularity.map((item, index) => [item.product_id, item.quantity * 1000 - index]),
    );

    return state.products
      .slice()
      .sort((left, right) => (popularityRank.get(right.id) ?? 0) - (popularityRank.get(left.id) ?? 0))
      .slice(0, 6);
  }, [state.popularity, state.products]);

  async function handleAddToCart(product: Product) {
    try {
      setBusyProductId(product.id);
      await addItem({ product_id: product.id, quantity: 1 });
    } finally {
      setBusyProductId("");
    }
  }

  if (state.isLoading) {
    return (
      <>
        <SiteHeader />
        <main className="shell section-spacing grid gap-6 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden bg-primary-container">
          <div className="absolute inset-0">
            <img
              alt={heroProduct?.name || "Hero product"}
              src={
                heroProduct
                  ? heroProduct.image_urls[0] || heroProduct.image_url || fallbackImageForProduct(heroProduct.name)
                  : fallbackImageForProduct("Commerce Platform")
              }
              className="h-full w-full object-cover opacity-35"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-primary/88 via-primary/64 to-primary/34" />

          <div className="shell relative grid min-h-[82svh] items-end gap-10 pb-14 pt-24 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-20">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#efd7ce]">
                Storefront đồng bộ backend thật
              </p>
              <h1 className="headline-display mt-6 max-w-4xl text-surface">
                Mua sắm trên cùng dữ liệu thật của platform.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-surface/84 md:text-xl">
                Catalog, giỏ hàng, checkout, tài khoản và lịch sử đơn hàng đều đang map trực tiếp vào product-service, user-service, order-service và payment-service.
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link href="/products" className={buttonStyles({ size: "lg" })}>
                  Xem catalog
                  <ArrowRight className="h-4 w-4" />
                </Link>
                {heroProduct ? (
                  <Link
                    href={`/products/${heroProduct.id}`}
                    className={cn(
                      buttonStyles({ variant: "secondary", size: "lg" }),
                      "border-white/20 bg-white/8 text-surface hover:bg-white/14 hover:text-surface",
                    )}
                  >
                    Xem sản phẩm nổi bật
                  </Link>
                ) : null}
              </div>
            </motion.div>

            <motion.aside
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="rounded-[1.8rem] bg-white/10 p-6 text-surface shadow-editorial backdrop-blur-xl"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-surface/72">
                Snapshot dữ liệu
              </p>
              <div className="mt-6 grid gap-6">
                <div>
                  <p className="font-serif text-4xl font-semibold tracking-[-0.03em]">{state.products.length}</p>
                  <p className="mt-2 text-sm text-surface/76">sản phẩm đang hiển thị trên homepage</p>
                </div>
                <div>
                  <p className="font-serif text-4xl font-semibold tracking-[-0.03em]">{categoryCards.length}</p>
                  <p className="mt-2 text-sm text-surface/76">danh mục rút ra từ catalog active</p>
                </div>
                <div>
                  <p className="font-serif text-4xl font-semibold tracking-[-0.03em]">
                    {heroProduct ? formatCurrency(heroProduct.price) : "N/A"}
                  </p>
                  <p className="mt-2 text-sm text-surface/76">mức giá sản phẩm hero hiện tại</p>
                </div>
              </div>
            </motion.aside>
          </div>
        </section>

        <section className="shell section-spacing">
          {state.error ? <InlineAlert tone="error">{state.error}</InlineAlert> : null}

          <SectionHeading
            eyebrow="Danh mục"
            title="Cấu trúc trang bám theo Stitch nhưng nội dung đã được làm sạch cho bối cảnh thương mại điện tử thực tế."
            description="Các khối danh mục, listing và CTA được tối ưu lại để phản ánh inventory, giá, giỏ hàng và account flow thật của storefront."
          />

          {categoryCards.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                title="Catalog chưa có dữ liệu"
                description="Khi product-service có sản phẩm active, danh mục và khối nổi bật sẽ xuất hiện tại đây."
                action={
                  <Link href="/products" className={buttonStyles({ variant: "secondary" })}>
                    Tới catalog
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="mt-10 grid gap-5 md:grid-cols-12 md:auto-rows-[240px] lg:auto-rows-[300px]">
              {categoryCards.map((product, index) => {
                const layoutClass =
                  index === 0
                    ? "md:col-span-7"
                    : index === 1
                      ? "md:col-span-5 md:row-span-2"
                      : index === 2
                        ? "md:col-span-4"
                        : "md:col-span-3";

                return (
                  <Link
                    key={product.id}
                    href={`/categories/${encodeURIComponent(product.category)}`}
                    className={cn("group relative overflow-hidden rounded-[2rem] bg-surface-container-low", layoutClass)}
                  >
                    <img
                      alt={product.category}
                      src={product.image_urls[0] || product.image_url || fallbackImageForProduct(product.category)}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/72 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-7 text-surface md:p-9">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-surface/72">
                        {product.brand || "Commerce"}
                      </p>
                      <h3 className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
                        {product.category}
                      </h3>
                      <p className="mt-3 max-w-md text-sm leading-7 text-surface/80">
                        {product.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-surface-container-low py-16 md:py-24">
          <div className="shell">
            <SectionHeading
              eyebrow="Phần chính"
              title="Sản phẩm nổi bật lấy từ API thật, giữ nhịp thị giác của Stitch nhưng ưu tiên scan nhanh và CTA rõ."
              description="Các card dùng nền tonal layer, image zoom nhẹ, headline serif và CTA rõ ràng hơn để phù hợp với trải nghiệm mua hàng thật."
              action={
                <Link href="/products" className={buttonStyles({ variant: "secondary" })}>
                  Xem toàn bộ catalog
                </Link>
              }
            />

            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {trendingProducts.slice(0, 6).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  saved={isSaved(product.id)}
                  footerSlot={
                    <button
                      type="button"
                      className="text-sm font-medium text-tertiary hover:text-tertiary-container"
                      onClick={() => toggleWishlist(product.id)}
                    >
                      {isSaved(product.id) ? "Bỏ khỏi yêu thích" : "Lưu yêu thích"}
                    </button>
                  }
                  actionSlot={
                    <ProductCardAction
                      onClick={() => void handleAddToCart(product)}
                      disabled={product.stock <= 0}
                      loading={busyProductId === product.id}
                    />
                  }
                />
              ))}
            </div>
          </div>
        </section>

        <section className="shell section-spacing">
          <SectionHeading
            eyebrow="Toàn bộ flow"
            title="Từ tìm kiếm đến thanh toán, mọi màn chính giờ đã bám cùng một design system và một nguồn dữ liệu."
            description="Những route dưới đây khớp với kiến trúc frontend cũ của repo nhưng được dựng lại bằng Next.js App Router."
          />

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <PageLinkCard href="/products" title="Catalog" copy="Tìm kiếm, lọc, sắp xếp, kéo thả vào giỏ hoặc yêu thích." badge="Search + DnD" />
            <PageLinkCard href="/checkout" title="Checkout" copy="Chọn địa chỉ, phương thức giao hàng và xử lý thanh toán thực với payment-service." badge="Orders + Payments" />
            <PageLinkCard href="/profile" title="Tài khoản" copy="Hồ sơ, địa chỉ, lịch sử đơn hàng, thanh toán, bảo mật và thông báo." badge="Trung tâm tài khoản" />
            <PageLinkCard href="/login" title="Xác thực" copy="Đăng nhập, đăng ký, quên mật khẩu, xác minh email và xử lý OAuth." badge="Luồng xác thực" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
