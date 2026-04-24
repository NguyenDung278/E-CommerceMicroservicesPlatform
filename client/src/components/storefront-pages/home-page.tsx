"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { StorefrontImage } from "@/components/storefront-shared/storefront-image";
import {
  RecoveredEditorialFooter,
  RecoveredStorefrontHeader,
} from "@/components/storefront-shared/recovered-storefront-chrome";
import {
  EmptyState,
  InlineAlert,
  PageLinkCard,
  ProductCard,
  ProductCardAction,
  ProductCardSkeleton,
  SectionHeading,
} from "@/components/storefront-shared/storefront-ui";
import { useAuthState } from "@/hooks/useAuth";
import { useCartActions } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { productApi } from "@/lib/api/product";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import type { HomePageInitialData } from "@/lib/storefront/initial-data";
import { cn, fallbackImageForProduct } from "@/lib/utils";
import { getAtelierPageConfig } from "@/components/storefront-pages/editorial/atelier-page-data";
import type { Product, ProductPopularity, StorefrontCategory } from "@/types/api";
import { formatCurrency } from "@/utils/format";

type HomeState = {
  products: Product[];
  popularity: ProductPopularity[];
  categories: StorefrontCategory[];
  isLoading: boolean;
  error: string;
};

const emptyHomeState: HomeState = {
  products: [],
  popularity: [],
  categories: [],
  isLoading: true,
  error: "",
};

type HomeAtelierEntry = {
  key: string;
  label: string;
  heroTitle: string;
  archiveHref: string;
  editorialHref: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  filterPreview: string[];
  layoutClassName: string;
};

const homeAtelierCategoryInputs = [
  {
    key: "men",
    identifier: "Shop Men",
    archiveHref: "/categories/Shop%20Men",
    editorialHref: "/editorial/Shop%20Men",
    layoutClassName: "home-atelier-card-men",
  },
  {
    key: "women",
    identifier: "Shop Women",
    archiveHref: "/categories/Shop%20Women",
    editorialHref: "/editorial/Shop%20Women",
    layoutClassName: "home-atelier-card-women",
  },
  {
    key: "footwear",
    identifier: "Footwear",
    archiveHref: "/categories/Footwear",
    editorialHref: "/editorial/Footwear",
    layoutClassName: "home-atelier-card-footwear",
  },
  {
    key: "accessories",
    identifier: "Accessories",
    archiveHref: "/categories/Accessories",
    editorialHref: "/editorial/Accessories",
    layoutClassName: "home-atelier-card-accessories",
  },
] as const;

function buildEditorialIdentifier(category: StorefrontCategory) {
  return category.aliases[0] || category.display_name || category.slug;
}

function buildCategoryHref(category: StorefrontCategory) {
  return `/categories/${encodeURIComponent(category.display_name || category.nav_label || category.slug)}`;
}

function buildEditorialHref(category: StorefrontCategory) {
  return `/editorial/${encodeURIComponent(buildEditorialIdentifier(category))}`;
}

function normalizeAtelierLabel(value: string) {
  return value.trim().toLowerCase();
}

function readAtelierHeroTitle(categoryName: string) {
  const config = getAtelierPageConfig(categoryName);
  return config ? config.hero.titleLines.map((line) => line.text).join(" ") : categoryName;
}

