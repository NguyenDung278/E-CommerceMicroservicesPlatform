"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { StorefrontImage } from "@/components/storefront-image";
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
import { useCartActions } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { productApi } from "@/lib/api/product";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import type { HomePageInitialData } from "@/lib/storefront/initial-data";
import { cn, fallbackImageForProduct } from "@/lib/utils";
import type { Product, ProductPopularity } from "@/types/api";
import { formatCurrency } from "@/utils/format";

type HomeState = {
  products: Product[];
  popularity: ProductPopularity[];
  isLoading: boolean;
  error: string;
};

const emptyHomeState: HomeState = {
  products: [],
  popularity: [],
  isLoading: true,
  error: "",
};

export function HomePage({ initialData }: { initialData?: HomePageInitialData }) {
  const { addItem } = useCartActions();
  const { isSaved, toggleWishlist } = useWishlist();
  const [busyProductId, setBusyProductId] = useState("");
  const [state, setState] = useState<HomeState>(() =>
    initialData
      ? {
          products: initialData.products,
          popularity: initialData.popularity,
          isLoading: false,
          error: initialData.error,
        }
      : emptyHomeState,
  );

  useEffect(() => {
    if (initialData) {
      return;
    }

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
  }, [initialData]);

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
  const calloutProduct = trendingProducts[0] ?? heroProduct;

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
            <StorefrontImage
              alt={heroProduct?.name || "Hero product"}
              src={
                heroProduct
                  ? heroProduct.image_urls[0] || heroProduct.image_url || fallbackImageForProduct(heroProduct.name)
                  : fallbackImageForProduct("Commerce Platform")
              }
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-55"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/72 to-primary/28" />

          <div className="shell relative grid min-h-[76svh] items-end gap-10 pb-20 pt-28 lg:grid-cols-12">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-7"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#efd7ce]">
                Bộ sưu tập mới
              </p>
              <h1 className="headline-display mt-6 max-w-4xl text-surface">
                Không gian mua sắm giàu nhịp điệu, bám backend thật.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-surface/84 md:text-xl">
                Catalog, giỏ hàng, checkout, tài khoản và lịch sử đơn hàng đều đồng bộ trực tiếp với product-service, user-service, order-service và payment-service hiện có trong repo.
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link href="/products" className={buttonStyles({ size: "lg" })}>
                  Khám phá catalog
                  <ArrowRight className="h-4 w-4" />
                </Link>
                {heroProduct ? (
                  <Link
                    href={`/products/${heroProduct.id}`}
                    className={cn(
                      buttonStyles({ variant: "secondary", size: "lg" }),
                      "border-white/20 bg-white/10 text-surface hover:bg-white/16 hover:text-surface",
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
              className="hidden border-l border-white/20 pb-2 pl-8 text-surface lg:col-span-4 lg:col-start-9 lg:block"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-surface/56">
                Lớp thông tin hệ thống
              </p>
              <div className="mt-5 grid gap-5">
                <div>
                  <p className="font-serif text-3xl italic leading-snug text-surface/88">
                    “Inventory đồng bộ theo thời gian thực cho từng sản phẩm active.”
                  </p>
                </div>
                <div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <span className="block font-serif text-3xl font-semibold tracking-[-0.03em]">{state.products.length}</span>
                      <span className="mt-2 block text-[11px] uppercase tracking-[0.24em] text-surface/58">Sản phẩm active</span>
                    </div>
                    <div>
                      <span className="block font-serif text-3xl font-semibold tracking-[-0.03em]">{categoryCards.length}</span>
                      <span className="mt-2 block text-[11px] uppercase tracking-[0.24em] text-surface/58">Nhóm danh mục</span>
                    </div>
                  </div>
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
            <div className="mt-10 grid gap-6 md:grid-cols-12 md:auto-rows-[260px] lg:h-[1120px] lg:auto-rows-auto">
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
                    className={cn("group relative overflow-hidden rounded-[1.25rem] bg-surface-container-low", layoutClass)}
                  >
                    <StorefrontImage
                      alt={product.category}
                      src={product.image_urls[0] || product.image_url || fallbackImageForProduct(product.category)}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className={cn("object-cover transition duration-700 group-hover:scale-[1.05]", index === 0 && "grayscale-[18%]")}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/72 to-transparent" />
                    <div className={cn("absolute inset-x-0 text-surface", index === 1 ? "top-0 p-8 md:p-10" : "bottom-0 p-7 md:p-9")}>
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

        <section className="bg-surface-container-low py-20 md:py-28">
          <div className="shell">
            <div className="grid items-center gap-12 md:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)] md:gap-20">
              <div>
                <p className="eyebrow">Tín hiệu nền tảng</p>
                <h2 className="headline-section mt-4 text-primary">
                  Chính xác ở backend, ấm và thoáng ở trải nghiệm.
                </h2>
                <p className="mt-6 max-w-xl text-lg leading-8 text-on-surface-variant">
                  Dữ liệu kho, giá và thanh toán chạy qua microservices thật, còn storefront giữ đúng tinh thần “digital atelier” bằng nhịp thở rộng, card tonal và typography editorial.
                </p>
                <div className="mt-10 grid grid-cols-2 gap-8">
                  <div>
                    <span className="block font-serif text-3xl font-semibold tracking-[-0.03em] text-tertiary">0 mock</span>
                    <span className="mt-2 block text-[11px] uppercase tracking-[0.24em] text-outline">Dữ liệu chính</span>
                  </div>
                  <div>
                    <span className="block font-serif text-3xl font-semibold tracking-[-0.03em] text-tertiary">
                      {heroProduct ? formatCurrency(heroProduct.price) : "N/A"}
                    </span>
                    <span className="mt-2 block text-[11px] uppercase tracking-[0.24em] text-outline">Hero live price</span>
                  </div>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-[1.25rem] shadow-editorial">
                <div className="relative aspect-[5/4] bg-surface-container-high">
                  <StorefrontImage
                    alt={calloutProduct?.name || "Feature"}
                    src={
                      calloutProduct
                        ? calloutProduct.image_urls[0] || calloutProduct.image_url || fallbackImageForProduct(calloutProduct.name)
                        : fallbackImageForProduct("Studio feature")
                    }
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover transition duration-1000 group-hover:scale-[1.08]"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-spacing overflow-hidden">
          <div className="shell mb-14 flex items-end justify-between gap-6">
            <div>
              <p className="eyebrow">New arrivals</p>
              <h2 className="headline-section mt-4 text-primary">Seasonal essentials</h2>
            </div>
            <Link href="/products" className={buttonStyles({ variant: "secondary" })}>
              Xem toàn bộ
            </Link>
          </div>

          <div className="no-scrollbar flex gap-6 overflow-x-auto px-4 sm:px-6 lg:px-10 xl:px-12">
            {trendingProducts.slice(0, 4).map((product) => (
              <div key={product.id} className="min-w-[280px] md:min-w-[360px]">
                <ProductCard
                  product={product}
                  saved={isSaved(product.id)}
                  footerSlot={
                    <button
                      type="button"
                      className="text-sm font-medium text-tertiary hover:text-tertiary-container"
                      onClick={() => toggleWishlist(product.id)}
                    >
                      {isSaved(product.id) ? "Đã lưu" : "Lưu lại"}
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
              </div>
            ))}
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
