import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { api, getErrorMessage } from "../lib/api";
import type { OrderPreview, Product } from "../types/api";
import { formatCurrency } from "../utils/format";
import "./cart.css";

export function CartPage() {
  const { token, isAuthenticated } = useAuth();
  const { cart, clearCart, error, removeItem, updateItem, isLoading } = useCart();
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState<OrderPreview | null>(null);
  const [couponFeedback, setCouponFeedback] = useState("");
  const [isPreviewingCoupon, setIsPreviewingCoupon] = useState(false);
  const [productMap, setProductMap] = useState<Record<string, Product>>({});

  const previewItems = useMemo(
    () =>
      cart.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity
      })),
    [cart.items]
  );

  const cartSignature = useMemo(
    () => previewItems.map((item) => `${item.product_id}:${item.quantity}`).join("|"),
    [previewItems]
  );

  const totalUnits = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    setCouponPreview(null);
  }, [cartSignature]);

  useEffect(() => {
    let active = true;

    if (cart.items.length === 0) {
      setProductMap({});
      return () => {
        active = false;
      };
    }

    void Promise.allSettled(
      cart.items.map((item) =>
        api.getProductById(item.product_id).then((response) => [item.product_id, response.data] as const)
      )
    ).then((results) => {
      if (!active) {
        return;
      }

      const next: Record<string, Product> = {};
      for (const result of results) {
        if (result.status === "fulfilled") {
          const [productId, product] = result.value;
          next[productId] = product;
        }
      }
      setProductMap(next);
    });

    return () => {
      active = false;
    };
  }, [cart.items]);

  async function handleQuantityChange(productId: string, nextQuantity: number) {
    try {
      if (nextQuantity <= 0) {
        setCouponPreview(null);
        await removeItem(productId);
        return;
      }
      setCouponPreview(null);
      await updateItem(productId, nextQuantity);
    } catch (reason) {
      alert(getErrorMessage(reason));
    }
  }

  async function handleClearCart() {
    try {
      setCouponPreview(null);
      await clearCart();
    } catch (reason) {
      alert(getErrorMessage(reason));
    }
  }

  async function handlePreviewCoupon() {
    const normalizedCouponCode = couponCode.trim();

    if (!token) {
      setCouponFeedback("Bạn cần đăng nhập để xem trước mã giảm giá.");
      return;
    }

    if (!normalizedCouponCode) {
      setCouponFeedback("Nhập mã voucher trước khi áp dụng.");
      return;
    }

    if (previewItems.length === 0) {
      setCouponFeedback("Giỏ hàng đang trống nên chưa thể áp dụng voucher.");
      return;
    }

    try {
      setIsPreviewingCoupon(true);
      const response = await api.previewOrder(token, {
        items: previewItems,
        coupon_code: normalizedCouponCode
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

  function handleClearCoupon() {
    setCouponCode("");
    setCouponPreview(null);
    setCouponFeedback("");
  }

  return (
    <div className="page-stack cart-editorial-page">
      <header className="cart-editorial-header">
        <div>
          <h1>Shopping Bag</h1>
          <p className="cart-editorial-subtitle">
            ND_S26 / EDITORIAL COLLECTION
            <span className="cart-editorial-badge">Dev Note: Cart Microservice Active</span>
          </p>
        </div>
      </header>

      {error ? <div className="feedback feedback-error">{error}</div> : null}
      {!isAuthenticated && cart.items.length > 0 ? (
        <div className="feedback feedback-info">
          Đây là giỏ hàng dành cho khách vãng lai trên thiết bị hiện tại. Khi bạn đăng nhập, hệ thống sẽ tự động merge
          các món này vào tài khoản.
        </div>
      ) : null}

      {isLoading ? <div className="page-state">Đang tải giỏ hàng...</div> : null}

      {cart.items.length === 0 ? (
        <div className="empty-card cart-editorial-empty">
          <span className="section-kicker">Bag Empty</span>
          <h2>Giỏ hàng đang trống</h2>
          <p>Hãy thêm sản phẩm từ catalog trước khi thanh toán.</p>
          <Link className="primary-link" to="/products">
            Đi đến catalog
          </Link>
        </div>
      ) : (
        <div className="cart-editorial-layout">
          <section className="cart-editorial-items">
            {cart.items.map((item) => {
              const product = productMap[item.product_id];
              const imageUrl = product?.image_urls[0] ?? product?.image_url ?? "";

              return (
                <article className="cart-editorial-item" key={item.product_id}>
                  <div className="cart-editorial-media">
                    {imageUrl ? (
                      <img alt={item.name} src={imageUrl} />
                    ) : (
                      <div className="cart-editorial-fallback">{item.name.slice(0, 1).toUpperCase()}</div>
                    )}
                  </div>

                  <div className="cart-editorial-copy">
                    <div className="cart-editorial-item-head">
                      <div>
                        <span className="cart-editorial-kicker">
                          {product?.category || product?.brand || "Storefront item"}
                        </span>
                        <h3>{item.name}</h3>
                        <p>{product?.brand || "ND Atelier"} / {product?.sku || "Catalog sync pending"}</p>
                      </div>
                      <strong>{formatCurrency(item.price * item.quantity)}</strong>
                    </div>

                    <div className="cart-editorial-item-meta">
                      <div className="cart-editorial-meta-block">
                        <span>Collection</span>
                        <strong>{product?.category || "General archive"}</strong>
                      </div>
                      <div className="cart-editorial-meta-block">
                        <span>Quantity</span>
                        <div className="cart-editorial-quantity">
                          <button type="button" onClick={() => void handleQuantityChange(item.product_id, item.quantity - 1)}>
                            -
                          </button>
                          <span>{item.quantity}</span>
                          <button type="button" onClick={() => void handleQuantityChange(item.product_id, item.quantity + 1)}>
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="cart-editorial-item-actions">
                      <Link className="text-link" to={`/products/${item.product_id}`}>
                        Xem chi tiết
                      </Link>
                      <button
                        className="cart-editorial-remove"
                        type="button"
                        onClick={() => void removeItem(item.product_id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <aside className="cart-editorial-sidebar">
            <div className="cart-editorial-summary">
              <h2>Order Summary</h2>

              <div className="cart-editorial-summary-list">
                <div className="summary-row">
                  <span>Items</span>
                  <strong>{totalUnits}</strong>
                </div>
                <div className="summary-row">
                  <span>Subtotal</span>
                  <strong>{formatCurrency(cart.total)}</strong>
                </div>
                <div className="summary-row">
                  <span>Shipping</span>
                  <strong>Calculated at checkout</strong>
                </div>
                <div className="summary-row">
                  <span>Estimated Tax</span>
                  <strong>Calculated at checkout</strong>
                </div>
              </div>

              <label className="field" htmlFor="cart-coupon-code">
                <span className="field-label">Voucher</span>
                <input
                  id="cart-coupon-code"
                  placeholder="Nhập mã giảm giá"
                  value={couponCode}
                  onChange={(event) => {
                    setCouponCode(event.target.value);
                    setCouponPreview(null);
                  }}
                />
                <span className="field-hint">Xem trước mức giảm giá ngay trên giỏ hàng trước khi checkout.</span>
              </label>

              <div className="coupon-action-row">
                <button
                  className="secondary-button"
                  disabled={isPreviewingCoupon}
                  type="button"
                  onClick={() => void handlePreviewCoupon()}
                >
                  {isPreviewingCoupon ? "Đang kiểm tra..." : "Áp dụng voucher"}
                </button>
                <button
                  className="ghost-button"
                  disabled={!couponCode && !couponPreview}
                  type="button"
                  onClick={handleClearCoupon}
                >
                  Gỡ voucher
                </button>
              </div>

              {couponPreview?.discount_amount ? (
                <>
                  <div className="summary-row coupon-summary-discount">
                    <span>Giảm giá {couponPreview.coupon_code ? `(${couponPreview.coupon_code})` : ""}</span>
                    <strong>-{formatCurrency(couponPreview.discount_amount)}</strong>
                  </div>
                  {couponPreview.coupon_description ? (
                    <div className="coupon-preview-card">
                      <strong>{couponPreview.coupon_code}</strong>
                      <span>{couponPreview.coupon_description}</span>
                    </div>
                  ) : null}
                </>
              ) : null}

              <div className="summary-row summary-total">
                <span>Total</span>
                <strong>{formatCurrency(couponPreview?.total_price ?? cart.total)}</strong>
              </div>

              {couponFeedback ? <div className="feedback feedback-info">{couponFeedback}</div> : null}

              <Link className="secondary-link cart-editorial-cta" to="/checkout">
                Proceed to Checkout
              </Link>

              <div className="cart-editorial-assurance">
                <div>
                  <strong>Secure encrypted payment processing</strong>
                </div>
                <div>
                  <strong>Shipping và tax được tính chính xác ở bước checkout</strong>
                </div>
              </div>

              <button className="danger-button cart-editorial-clear" type="button" onClick={() => void handleClearCart()}>
                Xóa giỏ hàng
              </button>
            </div>

            <div className="cart-editorial-promo">
              <span>Exclusive Offer</span>
              <p>Join ND Atelier for free shipping and early access to the next preview collection.</p>
              <Link className="text-link" to="/register">
                Join Now
              </Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
