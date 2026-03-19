import { Link } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useOrderPayments } from "../hooks/useOrderPayments";
import type { Payment } from "../types/api";
import { formatCurrency, formatDateTime, formatStatusLabel } from "../utils/format";

type PaymentEntry = {
  payment: Payment;
  orderCreatedAt: string;
};

function paymentBadgeClassName(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("fail")) {
    return "status-pill status-pill-danger";
  }

  return "status-pill status-pill-success";
}

export function PaymentHistoryPage() {
  const { token } = useAuth();
  const { orders, paymentsByOrder, isLoading, error } = useOrderPayments(token);

  const paymentEntries: PaymentEntry[] = orders
    .map((order) => {
      const payment = paymentsByOrder[order.id];
      if (!payment) {
        return null;
      }

      return {
        payment,
        orderCreatedAt: order.created_at
      };
    })
    .filter((entry): entry is PaymentEntry => entry !== null);

  const totalPaid = paymentEntries.reduce((sum, entry) => sum + entry.payment.amount, 0);

  return (
    <div className="page-stack">
      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Thanh toán</span>
            <h1>Lịch sử thanh toán</h1>
          </div>
        </div>

        {error ? <div className="feedback feedback-error">{error}</div> : null}

        {isLoading ? (
          <div className="page-state">Đang tải lịch sử thanh toán...</div>
        ) : paymentEntries.length === 0 ? (
          <div className="empty-card history-empty">
            <h2>Bạn chưa có giao dịch nào</h2>
            <p>Hãy hoàn tất một đơn hàng để giao dịch xuất hiện tại đây.</p>
            <Link className="primary-link" to="/products">
              Tiếp tục mua sắm
            </Link>
          </div>
        ) : (
          <>
            <div className="payment-overview-grid">
              <div className="summary-card">
                <strong>{paymentEntries.length}</strong>
                <span>Giao dịch đã ghi nhận</span>
              </div>
              <div className="summary-card">
                <strong>{formatCurrency(totalPaid)}</strong>
                <span>Tổng số tiền đã thanh toán</span>
              </div>
            </div>

            <div className="payment-history-grid">
              {paymentEntries.map(({ payment, orderCreatedAt }) => (
                <article className="history-card" key={payment.id}>
                  <div className="history-card-head">
                    <div>
                      <p className="history-kicker">Giao dịch</p>
                      <h3>{payment.id}</h3>
                    </div>
                    <span className={paymentBadgeClassName(payment.status)}>
                      {formatStatusLabel(payment.status)}
                    </span>
                  </div>

                  <div className="history-meta-grid">
                    <div>
                      <span>Ngày thanh toán</span>
                      <strong>{formatDateTime(payment.created_at)}</strong>
                    </div>
                    <div>
                      <span>Phương thức</span>
                      <strong>{payment.payment_method}</strong>
                    </div>
                    <div>
                      <span>Số tiền</span>
                      <strong>{formatCurrency(payment.amount)}</strong>
                    </div>
                    <div>
                      <span>Ngày đặt hàng</span>
                      <strong>{formatDateTime(orderCreatedAt)}</strong>
                    </div>
                  </div>

                  <div className="history-line">
                    <span>Mã đơn hàng</span>
                    <strong>{payment.order_id}</strong>
                  </div>

                  <div className="history-actions">
                    <Link className="text-link" to={`/orders/${payment.order_id}`}>
                      Xem đơn hàng
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
