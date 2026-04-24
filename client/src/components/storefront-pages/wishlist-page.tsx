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
        message: `${product.name} da duoc them vao gio hang.`,
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
      message: `${product.name} da duoc go khoi wishlist.`,
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
          ? "Wishlist da duoc dong bo lai voi tai khoan hien tai."
          : "Wishlist local da duoc tai lai tu trinh duyet hien tai.",
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
          message: "Wishlist da duoc lam sach.",
        });
        return;
      }

      if (nextWishlist.length < previousCount) {
        setFeedback({
          tone: "info",
          message: "Wishlist da duoc cap nhat, nhung van con mot so mon chua xoa duoc.",
        });
        return;
      }

      setFeedback({
        tone: "error",
        message: "Khong the lam sach wishlist luc nay. Hay thu lai.",
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
                  Luu lai nhung mon ban muon quay lai sau.
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-8 text-on-surface-variant md:text-lg">
                  {isAuthenticated
                    ? "Wishlist dang duoc dong bo theo tai khoan, co the mo lai tren cac thiet bi khac sau khi dang nhap."
                    : "Wishlist hien dang luu tam tren trinh duyet nay. Dang nhap de hop nhat vao tai khoan va dung tren nhieu thiet bi."}
                </p>
              </div>

              <div className="wishlist-heading-actions flex flex-wrap gap-3">
                <Link href="/products" className={buttonStyles({ variant: "secondary" })}>
                  Tiep tuc mua sam
                </Link>
                {!isAuthenticated ? (
                  <Link href="/login" className={buttonStyles()}>
                    Dang nhap de dong bo
                  </Link>
                ) : null}
              </div>
            </div>

            <SurfaceCard className="wishlist-heading-side grid content-start gap-4 p-5 md:p-6">
              <div className="wishlist-heading-meta">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-tertiary">
                    Snapshot
                  </p>
                  <strong className="mt-2 block font-serif text-4xl font-semibold tracking-[-0.04em] text-primary">
                    {wishlistCount}
                  </strong>
                  <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                    san pham da luu
                  </p>
                </div>
                <div className="rounded-full bg-primary/8 p-3 text-primary">
                  <Heart className="h-5 w-5" />
                </div>
              </div>

              <div className="grid gap-3 text-sm text-on-surface-variant">
                <div className="flex items-center justify-between gap-3">
                  <span>Co the dat ngay</span>
                  <strong className="text-primary">{readyToBuyCount}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Tam het hang</span>
                  <strong className="text-primary">{unavailableCount}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Tong gia tri tham khao</span>
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
                  <span>{isRefreshingWishlist ? "Dang dong bo..." : "Dong bo lai"}</span>
                </button>
                <button
                  type="button"
                  className={cn(buttonStyles({ variant: "tertiary" }), "wishlist-toolbar-link")}
                  disabled={wishlistCount === 0 || isClearingWishlist}
                  onClick={() => void handleClearWishlist()}
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{isClearingWishlist ? "Dang xoa..." : "Xoa tat ca"}</span>
                </button>
              </div>
            </SurfaceCard>
          </section>

          <section className="wishlist-insight-grid grid gap-4 md:grid-cols-3">
            <SurfaceCard className="wishlist-insight-card p-5 md:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-tertiary">
                Trang thai dong bo
              </p>
              <strong className="mt-3 block font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                {isAuthenticated ? "Tai khoan" : "Trinh duyet"}
              </strong>
              <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                {isAuthenticated
                  ? "Thay doi wishlist se di thang vao backend va hoi nhap voi alerts/thong bao."
                  : "Cac mon da luu van dung duoc khi chua dang nhap va se merge sau khi login."}
              </p>
            </SurfaceCard>

            <SurfaceCard className="wishlist-insight-card p-5 md:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-tertiary">
                San sang checkout
              </p>
              <strong className="mt-3 block font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                {readyToBuyCount}/{wishlistCount}
              </strong>
              <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                Nhung mon con ton kho co the day vao gio hang ngay de di tiep sang checkout.
              </p>
            </SurfaceCard>

            <SurfaceCard className="wishlist-insight-card p-5 md:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-tertiary">
                Wishlist alerts
              </p>
              <strong className="mt-3 block font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                Da noi backend
              </strong>
              <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                Gia giam va back-in-stock alerts se xuat hien trong khu Notifications cua tai khoan.
              </p>
            </SurfaceCard>
          </section>

        {feedback ? <InlineAlert tone={feedback.tone}>{feedback.message}</InlineAlert> : null}
        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
        {missingCount > 0 ? (
          <InlineAlert tone="info">
            Co {missingCount} mon da luu khong con hydrate duoc tu catalog hien tai. Thu dong bo lai
            hoac go cac mon khong con hop le trong tai khoan.
          </InlineAlert>
        ) : null}

        {visibleSavedProducts.length === 0 ? (
          <div className="wishlist-empty-state">
            <EmptyState
              title={missingCount > 0 ? "Khong tai duoc du lieu wishlist" : "Wishlist dang trong"}
              description={
                missingCount > 0
                  ? "Danh sach da luu van con muc tham chieu cu, nhung catalog hien tai khong tra ve du lieu tuong ung. Thu dong bo lai hoac quay lai catalog de luu san pham moi."
                  : "Luu san pham tu catalog hoac trang chi tiet de quay lai so sanh, theo doi gia, va dat mua sau."
              }
              action={
                <Link href="/products" className={buttonStyles()}>
                  Kham pha catalog
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
