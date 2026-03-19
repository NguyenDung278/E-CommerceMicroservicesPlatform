import { useLocation, useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";

import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { api, getErrorMessage } from "../lib/api";
import type { Order, Payment } from "../types/api";
import { sanitizeText, toPositiveFloat } from "../utils/sanitize";
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
  const [feedback, setFeedback] = useState("");
  const [isBusy, setIsBusy] = useState("");

  const directProduct = (location.state as DirectProductState | null)?.directProduct;

  const checkoutItems = directProduct
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

  const totalAmount = checkoutItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  async function handleCreateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAuthenticated || !token) {
      navigate("/auth");
      return;
    }

    if (checkoutItems.length === 0) {
      setFeedback("Không có sản phẩm nào để checkout.");
      return;
    }

    try {
      setIsBusy("order");
      const response = await api.createOrder(token, {
        items: checkoutItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity
        }))
      });
      setLatestOrder(response.data);
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

  async function handleProcessPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!latestOrder || !token) {
      setFeedback("Cần tạo đơn hàng trước khi thanh toán.");
      return;
    }

    const form = {
      orderId: latestOrder.id,
      amount: latestOrder.total_price.toFixed(2),
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
        amount: toPositiveFloat(latestOrder.total_price.toFixed(2)),
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

        {checkoutItems.length === 0 ? (
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
                    <strong>${(item.price * item.quantity).toFixed(2)}</strong>
                  </div>
                ))}
              </div>

              <div className="summary-row summary-total">
                <span>Tổng tạm tính</span>
                <strong>${totalAmount.toFixed(2)}</strong>
              </div>

              <form onSubmit={handleCreateOrder}>
                <button className="primary-button" disabled={isBusy === "order"} type="submit">
                  {isBusy === "order" ? "Đang tạo đơn..." : "Tạo đơn hàng"}
                </button>
              </form>
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
                    <strong>${latestOrder.total_price.toFixed(2)}</strong>
                  </div>

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
