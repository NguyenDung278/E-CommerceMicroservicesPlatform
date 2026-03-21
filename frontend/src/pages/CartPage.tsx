import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { api, getErrorMessage } from "../lib/api";
import type { OrderPreview } from "../types/api";
import { formatCurrency } from "../utils/format";

export function CartPage() {
  const { token } = useAuth();
  const { cart, clearCart, error, removeItem, updateItem, isLoading } = useCart();
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState<OrderPreview | null>(null);
  const [couponFeedback, setCouponFeedback] = useState("");
  const [isPreviewingCoupon, setIsPreviewingCoupon] = useState(false);

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

  useEffect(() => {
    setCouponPreview(null);
  }, [cartSignature]);

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
    <div className="page-stack">
      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Giỏ hàng</span>
            <h1>Giỏ hàng của bạn</h1>
          </div>
        </div>

        {error ? <div className="feedback feedback-error">{error}</div> : null}

        {isLoading ? <div className="page-state">Đang tải giỏ hàng...</div> : null}

        {cart.items.length === 0 ? (
          <div className="empty-card">
            <h2>Giỏ hàng đang trống</h2>
            <p>Hãy thêm sản phẩm từ catalog trước khi thanh toán.</p>
            <Link className="primary-link" to="/products">
              Đi đến catalog
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="card">
              <div className="cart-items">
                {cart.items.map((item) => (
                  <article className="cart-item" key={item.product_id}>
                    <div>
                      <h3>{item.name}</h3>
                      <p>${item.price.toFixed(2)}</p>
                    </div>
                    <div className="cart-item-actions">
                      <input
                        min="1"
                        step="1"
                        type="number"
                        value={item.quantity}
                        onChange={(event) =>
                          void handleQuantityChange(
                            item.product_id,
                            Number.parseInt(event.target.value, 10) || 1
                          )
                        }
                      />
                      <button className="ghost-button" onClick={() => void removeItem(item.product_id)} type="button">
                        Xóa
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="summary-panel">
              <h2>Tổng kết</h2>
              <div className="summary-row">
                <span>Số mặt hàng</span>
                <strong>{cart.items.length}</strong>
              </div>
              <div className="summary-row">
                <span>Tạm tính</span>
                <strong>{formatCurrency(cart.total)}</strong>
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
                  onClick={() => void handlePreviewCoupon()}
                  type="button"
                >
                  {isPreviewingCoupon ? "Đang kiểm tra..." : "Áp dụng voucher"}
                </button>
                <button
                  className="ghost-button"
                  disabled={!couponCode && !couponPreview}
                  onClick={handleClearCoupon}
                  type="button"
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
                <span>Thành tiền</span>
                <strong>{formatCurrency(couponPreview?.total_price ?? cart.total)}</strong>
              </div>

              {couponFeedback ? <div className="feedback feedback-info">{couponFeedback}</div> : null}

              <div className="summary-actions">
                <Link className="primary-link" to="/checkout">
                  Đi đến checkout
                </Link>
                <button className="danger-button" onClick={() => void handleClearCart()} type="button">
                  Xóa giỏ hàng
                </button>
              </div>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