function readAtelierFilterPreview(categoryName: string) {
  const config = getAtelierPageConfig(categoryName);

  if (!config) {
    return [];
  }

  return config.filters
    .map((group) => {
      switch (group.kind) {
        case "list":
        case "sizes":
        case "checkboxes":
          return group.options.find((option) => option.active)?.label || group.options[0]?.label || "";
        case "palette":
          return group.options.find((option) => option.active)?.label || group.options[0]?.label || "";
        case "chips":
          return group.options[0] || "";
        case "price":
          return group.maxLabel;
        case "quote-card":
          return group.attribution;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .slice(0, 3);
}

export function HomePage({ initialData }: { initialData?: HomePageInitialData }) {
  const { isAuthenticated } = useAuthState();
  const { addItem } = useCartActions();
  const { isSaved, toggleWishlist } = useWishlist();
  const [busyProductId, setBusyProductId] = useState("");
  const [state, setState] = useState<HomeState>(() =>
    initialData
      ? {
          products: initialData.products,
          popularity: initialData.popularity,
          categories: initialData.categories,
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
          categories: [],
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
          categories: [],
          isLoading: false,
          error: getErrorMessage(reason),
        });
      });

    return () => {
      active = false;
    };
  }, [initialData]);

  const heroProduct = state.products[0] ?? null;

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
  const atelierDestinations = useMemo<HomeAtelierEntry[]>(() => {
    return homeAtelierCategoryInputs.reduce<HomeAtelierEntry[]>((entries, entry) => {
      const config = getAtelierPageConfig(entry.identifier);

      if (!config) {
        return entries;
      }

      const matchedCategory = state.categories.find((category) => {
        const categoryLabels = [
          category.slug,
          category.display_name,
          category.nav_label,
          ...category.aliases,
        ].map((value) => normalizeAtelierLabel(value));

        return (
          categoryLabels.includes(normalizeAtelierLabel(entry.identifier)) ||
          categoryLabels.includes(normalizeAtelierLabel(config.navLabel))
        );
      });

      entries.push({
        key: entry.key,
        label: config.navLabel,
        heroTitle: readAtelierHeroTitle(entry.identifier),
        archiveHref: matchedCategory ? buildCategoryHref(matchedCategory) : entry.archiveHref,
        editorialHref: matchedCategory
          ? buildEditorialHref(matchedCategory)
          : entry.editorialHref,
        description: config.hero.description,
        imageUrl: config.hero.imageUrl,
        imageAlt: config.hero.imageAlt,
        filterPreview: readAtelierFilterPreview(entry.identifier),
        layoutClassName: entry.layoutClassName,
      });

      return entries;
    }, []);
  }, [state.categories]);

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
        <main>
          <section className="relative overflow-hidden bg-primary-container">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/72 to-primary/28" />
            <div className="shell relative flex min-h-[36svh] flex-col gap-10 pb-16 pt-8">
              <RecoveredStorefrontHeader navigation="core" />
              <div className="mt-auto grid gap-6 md:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <ProductCardSkeleton key={index} />
                ))}
              </div>
            </div>
          </section>
          <section className="shell pb-12">
            <RecoveredEditorialFooter />
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <main>
        <section className="relative overflow-hidden bg-primary-container">
          <div className="absolute inset-0">
            <StorefrontImage
              alt={heroProduct?.name || "Hero product"}
              src={
                heroProduct
                  ? heroProduct.image_urls[0] || heroProduct.image_url || fallbackImageForProduct(heroProduct.name)
                  : fallbackImageForProduct("ND Shop")
              }
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-55"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/72 to-primary/28" />

          <div className="shell relative flex min-h-[76svh] flex-col gap-10 pb-20 pt-8">
            <RecoveredStorefrontHeader navigation="core" />

            <div className="mt-auto grid items-end gap-10 lg:grid-cols-12">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-7"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#efd7ce]">
                ND Shop
              </p>
              <h1 className="headline-display mt-6 max-w-4xl text-surface">
                Đăng ký, chọn sản phẩm và mua sắm trên storefront thật.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-surface/84 md:text-xl">
                ND Shop là nơi để bạn khám phá sản phẩm mới, lưu món yêu thích, thanh toán gọn và
                quay lại theo dõi đơn hàng trong cùng một trải nghiệm mua sắm.
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link href="/products" className={buttonStyles({ size: "lg" })}>
                  Mua sản phẩm
                  <ArrowRight className="h-4 w-4" />
                </Link>
                {!isAuthenticated ? (
                  <Link
                    href="/register"
                    className={cn(
                      buttonStyles({ variant: "secondary", size: "lg" }),
                      "border-white/20 bg-white/10 text-surface hover:bg-white/16 hover:text-surface",
                    )}
                  >
                    Tạo tài khoản ND Shop
                  </Link>
                ) : heroProduct ? (
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
                Điểm nhấn hôm nay
              </p>
              <div className="mt-5 grid gap-5">
                <div>
                  <p className="font-serif text-3xl italic leading-snug text-surface/88">
                    “Mua sắm gọn hơn khi mọi thứ đều ở đúng chỗ: sản phẩm, yêu thích và thanh toán.”
                  </p>
                </div>
                <div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <span className="block font-serif text-3xl font-semibold tracking-[-0.03em]">{state.products.length}</span>
                      <span className="mt-2 block text-[11px] uppercase tracking-[0.24em] text-surface/58">Sản phẩm đang bán</span>
                    </div>
                    <div>
                      <span className="block font-serif text-3xl font-semibold tracking-[-0.03em]">
                        {atelierDestinations.length + 1}
                      </span>
                      <span className="mt-2 block text-[11px] uppercase tracking-[0.24em] text-surface/58">Lối mua sắm</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.aside>
            </div>
          </div>
        </section>

        <section className="shell section-spacing">
          <SectionHeading
            eyebrow="Hành trình mua hàng"
            title="ND Shop tách riêng cho khách mua, từ đăng ký đến thanh toán."
            description="Giao diện shopper được chia rõ với ND Admin. Người dùng có thể tạo tài khoản, chọn sản phẩm, thanh toán và quay lại xem lịch sử đơn hàng mà không bị lẫn với màn vận hành nội bộ."
          />

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "1. Tạo tài khoản",
                description:
                  "Đăng ký nhanh để lưu địa chỉ, món yêu thích và quay lại mua sắm thuận tiện hơn.",
                href: isAuthenticated ? "/profile" : "/register",
                cta: isAuthenticated ? "Mở hồ sơ" : "Đăng ký ngay",
              },
              {
                title: "2. Chọn sản phẩm",
                description:
                  "Xem danh mục, so sánh giá, lưu món yêu thích rồi thêm vào giỏ khi đã sẵn sàng.",
                href: "/products",
                cta: "Xem sản phẩm",
              },
              {
                title: "3. Thanh toán và theo dõi",
                description:
                  "Chốt đơn nhanh, xem lại lịch sử mua sắm và theo dõi tình trạng giao hàng dễ dàng.",
                href: isAuthenticated ? "/myorders" : "/login?redirect=%2Fmyorders",
                cta: "Theo dõi đơn hàng",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="rounded-[1.75rem] border border-outline-variant/25 bg-surface p-6 shadow-editorial"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-tertiary">
                  ND Shop
                </p>
                <h3 className="mt-4 font-serif text-[2rem] font-semibold tracking-[-0.03em] text-primary">
                  {item.title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-on-surface-variant">{item.description}</p>
                <Link href={item.href} className={cn(buttonStyles({ variant: "secondary" }), "mt-6")}>
                  {item.cta}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="shell section-spacing">
          {state.error ? <InlineAlert tone="error">{state.error}</InlineAlert> : null}

          <SectionHeading
            eyebrow="Danh mục nổi bật"
            title="All Archive, Men, Women, Footwear, Accessories."
            description="Chọn nhanh lối mua sắm phù hợp với bạn, từ toàn bộ sản phẩm đến từng nhóm chính được ghé nhiều nhất."
          />

          <div className="home-archive-gateway mt-10">
            <article className="home-archive-gateway-surface">
              <div className="home-archive-gateway-copy">
                <p className="home-archive-kicker">All Archive</p>
                <h3 className="home-archive-title">Toàn bộ sản phẩm nổi bật</h3>
                <p className="home-archive-description">
                  Bắt đầu từ All Archive để xem toàn bộ sản phẩm đang có, rồi đi tiếp sang Men,
                  Women, Footwear hoặc Accessories khi bạn muốn mua sắm sâu hơn theo từng nhóm.
                </p>
              </div>

              <div className="home-archive-gateway-stats">
                <div>
                  <span>{state.products.length}</span>
                  <small>Sản phẩm đang bán</small>
                </div>
                <div>
                  <span>{atelierDestinations.length}</span>
                  <small>Danh mục chính</small>
                </div>
                <div>
                  <span>{state.popularity.length || 0}</span>
                  <small>Gợi ý nổi bật</small>
                </div>
              </div>

              <div className="home-archive-gateway-actions">
                <Link href="/products" className={buttonStyles({ size: "lg" })}>
                  Mở All Archive
                </Link>
                <Link
                  href="/editorial/Shop%20Men"
                  className={buttonStyles({ variant: "secondary", size: "lg" })}
                >
                  Xem Men
                </Link>
              </div>
            </article>

            {atelierDestinations.length > 0 ? (
              <div className="home-atelier-grid">
                {atelierDestinations.map((entry) => (
                  <article
                    key={entry.key}
                    className={cn(
                      "home-atelier-card group relative overflow-hidden rounded-[1.5rem]",
                      entry.layoutClassName,
                    )}
                  >
                    <StorefrontImage
                      alt={entry.imageAlt}
                      src={entry.imageUrl}
                      fill
                      sizes="(min-width: 1280px) 32vw, (min-width: 768px) 48vw, 100vw"
                      className="home-atelier-card-image object-cover transition duration-700 group-hover:scale-[1.05]"
                    />
                    <div className="home-atelier-card-overlay" />
                    <div className="home-atelier-card-copy">
                      <p className="home-atelier-card-kicker">{entry.label}</p>
                      <h3 className="home-atelier-card-title">{entry.heroTitle}</h3>
                      <p className="home-atelier-card-description">{entry.description}</p>

                      {entry.filterPreview.length > 0 ? (
                        <div className="home-atelier-chip-row">
                          {entry.filterPreview.map((chip) => (
                            <span key={`${entry.key}-${chip}`} className="home-atelier-chip">
                              {chip}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="home-atelier-card-actions">
                        <Link href={entry.archiveHref} className="home-atelier-link">
                          Xem sản phẩm
                        </Link>
                        <Link href={entry.editorialHref} className="home-atelier-link">
                          Xem nổi bật
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-8">
                <EmptyState
                  title="Danh mục đang được cập nhật"
                  description="Khi dữ liệu sản phẩm đầy đủ hơn, khu vực này sẽ tự hiện thêm các lối vào mua sắm tương ứng."
                />
              </div>
            )}
          </div>
        </section>

        <section className="bg-surface-container-low py-20 md:py-28">
          <div className="shell">
            <div className="grid items-center gap-12 md:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)] md:gap-20">
              <div>
                <p className="eyebrow">Mua sắm dễ hơn</p>
                <h2 className="headline-section mt-4 text-primary">
                  Chọn nhanh, lưu gọn, quay lại vẫn tiện.
                </h2>
                <p className="mt-6 max-w-xl text-lg leading-8 text-on-surface-variant">
                  Từ lần ghé đầu tiên đến khi quay lại mua tiếp, mọi khu vực chính đều được giữ nhịp rõ ràng để bạn xem hàng, thanh toán và theo dõi đơn thuận tiện hơn.
                </p>
                <div className="mt-10 grid grid-cols-2 gap-8">
                  <div>
                    <span className="block font-serif text-3xl font-semibold tracking-[-0.03em] text-tertiary">
                      {atelierDestinations.length + 1}
                    </span>
                    <span className="mt-2 block text-[11px] uppercase tracking-[0.24em] text-outline">Lối mua sắm</span>
                  </div>
                  <div>
                    <span className="block font-serif text-3xl font-semibold tracking-[-0.03em] text-tertiary">
                      {heroProduct ? formatCurrency(heroProduct.price) : "N/A"}
                    </span>
                    <span className="mt-2 block text-[11px] uppercase tracking-[0.24em] text-outline">Giá nổi bật</span>
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
            eyebrow="Lối vào mua sắm"
            title="Mọi điểm chạm chính đã được gom lại gọn hơn."
            description="Đi thẳng tới những nơi bạn dùng nhiều nhất trong trải nghiệm mua sắm hằng ngày."
          />

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <PageLinkCard href="/products" title="Sản phẩm" copy="Tìm kiếm, lọc, sắp xếp và lưu nhanh những món muốn mua." badge="Danh mục" />
            <PageLinkCard href="/checkout" title="Thanh toán" copy="Chọn địa chỉ, phương thức giao hàng và hoàn tất đơn hàng trong vài bước." badge="Đơn hàng" />
            <PageLinkCard href="/profile" title="Tài khoản" copy="Hồ sơ, địa chỉ, lịch sử đơn hàng, thanh toán, bảo mật và thông báo." badge="Trung tâm tài khoản" />
            <PageLinkCard href="/login" title="Đăng nhập" copy="Vào lại tài khoản để tiếp tục mua sắm, xem đơn hàng và danh sách đã lưu." badge="Tài khoản" />
          </div>
        </section>
        <section className="shell pb-12">
          <RecoveredEditorialFooter />
        </section>
      </main>
    </>
  );
}
