import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { api, getErrorMessage } from "../lib/api";
import type { Order, OrderPreview, Payment } from "../types/api";
import { formatCurrency } from "../utils/format";
import { sanitizeText } from "../utils/sanitize";
import { validatePayment } from "../utils/validation";

type DirectProductState = {
  directProduct?: {
    id: string;
    name: string;
    price: number;
    quantity: number;
  };
};

export function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, isAuthenticated } = useAuth();
  const { cart, clearCart } = useCart();

  const [latestOrder, setLatestOrder] = useState<Order | null>(null);
  const [latestPayment, setLatestPayment] = useState<Payment | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("credit_card");
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState<OrderPreview | null>(null);
  const [feedback, setFeedback] = useState("");
  const [isBusy, setIsBusy] = useState("");

  const directProduct = (location.state as DirectProductState | null)?.directProduct;

  const draftItems = directProduct
    ? [
        {
          product_id: directProduct.id,
          quantity: directProduct.quantity,
          name: directProduct.name,
          price: directProduct.price
        }
      ]
    : cart.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        name: item.name,
        price: item.price
      }));

  const checkoutItems = latestOrder
    ? latestOrder.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        name: item.name,
        price: item.price
      }))
    : draftItems;

  const draftSignature = useMemo(
    () => draftItems.map((item) => `${item.product_id}:${item.quantity}`).join("|"),
    [draftItems]
  );

  useEffect(() => {
    if (!latestOrder) {
      setCouponPreview(null);
    }
  }, [draftSignature, latestOrder]);

  const localSubtotal = draftItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const pricingSummary = latestOrder
    ? {
        subtotal_price: latestOrder.subtotal_price,
        discount_amount: latestOrder.discount_amount,
        coupon_code: latestOrder.coupon_code,
        total_price: latestOrder.total_price
      }
    : couponPreview;

  async function handleCreateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAuthenticated || !token) {
      navigate("/login", { state: { from: location } });
      return;
    }

    if (latestOrder) {
      setFeedback("Đơn hàng đã được tạo. Bạn có thể tiếp tục thanh toán ngay bên phải.");
      return;
    }

    if (draftItems.length === 0) {
      setFeedback("Không có sản phẩm nào để checkout.");
      return;
    }

    try {
      setIsBusy("order");
      const normalizedCouponCode = couponCode.trim();
      const response = await api.createOrder(token, {
        items: draftItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity
        })),
        coupon_code: normalizedCouponCode || undefined
      });
      setLatestOrder(response.data);
      if (response.data.coupon_code) {
        setCouponCode(response.data.coupon_code);
      }
      setLatestPayment(null);
      setFeedback(`Đã tạo đơn hàng ${response.data.id}. Bạn có thể thanh toán ngay bên dưới.`);

      if (!directProduct && cart.items.length > 0) {
        await clearCart();
      }
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsBusy("");
    }
  }

  async function handlePreviewCoupon() {
    const normalizedCouponCode = couponCode.trim();

    if (!isAuthenticated || !token) {
      navigate("/login", { state: { from: location } });
      return;
    }

    if (latestOrder) {
      setFeedback("Voucher đã được khóa theo đơn hàng vừa tạo.");
      return;
    }

    if (!normalizedCouponCode) {
      setFeedback("Nhập mã voucher trước khi áp dụng.");
      return;
    }

    if (draftItems.length === 0) {
      setFeedback("Không có sản phẩm nào để kiểm tra voucher.");
      return;
    }

    try {
      setIsBusy("preview");
      const response = await api.previewOrder(token, {
        items: draftItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity
        })),
        coupon_code: normalizedCouponCode
      });
      setCouponPreview(response.data);
      setCouponCode(response.data.coupon_code ?? normalizedCouponCode.toUpperCase());
      setFeedback(`Voucher ${response.data.coupon_code ?? normalizedCouponCode.toUpperCase()} hợp lệ cho đơn hiện tại.`);
    } catch (reason) {
      setCouponPreview(null);
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsBusy("");
    }
  }

  function handleClearCoupon() {
    if (latestOrder) {
      setFeedback("Voucher đã được gắn với đơn hàng vừa tạo và không thể gỡ tại bước này.");
      return;
    }

    setCouponCode("");
    setCouponPreview(null);
    setFeedback("");
  }

  async function handleProcessPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!latestOrder || !token) {
      setFeedback("Cần tạo đơn hàng trước khi thanh toán.");
      return;
    }

    const form = {
      orderId: latestOrder.id,
      paymentMethod
    };

    const errors = validatePayment(form);
    if (errors.length > 0) {
      setFeedback(errors.join(" "));
      return;
    }

    try {
      setIsBusy("payment");
      const response = await api.processPayment(token, {
        order_id: sanitizeText(latestOrder.id),
        payment_method: sanitizeText(paymentMethod)
      });
      setLatestPayment(response.data);
      setFeedback(`Thanh toán ${response.data.id} đã được tạo thành công.`);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsBusy("");
    }
  }

  return (
    <div className="page-stack">
      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Checkout</span>
            <h1>Hoàn tất đơn hàng</h1>
          </div>
        </div>

        {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}

        {!latestOrder && checkoutItems.length === 0 ? (
          <div className="empty-card">
            <h2>Không có sản phẩm để thanh toán</h2>
            <p>Bạn có thể mua ngay từ trang sản phẩm hoặc thêm item vào giỏ hàng.</p>
          </div>
        ) : (
          <div className="checkout-layout">
            <div className="card">
              <h2>Danh sách sản phẩm</h2>
              <div className="order-list">
                {checkoutItems.map((item) => (
                  <div className="summary-row" key={item.product_id}>
                    <span>
                      {item.name} x {item.quantity}
                    </span>
                    <strong>{formatCurrency(item.price * item.quantity)}</strong>
                  </div>
                ))}
              </div>

              <div className="summary-row">
                <span>Tổng tạm tính</span>
                <strong>{formatCurrency(pricingSummary?.subtotal_price ?? localSubtotal)}</strong>
              </div>

              {pricingSummary?.discount_amount ? (
                <div className="summary-row coupon-summary-discount">
                  <span>Giảm giá {pricingSummary.coupon_code ? `(${pricingSummary.coupon_code})` : ""}</span>
                  <strong>-{formatCurrency(pricingSummary.discount_amount)}</strong>
                </div>
              ) : null}

              {couponPreview?.coupon_description && !latestOrder ? (
                <div className="coupon-preview-card">
                  <strong>{couponPreview.coupon_code}</strong>
                  <span>{couponPreview.coupon_description}</span>
                </div>
              ) : null}

              <div className="summary-row summary-total">
                <span>Thành tiền</span>
                <strong>{formatCurrency(pricingSummary?.total_price ?? localSubtotal)}</strong>
              </div>

              {latestOrder ? (
                <div className="payment-success">
                  <strong>Đơn hàng đã sẵn sàng để thanh toán</strong>
                  <span>Bạn có thể tiếp tục xử lý thanh toán ở thẻ bên phải.</span>
                </div>
              ) : (
                <>
                  <label className="field" htmlFor="checkout-coupon-code">
                    <span className="field-label">Voucher</span>
                    <input
                      id="checkout-coupon-code"
                      placeholder="Nhập mã giảm giá"
                      value={couponCode}
                      onChange={(event) => {
                        setCouponCode(event.target.value);
                        setCouponPreview(null);
                      }}
                    />
                    <span className="field-hint">
                      Xem trước tổng tiền sau giảm giá trước khi tạo đơn hàng.
                    </span>
                  </label>

                  <div className="coupon-action-row">
                    <button
                      className="secondary-button"
                      disabled={isBusy === "preview"}
                      onClick={() => void handlePreviewCoupon()}
                      type="button"
                    >
                      {isBusy === "preview" ? "Đang kiểm tra..." : "Áp dụng voucher"}
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

                  <form onSubmit={handleCreateOrder}>
                    <button className="primary-button" disabled={isBusy === "order"} type="submit">
                      {isBusy === "order" ? "Đang tạo đơn..." : "Tạo đơn hàng"}
                    </button>
                  </form>
                </>
              )}
            </div>

            <div className="card">
              <h2>Thanh toán</h2>
              {latestOrder ? (
                <>
                  <div className="summary-row">
                    <span>Mã đơn</span>
                    <strong>{latestOrder.id}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Tổng tiền</span>
                    <strong>{formatCurrency(latestOrder.total_price)}</strong>
                  </div>
                  {latestOrder.coupon_code ? (
                    <div className="summary-row">
                      <span>Voucher</span>
                      <strong>{latestOrder.coupon_code}</strong>
                    </div>
                  ) : null}
                  {latestOrder.discount_amount > 0 ? (
                    <div className="summary-row">
                      <span>Giảm giá</span>
                      <strong>-{formatCurrency(latestOrder.discount_amount)}</strong>
                    </div>
                  ) : null}

                  <form onSubmit={handleProcessPayment}>
                    <label className="field" htmlFor="payment-method">
                      <span className="field-label">Phương thức thanh toán</span>
                      <select
                        id="payment-method"
                        value={paymentMethod}
                        onChange={(event) => setPaymentMethod(event.target.value)}
                      >
                        <option value="credit_card">Credit Card</option>
                        <option value="paypal">PayPal</option>
                        <option value="bank_transfer">Bank Transfer</option>
                      </select>
                    </label>

                    <button className="secondary-button" disabled={isBusy === "payment"} type="submit">
                      {isBusy === "payment" ? "Đang thanh toán..." : "Thanh toán"}
                    </button>
                  </form>
                </>
              ) : (
                <p>Bạn cần tạo đơn hàng trước khi xử lý thanh toán.</p>
              )}

              {latestPayment ? (
                <div className="payment-success">
                  <strong>Trạng thái thanh toán: {latestPayment.status}</strong>
                  <span>Mã giao dịch: {latestPayment.id}</span>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
