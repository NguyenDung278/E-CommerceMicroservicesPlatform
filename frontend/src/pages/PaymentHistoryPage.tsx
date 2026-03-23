import { Link } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useOrderPayments } from "../hooks/useOrderPayments";
import type { Payment } from "../types/api";
import { formatCurrency, formatDateTime, formatStatusLabel } from "../utils/format";
import "./payments.css";

type PaymentEntry = {
  payment: Payment;
  orderCreatedAt: string;
};

function paymentBadgeClassName(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("refund")) {
    return "status-pill status-pill-neutral";
  }
  if (normalized.includes("fail")) {
    return "status-pill status-pill-danger";
  }

  return "status-pill status-pill-success";
}

export function PaymentHistoryPage() {
  const { token } = useAuth();
  const { orders, paymentsByOrder, isLoading, error } = useOrderPayments(token);

  const paymentEntries: PaymentEntry[] = orders
    .flatMap((order) =>
      (paymentsByOrder[order.id] ?? []).map((payment) => ({
        payment,
        orderCreatedAt: order.created_at
      }))
    )
    .filter((entry): entry is PaymentEntry => entry !== null)
    .sort(
      (left, right) =>
        new Date(right.payment.created_at).getTime() - new Date(left.payment.created_at).getTime()
    );

  const totalPaid = paymentEntries.reduce((sum, entry) => {
    const direction = entry.payment.transaction_type === "refund" ? -1 : 1;
    return sum + entry.payment.amount * direction;
  }, 0);
  const pendingCount = paymentEntries.filter((entry) => entry.payment.status.toLowerCase().includes("pending")).length;
  const failedCount = paymentEntries.filter((entry) => entry.payment.status.toLowerCase().includes("fail")).length;
  const refundCount = paymentEntries.filter((entry) => entry.payment.transaction_type === "refund").length;
  const paymentMetrics = [
    {
      label: "Recorded transactions",
      value: `${paymentEntries.length}`,
      description: "Toàn bộ giao dịch lấy từ payment records của các order đã có."
    },
    {
      label: "Net amount",
      value: formatCurrency(totalPaid),
      description: "Đã trừ các khoản refund nếu có."
    },
    {
      label: "Needs attention",
      value: `${pendingCount + failedCount}`,
      description: "Bao gồm giao dịch pending hoặc failed cần theo dõi."
    }
  ];

  return (
    <div className="page-stack payments-page">
      <section className="payments-hero">
        <div className="payments-hero-panel">
          <div className="payments-hero-copy">
            <span className="eyebrow">Payment Ledger</span>
            <h1>Lịch sử thanh toán với ledger rõ trạng thái, dễ audit và dễ demo.</h1>
            <p>
              Màn này tổng hợp tất cả payment records theo order, giúp bạn nhìn nhanh khoản nào đã thanh toán, đang chờ
              callback, thất bại hoặc bị hoàn tiền.
            </p>
          </div>

          <div className="payments-metric-grid">
            {paymentMetrics.map((item) => (
              <article className="summary-card payments-metric-card" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="payments-side-panel">
          <span className="section-kicker">Status Mix</span>
          <h2>Snapshot giao dịch</h2>
          <div className="payments-status-list">
            <div className="payments-status-row">
              <span>Pending</span>
              <strong>{pendingCount}</strong>
            </div>
            <div className="payments-status-row">
              <span>Failed</span>
              <strong>{failedCount}</strong>
            </div>
            <div className="payments-status-row">
              <span>Refunds</span>
              <strong>{refundCount}</strong>
            </div>
          </div>

          <div className="payments-side-links">
            <Link className="text-link" to="/profile">
              Quay lại hồ sơ
            </Link>
            <Link className="text-link" to="/products">
              Tiếp tục mua sắm
            </Link>
          </div>
        </aside>
      </section>

      <section className="content-section payments-workbench">
        <div className="section-heading payments-workbench-head">
          <div>
            <span className="section-kicker">Transaction Feed</span>
            <h2>Danh sách giao dịch gần nhất</h2>
          </div>
          <span className="payments-caption">
            {paymentEntries[0]?.payment.created_at
              ? `Mới nhất: ${formatDateTime(paymentEntries[0].payment.created_at)}`
              : "Chưa có giao dịch nào"}
          </span>
        </div>

        {error ? <div className="feedback feedback-error">{error}</div> : null}

        {isLoading ? (
          <div className="page-state">Đang tải lịch sử thanh toán...</div>
        ) : paymentEntries.length === 0 ? (
          <div className="empty-card history-empty payments-empty-state">
            <span className="section-kicker">No Transactions</span>
            <h2>Bạn chưa có giao dịch nào</h2>
            <p>Hãy hoàn tất một đơn hàng để giao dịch xuất hiện tại đây.</p>
            <Link className="primary-link" to="/products">
              Tiếp tục mua sắm
            </Link>
          </div>
        ) : (
          <div className="payment-history-grid payments-ledger-grid">
            {paymentEntries.map(({ payment, orderCreatedAt }) => (
              <article className="history-card payments-ledger-card" key={payment.id}>
                <div className="history-card-head payments-ledger-head">
                  <div>
                    <p className="history-kicker">Giao dịch</p>
                    <h3>{payment.id}</h3>
                  </div>
                  <span className={paymentBadgeClassName(payment.status)}>
                    {formatStatusLabel(payment.status)}
                  </span>
                </div>

                <div className="payments-ledger-amount">
                  <span>{payment.transaction_type === "refund" ? "Khoản hoàn tiền" : "Giá trị giao dịch"}</span>
                  <strong>{formatCurrency(payment.amount)}</strong>
                </div>

                <div className="history-meta-grid payments-meta-grid">
                  <div>
                    <span>Ngày thanh toán</span>
                    <strong>{formatDateTime(payment.created_at)}</strong>
                  </div>
                  <div>
                    <span>Phương thức</span>
                    <strong>{payment.payment_method}</strong>
                  </div>
                  <div>
                    <span>Gateway</span>
                    <strong>{payment.gateway_provider}</strong>
                  </div>
                  <div>
                    <span>Loại giao dịch</span>
                    <strong>{formatStatusLabel(payment.transaction_type)}</strong>
                  </div>
                  <div>
                    <span>Ngày đặt hàng</span>
                    <strong>{formatDateTime(orderCreatedAt)}</strong>
                  </div>
                  <div>
                    <span>Outstanding</span>
                    <strong>
                      {typeof payment.outstanding_amount === "number"
                        ? formatCurrency(payment.outstanding_amount)
                        : "N/A"}
                    </strong>
                  </div>
                </div>

                <div className="history-line">
                  <span>Mã đơn hàng</span>
                  <strong>{payment.order_id}</strong>
                </div>

                {payment.failure_reason ? (
                  <div className="coupon-preview-card payments-note-card">
                    <strong>Failure reason</strong>
                    <span>{payment.failure_reason}</span>
                  </div>
                ) : null}

                <div className="history-actions">
                  <Link className="text-link" to={`/orders/${payment.order_id}`}>
                    Xem đơn hàng
                  </Link>
                  {payment.checkout_url ? (
                    <a className="text-link" href={payment.checkout_url} rel="noreferrer" target="_blank">
                      Mở checkout URL
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
