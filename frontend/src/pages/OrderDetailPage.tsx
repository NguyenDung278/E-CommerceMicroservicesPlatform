import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { api, getErrorMessage } from "../lib/api";
import type { Order, Payment } from "../types/api";
import { formatCurrency, formatShippingMethodLabel } from "../utils/format";

export function OrderDetailPage() {
  const { token } = useAuth();
  const { orderId = "" } = useParams();

  const [order, setOrder] = useState<Order | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
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
          const paymentResponse = await api.listPaymentsByOrder(token, orderId);
          if (active) {
            setPayments(paymentResponse.data);
          }
        } catch {
          if (active) {
            setPayments([]);
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
                <strong>{formatCurrency(order.total_price)}</strong>
              </div>
              <div className="summary-row">
                <span>Vận chuyển</span>
                <strong>
                  {formatShippingMethodLabel(order.shipping_method)} • {formatCurrency(order.shipping_fee)}
                </strong>
              </div>
              {order.shipping_address ? (
                <div className="coupon-preview-card">
                  <strong>{order.shipping_address.recipient_name}</strong>
                  <span>{order.shipping_address.phone}</span>
                  <span>
                    {[order.shipping_address.street, order.shipping_address.ward, order.shipping_address.district, order.shipping_address.city]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
              ) : null}
              <div className="order-list">
                {order.items.map((item) => (
                  <div className="summary-row" key={item.id}>
                    <span>
                      {item.name} x {item.quantity}
                    </span>
                    <strong>{formatCurrency(item.price * item.quantity)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2>Lịch sử thanh toán</h2>
              {payments.length > 0 ? (
                <div className="order-list">
                  {payments.map((payment) => (
                    <div className="coupon-preview-card" key={payment.id}>
                      <strong>{payment.id}</strong>
                      <span>
                        {payment.payment_method} • {payment.transaction_type} • {payment.status}
                      </span>
                      <span>{formatCurrency(payment.amount)}</span>
                      {typeof payment.outstanding_amount === "number" ? (
                        <span>Còn lại: {formatCurrency(payment.outstanding_amount)}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
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
