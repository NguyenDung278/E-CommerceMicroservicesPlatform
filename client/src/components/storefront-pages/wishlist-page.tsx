"use client";

import Link from "next/link";
import { Heart, RefreshCw, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  RecoveredEditorialFooter,
  RecoveredStorefrontHeader,
} from "@/components/storefront-shared/recovered-storefront-chrome";
import { StorefrontImage } from "@/components/storefront-shared/storefront-image";
import {
  EmptyState,
  InlineAlert,
  LoadingScreen,
  SurfaceCard,
} from "@/components/storefront-shared/storefront-ui";
import { useAuthState } from "@/hooks/useAuth";
import { useCartActions } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import { readProductListResource } from "@/lib/resources/product-resources";
import { cn, fallbackImageForProduct } from "@/lib/utils";
import type { Product } from "@/types/api";
import { formatCurrency } from "@/utils/format";

function getInventoryLabel(product: Product) {
  if (product.stock <= 0) {
    return "Tam het hang";
  }

  if (product.stock <= 5) {
    return `Sap het hang - con ${product.stock}`;
  }

  return `San sang giao ngay - con ${product.stock}`;
}

function getInventoryTone(product: Product) {
  if (product.stock <= 0) {
    return "bg-[#fde4e1] text-[#8c2619]";
  }

  if (product.stock <= 5) {
    return "bg-[#f8edd2] text-[#865d19]";
  }

  return "bg-[#ddebe1] text-[#254f34]";
}

