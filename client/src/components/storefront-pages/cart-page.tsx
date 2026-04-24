"use client";

import Link from "next/link";
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
  ProductCard,
  ProductCardAction,
  SurfaceCard,
  TextInput,
} from "@/components/storefront-shared/storefront-ui";
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
  const totalDue = couponPreview?.total_price ?? cart.total;

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
      <main>
        <section className="shell pt-6 md:pt-8">
          <RecoveredStorefrontHeader navigation="fallback" tone="light" />
        </section>
        <LoadingScreen label="Đang tải giỏ hàng..." />
        <section className="shell pb-12">
          <RecoveredEditorialFooter />
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="shell pt-6 md:pt-8">
        <RecoveredStorefrontHeader navigation="fallback" tone="light" />
      </section>

      <section className="shell section-spacing cart-editorial-page space-y-8">
        <section className="cart-editorial-header grid gap-6 rounded-[2rem] bg-white/60 p-6 shadow-editorial backdrop-blur md:p-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <div>
              <p className="eyebrow">Giỏ hàng</p>
              <h1 className="mt-4 max-w-4xl font-serif text-5xl font-semibold tracking-[-0.05em] text-primary md:text-[4.5rem]">
                Giỏ hàng của bạn
              </h1>
              <div className="cart-editorial-subtitle mt-5">
                <span>Kho giỏ hàng</span>
                <span className="cart-editorial-badge">món đã chọn</span>
                <span className="cart-editorial-badge">ưu đãi</span>
                <span className="cart-editorial-badge">sẵn sàng thanh toán</span>
              </div>
              <p className="mt-4 max-w-3xl text-base leading-8 text-on-surface-variant md:text-lg">
                Tại đây bạn có thể rà lại sản phẩm, điều chỉnh số lượng, thêm mã giảm giá và đi tiếp sang bước thanh toán.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] bg-[#f6f1ea] px-5 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                  Dòng sản phẩm
                </p>
                <p className="mt-2 font-serif text-3xl font-semibold tracking-[-0.04em] text-primary">
                  {cart.items.length}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-[#f6f1ea] px-5 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                  Tổng số lượng
                </p>
                <p className="mt-2 font-serif text-3xl font-semibold tracking-[-0.04em] text-primary">
                  {totalUnits}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-[#f6f1ea] px-5 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                  Tổng tạm tính
                </p>
                <p className="mt-2 font-serif text-3xl font-semibold tracking-[-0.04em] text-primary">
                  {formatCurrency(totalDue)}
                </p>
              </div>
            </div>
          </div>

          <SurfaceCard className="grid content-start gap-4 p-5 md:p-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                Ghi chú lưu trữ
              </p>
              <p className="mt-4 font-serif text-3xl font-semibold tracking-[-0.04em] text-primary">
                Tóm tắt đơn hàng
              </p>
            </div>
            <p className="text-sm leading-7 text-on-surface-variant">
              Mọi sản phẩm được gom rõ ràng ở một cột, còn phần tóm tắt đơn hàng nằm gọn ở bên cạnh để bạn kiểm tra nhanh hơn.
            </p>
            <div className="rounded-[1.25rem] bg-surface px-4 py-4 text-sm leading-7 text-on-surface-variant">
              {cart.items.length > 0
                ? `${totalUnits} món đã sẵn sàng. Bạn có thể thanh toán ngay hoặc để lại đây rồi quay lại sau.`
                : "Giỏ hàng đang trống. Hãy quay lại All Archive để chọn thêm sản phẩm."}
            </div>
          </SurfaceCard>
        </section>

        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
        {!isAuthenticated && cart.items.length > 0 ? (
          <InlineAlert tone="info">
            Đây là giỏ hàng tạm trên thiết bị hiện tại. Khi bạn đăng nhập, các món đã chọn vẫn sẽ sẵn sàng để tiếp tục mua sắm.
          </InlineAlert>
        ) : null}

        {cart.items.length === 0 ? (
          <EmptyState
            title="Giỏ hàng đang trống"
            description="Hãy thêm sản phẩm từ danh mục để bắt đầu đơn hàng mới."
            action={
              <Link href="/products" className={buttonStyles({ variant: "secondary" })}>
                Đi tới All Archive
              </Link>
            }
          />
        ) : (
          <div className="cart-editorial-layout grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
            <section className="cart-editorial-items space-y-4">
              {cart.items.map((item) => {
                const product = productMap[item.product_id];
                const imageUrl = product?.image_urls[0] || product?.image_url || "";

                return (
                  <article key={item.product_id} className="cart-editorial-item">
                    <div className="cart-editorial-media overflow-hidden rounded-[1rem] bg-surface">
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

                    <div className="cart-editorial-copy space-y-5">
                        <div className="cart-editorial-item-head flex items-start justify-between gap-4">
                          <div>
                            <p className="cart-editorial-kicker text-[11px] font-semibold uppercase tracking-[0.24em] text-tertiary">
                              {product?.category || "Sản phẩm"}
                            </p>
                            <Link
                              href={`/products/${item.product_id}`}
                              className="mt-2 block font-serif text-[2rem] font-semibold tracking-[-0.03em] text-primary"
                            >
                              {item.name}
                            </Link>
                            <p className="mt-3 text-sm text-on-surface-variant">{product?.brand || "ND Shop"}</p>
                          </div>
                          <strong className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                            {formatCurrency(item.price * item.quantity)}
                          </strong>
                        </div>

                        <div className="cart-editorial-item-meta grid gap-3 md:grid-cols-2">
                          <div className="cart-editorial-meta-block rounded-[1rem] bg-surface px-4 py-4">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                              Danh mục
                            </span>
                            <p className="mt-2 text-sm font-medium text-primary">
                              {product?.category || "Lưu trữ chung"}
                            </p>
                          </div>
                          <div className="cart-editorial-meta-block rounded-[1rem] bg-surface px-4 py-4">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                              Giá đơn vị
                            </span>
                            <p className="mt-2 text-sm font-medium text-primary">
                              {formatCurrency(item.price)}
                            </p>
                          </div>
                        </div>

                        <div className="cart-editorial-item-actions flex flex-wrap items-center gap-4">
                          <div className="cart-editorial-quantity flex items-center gap-3 rounded-full bg-surface px-3 py-2">
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

                          <Link href={`/products/${item.product_id}`} className={buttonStyles({ variant: "tertiary" })}>
                            Xem chi tiết
                          </Link>
                          <button
                            type="button"
                            className={buttonStyles({ variant: "tertiary" })}
                            onClick={() => toggleWishlist(item.product_id)}
                          >
                            {isSaved(item.product_id) ? "Đã lưu" : "Lưu lại"}
                          </button>
                          <button type="button" className={buttonStyles({ variant: "tertiary" })} onClick={() => void removeItem(item.product_id)}>
                            Xóa
                          </button>
                        </div>
                    </div>
                  </article>
                );
              })}
            </section>

            <aside className="cart-editorial-sidebar space-y-5">
              <div className="cart-editorial-summary">
                <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                  Tóm tắt đơn hàng
                </h2>

                <div className="cart-editorial-summary-list mt-6 space-y-4 text-sm text-on-surface-variant">
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
                  <div className="flex items-center justify-between">
                    <span>Thuế ước tính</span>
                    <strong className="text-primary">Tính ở checkout</strong>
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
                  {couponPreview?.coupon_description ? (
                    <div className="rounded-[1.25rem] bg-surface px-4 py-4 text-sm leading-7 text-on-surface-variant">
                      <p className="font-medium text-primary">{couponPreview.coupon_code || "Mã đã áp dụng"}</p>
                      <p className="mt-2">{couponPreview.coupon_description}</p>
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between border-t border-outline-variant/20 pt-4">
                    <span className="text-sm text-on-surface-variant">Tổng cộng</span>
                    <strong className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                      {formatCurrency(totalDue)}
                    </strong>
                  </div>
                  <p className="text-sm leading-7 text-on-surface-variant">
                    Tiếp tục sang thanh toán để hoàn tất đơn hàng. Nếu chưa đăng nhập, giỏ hàng vẫn được giữ lại trên thiết bị này.
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <Link href="/checkout" className={cn(buttonStyles({ size: "lg" }), "cart-editorial-cta")}>
                    Tiếp tục thanh toán
                  </Link>
                  <button
                    type="button"
                    className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "cart-editorial-clear")}
                    onClick={() => void clearCart()}
                  >
                    Xóa toàn bộ giỏ
                  </button>
                </div>

                <div className="cart-editorial-assurance">
                  <div>Số lượng sản phẩm sẽ được kiểm tra lại khi bạn xác nhận đơn.</div>
                  <div>Mã giảm giá được áp vào tổng tiền trước khi thanh toán.</div>
                  <div>Giỏ hàng vẫn được giữ lại nếu bạn chưa đăng nhập.</div>
                </div>
              </div>

              {savedProducts.length > 0 ? (
                <SurfaceCard className="cart-editorial-promo p-6">
                  <span>Món đã lưu</span>
                  <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                    Đã lưu để xem sau
                  </h3>
                  <p>Đưa nhanh những món đã lưu quay lại giỏ mà không cần rời khỏi trang này.</p>
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
      </section>

      <section className="shell pb-12">
        <RecoveredEditorialFooter />
      </section>

      {cart.items.length > 0 ? (
        <div className="cart-mobile-checkout-bar fixed inset-x-4 bottom-4 z-40 rounded-[1.5rem] border border-outline-variant/20 bg-background/92 p-4 shadow-editorial backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-4">
            <div className="cart-mobile-checkout-copy">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                {totalUnits === 1 ? "1 món đã sẵn sàng" : `${totalUnits} món đã sẵn sàng`}
              </p>
              <p className="mt-2 font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                {formatCurrency(totalDue)}
              </p>
            </div>
            <Link href="/checkout" className={cn(buttonStyles(), "cart-mobile-checkout-button")}>
              Thanh toán
            </Link>
          </div>
        </div>
      ) : null}
    </main>
  );
}
