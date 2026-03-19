import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { api, getErrorMessage } from "../lib/api";
import type { Order, Payment } from "../types/api";

export function OrderDetailPage() {
  const { token } = useAuth();
  const { orderId = "" } = useParams();

  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;

    if (!token) {
      return () => {
        active = false;
      };
    }

    void api
      .getOrderById(token, orderId)
      .then(async (response) => {
        if (active) {
          setOrder(response.data);
        }

        try {
          const paymentResponse = await api.getPaymentByOrder(token, orderId);
          if (active) {
            setPayment(paymentResponse.data);
          }
        } catch {
          if (active) {
            setPayment(null);
          }
        }
      })
      .catch((reason) => {
        if (active) {
          setFeedback(getErrorMessage(reason));
        }
      });

    return () => {
      active = false;
    };
  }, [orderId, token]);

  if (!order && !feedback) {
    return <div className="page-state">Đang tải chi tiết đơn hàng...</div>;
  }

  return (
    <div className="page-stack">
      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Đơn hàng</span>
            <h1>Chi tiết đơn hàng</h1>
          </div>
        </div>

        {feedback ? <div className="feedback feedback-error">{feedback}</div> : null}

        {order ? (
          <div className="checkout-layout">
            <div className="card">
              <h2>Thông tin đơn hàng</h2>
              <div className="summary-row">
                <span>Mã đơn</span>
                <strong>{order.id}</strong>
              </div>
              <div className="summary-row">
                <span>Trạng thái</span>
                <strong>{order.status}</strong>
              </div>
              <div className="summary-row">
                <span>Tổng tiền</span>
                <strong>${order.total_price.toFixed(2)}</strong>
              </div>
              <div className="order-list">
                {order.items.map((item) => (
                  <div className="summary-row" key={item.id}>
                    <span>
                      {item.name} x {item.quantity}
                    </span>
                    <strong>${(item.price * item.quantity).toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2>Lịch sử thanh toán</h2>
              {payment ? (
                <>
                  <div className="summary-row">
                    <span>Mã giao dịch</span>
                    <strong>{payment.id}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Trạng thái</span>
                    <strong>{payment.status}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Phương thức</span>
                    <strong>{payment.payment_method}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Số tiền</span>
                    <strong>${payment.amount.toFixed(2)}</strong>
                  </div>
                </>
              ) : (
                <p>Chưa có thanh toán cho đơn hàng này.</p>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