export function WishlistPage() {
  const { isAuthenticated } = useAuthState();
  const { addItem } = useCartActions();
  const {
    wishlist,
    wishlistCount,
    isLoading,
    error,
    toggleWishlist,
    clearWishlist,
    refreshWishlist,
  } = useWishlist();
  const [savedProducts, setSavedProducts] = useState<Product[]>([]);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "info" | "error";
    message: string;
  } | null>(null);
  const [busyProductId, setBusyProductId] = useState("");
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isRefreshingWishlist, setIsRefreshingWishlist] = useState(false);
  const [isClearingWishlist, setIsClearingWishlist] = useState(false);

  useEffect(() => {
    let active = true;

    if (wishlist.length === 0) {
      setSavedProducts([]);
      setIsLoadingProducts(false);
      return () => {
        active = false;
      };
    }

    setIsLoadingProducts(true);

    void readProductListResource(wishlist)
      .then((products) => {
        if (!active) {
          return;
        }

        setSavedProducts(products);
      })
      .catch((reason) => {
        if (active) {
          setFeedback({
            tone: "error",
            message: getErrorMessage(reason),
          });
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingProducts(false);
        }
      });

    return () => {
      active = false;
    };
  }, [wishlist]);

  const savedProductLookup = useMemo(
    () => Object.fromEntries(savedProducts.map((product) => [product.id, product] as const)),
    [savedProducts],
  );
  const visibleSavedProducts = useMemo(
    () =>
      wishlist
        .map((productId) => savedProductLookup[productId])
        .filter((product): product is Product => Boolean(product)),
    [savedProductLookup, wishlist],
  );
  const totalSavedValue = useMemo(
    () => visibleSavedProducts.reduce((sum, product) => sum + product.price, 0),
    [visibleSavedProducts],
  );
  const readyToBuyCount = useMemo(
    () => visibleSavedProducts.filter((product) => product.stock > 0).length,
    [visibleSavedProducts],
  );
  const unavailableCount = useMemo(
    () => visibleSavedProducts.filter((product) => product.stock <= 0).length,
    [visibleSavedProducts],
  );
  const missingCount = Math.max(0, wishlistCount - visibleSavedProducts.length);

  async function handleAddToCart(product: Product) {
    try {
      setBusyProductId(product.id);
      setFeedback(null);
      await addItem({ product_id: product.id, quantity: 1 });
      setFeedback({
        tone: "success",
        message: `${product.name} đã được thêm vào giỏ hàng.`,
      });
    } catch (reason) {
      setFeedback({
        tone: "error",
        message: getErrorMessage(reason),
      });
    } finally {
      setBusyProductId("");
    }
  }

  function handleRemoveFromWishlist(product: Product) {
    setFeedback({
      tone: "info",
      message: `${product.name} đã được gỡ khỏi danh sách yêu thích.`,
    });
    toggleWishlist(product.id);
  }

  async function handleRefreshWishlist() {
    try {
      setIsRefreshingWishlist(true);
      setFeedback(null);
      await refreshWishlist();
      setFeedback({
        tone: "success",
        message: isAuthenticated
          ? "Danh sách yêu thích đã được cập nhật lại cho tài khoản hiện tại."
          : "Danh sách yêu thích đã được tải lại trên thiết bị này.",
      });
    } catch (reason) {
      setFeedback({
        tone: "error",
        message: getErrorMessage(reason),
      });
    } finally {
      setIsRefreshingWishlist(false);
    }
  }

  async function handleClearWishlist() {
    const previousCount = wishlistCount;

    try {
      setIsClearingWishlist(true);
      setFeedback(null);
      await clearWishlist();
      const nextWishlist = await refreshWishlist();

      if (nextWishlist.length === 0) {
        setFeedback({
          tone: "success",
          message: "Danh sách yêu thích đã được làm trống.",
        });
        return;
      }

      if (nextWishlist.length < previousCount) {
        setFeedback({
          tone: "info",
          message: "Danh sách yêu thích đã được cập nhật, nhưng vẫn còn vài món chưa thể xóa ngay.",
        });
        return;
      }

      setFeedback({
        tone: "error",
        message: "Chưa thể làm trống danh sách yêu thích lúc này. Hãy thử lại.",
      });
    } catch (reason) {
      setFeedback({
        tone: "error",
        message: getErrorMessage(reason),
      });
    } finally {
      setIsClearingWishlist(false);
    }
  }

  const isBusy = isLoading || isLoadingProducts;

  if (isBusy && wishlistCount > 0 && visibleSavedProducts.length === 0) {
    return (
      <>
        <main>
          <section className="shell pt-6 md:pt-8">
            <RecoveredStorefrontHeader navigation="fallback" tone="light" />
          </section>
          <LoadingScreen label="Dang tai wishlist..." />
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
        <section className="shell pt-6 md:pt-8">
          <RecoveredStorefrontHeader navigation="fallback" tone="light" />
        </section>

        <section className="shell section-spacing wishlist-shell space-y-8">
          <section className="wishlist-heading grid gap-6 rounded-[2rem] bg-white/60 p-6 shadow-editorial backdrop-blur md:p-8 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="wishlist-heading-copy space-y-5">
              <div className="wishlist-heading-copy">
                <p className="eyebrow">Wishlist</p>
                <h1 className="mt-4 max-w-4xl font-serif text-5xl font-semibold tracking-[-0.05em] text-primary md:text-[4.5rem]">
                  Lưu lại những món bạn muốn quay lại sau.
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-8 text-on-surface-variant md:text-lg">
                  {isAuthenticated
                    ? "Danh sách yêu thích đang đi theo tài khoản của bạn để có thể mở lại bất cứ lúc nào."
                    : "Danh sách yêu thích hiện đang được giữ trên thiết bị này. Đăng nhập để lưu lại lâu hơn."}
                </p>
              </div>

              <div className="wishlist-heading-actions flex flex-wrap gap-3">
                <Link href="/products" className={buttonStyles({ variant: "secondary" })}>
                  Tiếp tục mua sắm
                </Link>
                {!isAuthenticated ? (
                  <Link href="/login" className={buttonStyles()}>
                    Đăng nhập để lưu lại
                  </Link>
                ) : null}
              </div>
            </div>

            <SurfaceCard className="wishlist-heading-side grid content-start gap-4 p-5 md:p-6">
              <div className="wishlist-heading-meta">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-tertiary">
                    Tổng quan
                  </p>
                  <strong className="mt-2 block font-serif text-4xl font-semibold tracking-[-0.04em] text-primary">
                    {wishlistCount}
                  </strong>
                  <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                    sản phẩm đã lưu
                  </p>
                </div>
                <div className="rounded-full bg-primary/8 p-3 text-primary">
                  <Heart className="h-5 w-5" />
                </div>
              </div>

              <div className="grid gap-3 text-sm text-on-surface-variant">
                <div className="flex items-center justify-between gap-3">
                  <span>Có thể đặt ngay</span>
                  <strong className="text-primary">{readyToBuyCount}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Tạm hết hàng</span>
                  <strong className="text-primary">{unavailableCount}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Tổng giá trị tham khảo</span>
                  <strong className="text-primary">{formatCurrency(totalSavedValue)}</strong>
                </div>
              </div>

              <div className="wishlist-heading-actions flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  className={cn(buttonStyles({ variant: "ghost" }), "wishlist-toolbar-link")}
                  disabled={isRefreshingWishlist}
                  onClick={() => void handleRefreshWishlist()}
                >
                  <RefreshCw className={cn("h-4 w-4", isRefreshingWishlist && "animate-spin")} />
                  <span>{isRefreshingWishlist ? "Đang cập nhật..." : "Tải lại"}</span>
                </button>
                <button
                  type="button"
                  className={cn(buttonStyles({ variant: "tertiary" }), "wishlist-toolbar-link")}
                  disabled={wishlistCount === 0 || isClearingWishlist}
                  onClick={() => void handleClearWishlist()}
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{isClearingWishlist ? "Đang xóa..." : "Xóa tất cả"}</span>
                </button>
              </div>
            </SurfaceCard>
          </section>

          <section className="wishlist-insight-grid grid gap-4 md:grid-cols-3">
            <SurfaceCard className="wishlist-insight-card p-5 md:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-tertiary">
                Trạng thái lưu
              </p>
              <strong className="mt-3 block font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                {isAuthenticated ? "Tài khoản" : "Thiết bị này"}
              </strong>
              <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                {isAuthenticated
                  ? "Những món đã lưu luôn sẵn để bạn quay lại xem từ tài khoản của mình."
                  : "Những món đã lưu vẫn được giữ lại để bạn tiếp tục mua sắm sau."}
              </p>
            </SurfaceCard>

            <SurfaceCard className="wishlist-insight-card p-5 md:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-tertiary">
                Sẵn sàng mua
              </p>
              <strong className="mt-3 block font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                {readyToBuyCount}/{wishlistCount}
              </strong>
              <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                Những món còn hàng có thể được đưa vào giỏ ngay để đi tiếp sang bước thanh toán.
              </p>
            </SurfaceCard>

            <SurfaceCard className="wishlist-insight-card p-5 md:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-tertiary">
                Cảnh báo wishlist
              </p>
              <strong className="mt-3 block font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                Luôn sẵn sàng
              </strong>
              <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                Theo dõi món yêu thích để quay lại ngay khi bạn muốn thêm vào giỏ hoặc đặt mua.
              </p>
            </SurfaceCard>
          </section>

        {feedback ? <InlineAlert tone={feedback.tone}>{feedback.message}</InlineAlert> : null}
        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
        {missingCount > 0 ? (
          <InlineAlert tone="info">
            Có {missingCount} món đã lưu hiện không còn hiển thị. Hãy tải lại hoặc gỡ những món không còn phù hợp.
          </InlineAlert>
        ) : null}

        {visibleSavedProducts.length === 0 ? (
          <div className="wishlist-empty-state">
            <EmptyState
              title={missingCount > 0 ? "Không thể hiển thị đầy đủ danh sách yêu thích" : "Danh sách yêu thích đang trống"}
              description={
                missingCount > 0
                  ? "Một vài món đã lưu không còn khả dụng. Hãy tải lại hoặc quay về danh mục để chọn những sản phẩm mới."
                  : "Lưu sản phẩm từ trang danh mục hoặc trang chi tiết để quay lại so sánh và mua sau."
              }
              action={
                <Link href="/products" className={buttonStyles()}>
                  Khám phá sản phẩm
                </Link>
              }
            />
          </div>
        ) : (
          <section className="wishlist-grid grid gap-5">
            {visibleSavedProducts.map((product) => {
              const imageUrl = product.image_urls[0] || product.image_url || fallbackImageForProduct(product.name);

              return (
                <article key={product.id} className="wishlist-card overflow-hidden p-4 md:p-5">
                  <Link
                    href={`/products/${encodeURIComponent(product.id)}`}
                    className="wishlist-card-media relative block overflow-hidden rounded-[1.5rem] bg-surface"
                  >
                    <div className="relative aspect-[4/5]">
                      <StorefrontImage
                        alt={product.name}
                        src={imageUrl}
                        fill
                        sizes="(min-width: 1024px) 240px, (min-width: 768px) 42vw, 92vw"
                        className="object-cover transition duration-700 hover:scale-[1.04]"
                      />
                    </div>
                  </Link>

                  <div className="wishlist-card-copy flex flex-col justify-between gap-5">
                    <div className="space-y-4">
                      <div className="wishlist-card-copy-head flex flex-wrap items-start justify-between gap-4">
                        <div className="max-w-3xl">
                          <p className="wishlist-card-copy-kicker text-[11px] font-semibold uppercase tracking-[0.24em] text-tertiary">
                            {product.brand || product.category || "ND Shop"}
                          </p>
                          <Link
                            href={`/products/${encodeURIComponent(product.id)}`}
                            className="mt-2 block font-serif text-[2rem] font-semibold tracking-[-0.03em] text-primary md:text-[2.4rem]"
                          >
                            {product.name}
                          </Link>
                        </div>
                        <strong className="shrink-0 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                          {formatCurrency(product.price)}
                        </strong>
                      </div>

                      <div className="wishlist-card-meta-row flex flex-wrap gap-2">
                        <span
                          className={cn(
                            "wishlist-stock-pill inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]",
                            product.stock <= 0 && "wishlist-stock-pill-out",
                            getInventoryTone(product),
                          )}
                        >
                          {getInventoryLabel(product)}
                        </span>
                        {product.category ? (
                          <span className="wishlist-meta-chip inline-flex rounded-full bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                            {product.category}
                          </span>
                        ) : null}
                        {product.variants.length > 0 ? (
                          <span className="wishlist-meta-chip inline-flex rounded-full bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                            {product.variants.length} bien the
                          </span>
                        ) : null}
                      </div>

                      <p className="max-w-3xl text-sm leading-8 text-on-surface-variant md:text-base">
                        {product.description ||
                          "San pham nay da duoc luu de ban quay lai so sanh va dua vao gio hang khi san sang checkout."}
                      </p>
                    </div>

                    <div className="wishlist-card-actions flex flex-wrap items-center gap-3">
                      <Link
                        href={`/products/${encodeURIComponent(product.id)}`}
                        className={buttonStyles({ variant: "secondary" })}
                      >
                        Xem chi tiet
                      </Link>
                      <button
                        type="button"
                        className={buttonStyles()}
                        disabled={busyProductId === product.id || product.stock <= 0}
                        onClick={() => void handleAddToCart(product)}
                      >
                        <ShoppingBag className="h-4 w-4" />
                        <span>
                          {busyProductId === product.id
                            ? "Dang them..."
                            : product.stock > 0
                              ? "Them vao gio"
                              : "Het hang"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={cn(buttonStyles({ variant: "tertiary" }), "wishlist-remove-button")}
                        onClick={() => handleRemoveFromWishlist(product)}
                      >
                        <Heart className="h-4 w-4" />
                        <span>Go khoi wishlist</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
        </section>

        <section className="shell pb-12">
          <RecoveredEditorialFooter />
        </section>
      </main>
    </>
  );
}
