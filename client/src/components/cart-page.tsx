"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { StorefrontImage } from "@/components/storefront-image";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  EmptyState,
  InlineAlert,
  LoadingScreen,
  ProductCard,
  ProductCardAction,
  SurfaceCard,
  TextInput,
} from "@/components/storefront-ui";
import { useAuthState } from "@/hooks/useAuth";
import { useCartActions, useCartState } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { orderApi } from "@/lib/api";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import {
  readProductListResource,
  readProductLookupResource,
} from "@/lib/resources/product-resources";
import { cn } from "@/lib/utils";
import type { OrderPreview, Product } from "@/types/api";
import { formatCurrency } from "@/utils/format";

export function CartPage() {
  const { token, isAuthenticated } = useAuthState();
  const { cart, error, isLoading } = useCartState();
  const { clearCart, removeItem, updateItem, addItem } = useCartActions();
  const { wishlist, isSaved, toggleWishlist } = useWishlist();
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState<OrderPreview | null>(null);
  const [couponFeedback, setCouponFeedback] = useState("");
  const [isPreviewingCoupon, setIsPreviewingCoupon] = useState(false);
  const [productMap, setProductMap] = useState<Record<string, Product>>({});
  const [savedProducts, setSavedProducts] = useState<Product[]>([]);
  const [busyProductId, setBusyProductId] = useState("");

  const previewItems = useMemo(
    () => cart.items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
    [cart.items],
  );
  const totalUnits = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    setCouponPreview(null);
  }, [cart.items]);

  useEffect(() => {
    let active = true;

    if (cart.items.length === 0) {
      setProductMap({});
      return () => {
        active = false;
      };
    }

    void readProductLookupResource(cart.items.map((item) => item.product_id)).then((nextMap) => {
      if (!active) {
        return;
      }

      setProductMap(nextMap);
    });

    return () => {
      active = false;
    };
  }, [cart.items]);

  useEffect(() => {
    let active = true;

    if (wishlist.length === 0) {
      setSavedProducts([]);
      return () => {
        active = false;
      };
    }

    void readProductListResource(wishlist.slice(0, 4)).then((products) => {
      if (!active) {
        return;
      }

      setSavedProducts(products);
    });

    return () => {
      active = false;
    };
  }, [wishlist]);

  async function handlePreviewCoupon() {
    const normalizedCouponCode = couponCode.trim();

    if (!token) {
      setCouponFeedback("Bạn cần đăng nhập để xem trước mã giảm giá.");
      return;
    }

    if (!normalizedCouponCode) {
      setCouponFeedback("Nhập mã giảm giá trước khi áp dụng.");
      return;
    }

    if (previewItems.length === 0) {
      setCouponFeedback("Giỏ hàng đang trống nên chưa thể áp dụng voucher.");
      return;
    }

    try {
      setIsPreviewingCoupon(true);
      const response = await orderApi.previewOrder(token, {
        items: previewItems,
        coupon_code: normalizedCouponCode,
      });
      setCouponPreview(response.data);
      setCouponCode(response.data.coupon_code ?? normalizedCouponCode.toUpperCase());
      setCouponFeedback(`Voucher ${response.data.coupon_code ?? normalizedCouponCode.toUpperCase()} đã được áp dụng.`);
    } catch (reason) {
      setCouponPreview(null);
      setCouponFeedback(getErrorMessage(reason));
    } finally {
      setIsPreviewingCoupon(false);
    }
  }

  async function handleAddSavedProduct(product: Product) {
    try {
      setBusyProductId(product.id);
      await addItem({ product_id: product.id, quantity: 1 });
    } catch (reason) {
      setCouponFeedback(getErrorMessage(reason));
    } finally {
      setBusyProductId("");
    }
  }

  if (isLoading) {
    return (
      <>
        <SiteHeader />
        <LoadingScreen label="Đang tải giỏ hàng..." />
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="shell section-spacing space-y-10">
        <div className="max-w-4xl">
          <p className="eyebrow">Shopping bag</p>
          <h1 className="mt-4 font-serif text-5xl font-semibold tracking-[-0.05em] text-primary md:text-[4.5rem]">
            Giỏ hàng của bạn
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-on-surface-variant md:text-lg">
            Cart đồng bộ với `cart-service`, coupon preview đi qua `order-service`, còn checkout sẽ tạo order thật và chuyển sang `payment-service`.
          </p>
        </div>

        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
        {!isAuthenticated && cart.items.length > 0 ? (
          <InlineAlert tone="info">
            Đây là giỏ tạm trên thiết bị hiện tại. Khi bạn đăng nhập, hệ thống sẽ merge từng item vào cart-service của tài khoản.
          </InlineAlert>
        ) : null}

        {cart.items.length === 0 ? (
          <EmptyState
            title="Giỏ hàng đang trống"
            description="Hãy thêm sản phẩm từ catalog hoặc kéo thả trực tiếp từ màn listing vào dock giỏ hàng."
            action={
              <Link href="/products" className={buttonStyles({ variant: "secondary" })}>
                Đi tới catalog
              </Link>
            }
          />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
            <section className="space-y-4">
              {cart.items.map((item) => {
                const product = productMap[item.product_id];
                const imageUrl = product?.image_urls[0] || product?.image_url || "";

                return (
                  <SurfaceCard key={item.product_id} className="p-5 md:p-6">
                    <div className="grid gap-5 md:grid-cols-[148px_minmax(0,1fr)]">
                      <div className="overflow-hidden rounded-[1rem] bg-surface">
                        {imageUrl ? (
                          <div className="relative aspect-[4/5]">
                            <StorefrontImage
                              alt={item.name}
                              src={imageUrl}
                              fill
                              sizes="(min-width: 768px) 148px, 42vw"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="aspect-[4/5] bg-surface-container-high" />
                        )}
                      </div>

                      <div className="space-y-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-tertiary">
                              {product?.category || "Catalog"}
                            </p>
                            <Link href={`/products/${item.product_id}`} className="mt-2 block font-serif text-[2rem] font-semibold tracking-[-0.03em] text-primary">
                              {item.name}
                            </Link>
                            <p className="mt-3 text-sm text-on-surface-variant">{product?.brand || "Commerce Platform"}</p>
                          </div>
                          <strong className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                            {formatCurrency(item.price * item.quantity)}
                          </strong>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex items-center gap-3 rounded-full bg-surface px-3 py-2">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-low text-primary"
                              onClick={() => void updateItem(item.product_id, Math.max(1, item.quantity - 1))}
                            >
                              -
                            </button>
                            <span className="min-w-6 text-center text-sm font-semibold text-primary">{item.quantity}</span>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-low text-primary"
                              onClick={() => void updateItem(item.product_id, item.quantity + 1)}
                            >
                              +
                            </button>
                          </div>

                          <button type="button" className={buttonStyles({ variant: "tertiary" })} onClick={() => void removeItem(item.product_id)}>
                            Xóa
                          </button>
                        </div>
                      </div>
                    </div>
                  </SurfaceCard>
                );
              })}
            </section>

            <aside className="space-y-5">
              <SurfaceCard className="p-6">
                <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                  Tóm tắt đơn hàng
                </h2>

                <div className="mt-6 space-y-4 text-sm text-on-surface-variant">
                  <div className="flex items-center justify-between">
                    <span>Số lượng</span>
                    <strong className="text-primary">{totalUnits}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tạm tính</span>
                    <strong className="text-primary">{formatCurrency(cart.total)}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Giảm giá</span>
                    <strong className="text-primary">
                      {couponPreview ? `-${formatCurrency(couponPreview.discount_amount)}` : "Tính sau"}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Phí giao hàng</span>
                    <strong className="text-primary">{couponPreview ? formatCurrency(couponPreview.shipping_fee) : "Tính khi checkout"}</strong>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <TextInput placeholder="Nhập mã giảm giá" value={couponCode} onChange={(event) => setCouponCode(event.target.value)} />
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button type="button" className={cn(buttonStyles({ variant: "secondary" }), "w-full")} disabled={isPreviewingCoupon} onClick={() => void handlePreviewCoupon()}>
                      {isPreviewingCoupon ? "Đang kiểm tra..." : "Xem trước voucher"}
                    </button>
                    <button
                      type="button"
                      className={cn(buttonStyles({ variant: "tertiary" }), "w-full justify-center")}
                      onClick={() => {
                        setCouponCode("");
                        setCouponPreview(null);
                        setCouponFeedback("");
                      }}
                    >
                      Gỡ voucher
                    </button>
                  </div>
                  {couponFeedback ? <InlineAlert tone="info">{couponFeedback}</InlineAlert> : null}
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <Link href="/checkout" className={cn(buttonStyles({ size: "lg" }), "w-full")}>
                    Tiếp tục checkout
                  </Link>
                  <button type="button" className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full")} onClick={() => void clearCart()}>
                    Xóa toàn bộ giỏ
                  </button>
                </div>
              </SurfaceCard>

              {savedProducts.length > 0 ? (
                <SurfaceCard className="p-6">
                  <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                    Đã lưu để xem sau
                  </h3>
                  <div className="mt-5 grid gap-4">
                    {savedProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        saved={isSaved(product.id)}
                        footerSlot={
                          <button type="button" className="text-sm font-medium text-tertiary hover:text-tertiary-container" onClick={() => toggleWishlist(product.id)}>
                            Bỏ lưu
                          </button>
                        }
                        actionSlot={
                          <ProductCardAction
                            onClick={() => void handleAddSavedProduct(product)}
                            disabled={product.stock <= 0}
                            loading={busyProductId === product.id}
                          />
                        }
                      />
                    ))}
                  </div>
                </SurfaceCard>
              ) : null}
            </aside>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
