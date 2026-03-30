import { useMemo } from "react";
import { Link } from "react-router-dom";

import { AccountPageLayout } from "../features/account/components/AccountPageLayout";
import { useOrderPayments } from "../features/account/hooks/useOrderPayments";
import {
  buildTileLabel,
  formatShortDate,
  formatShortOrderId,
  getPaymentStatusTone,
  humanizeToken
} from "../features/account/utils/accountPresentation";
import { useAuth } from "../features/auth/hooks/useAuth";
import type { Payment } from "../shared/types/api";
import { formatCurrency, formatDateTime, formatStatusLabel } from "../shared/utils/format";
import "./PaymentHistoryPage.css";

type PaymentEntry = {
  payment: Payment;
  orderCreatedAt: string;
};

type PaymentMethodHighlight = {
  key: string;
  title: string;
  subtitle: string;
  amount: number;
  recordCount: number;
};

export function PaymentHistoryPage() {
  const { token } = useAuth();
  const { orders, paymentsByOrder, isLoading, error } = useOrderPayments(token);

  const paymentEntries = useMemo(
    () =>
      orders
        .flatMap((order) =>
          (paymentsByOrder[order.id] ?? []).map((payment) => ({
            payment,
            orderCreatedAt: order.created_at
          }))
        )
        .sort(
          (left, right) =>
            new Date(right.payment.created_at).getTime() - new Date(left.payment.created_at).getTime()
        ),
    [orders, paymentsByOrder]
  );

  const totalPaid = paymentEntries.reduce((sum, entry) => {
    const direction = entry.payment.transaction_type === "refund" ? -1 : 1;
    return sum + entry.payment.amount * direction;
  }, 0);
  const pendingCount = paymentEntries.filter((entry) => entry.payment.status.toLowerCase().includes("pending")).length;
  const failedCount = paymentEntries.filter((entry) => entry.payment.status.toLowerCase().includes("fail")).length;
  const paymentMethodHighlights = useMemo(
    () => buildPaymentMethodHighlights(paymentEntries.map((entry) => entry.payment)),
    [paymentEntries]
  );

  return (
    <AccountPageLayout>
      <div className="payments-route">
        <section className="payments-route-hero">
          <div className="payments-route-hero-copy">
            <span className="payments-route-kicker">Secure Billing</span>
            <h1>Payment Methods</h1>
            <p>
              Securely manage your saved payment options and review your recent billing history within the ND Shop account
              area.
            </p>
          </div>

          <div className="payments-route-metrics">
            <article className="payments-route-metric">
              <span>Recorded transactions</span>
              <strong>{paymentEntries.length}</strong>
              <p>Every payment record tied to the orders we can fetch.</p>
            </article>
            <article className="payments-route-metric">
              <span>Net amount</span>
              <strong>{formatCurrency(totalPaid)}</strong>
              <p>Refunds are already deducted.</p>
            </article>
            <article className="payments-route-metric">
              <span>Needs attention</span>
              <strong>{pendingCount + failedCount}</strong>
              <p>Pending or failed transactions worth checking.</p>
            </article>
          </div>
        </section>

        {error ? <div className="feedback feedback-error">{error}</div> : null}

        <section className="payments-route-overview">
          <div className="payments-route-methods">
            {paymentMethodHighlights.length === 0 ? (
              <div className="payments-route-empty">
                <h3>No payment methods recorded yet</h3>
                <p>Once checkout succeeds, the payment methods you use most will be summarized here.</p>
              </div>
            ) : (
              paymentMethodHighlights.map((item) => (
                <article className="payments-route-card" key={item.key}>
                  <div className="payments-route-card-head">
                    <div className="payments-route-card-ident">
                      <span className="payments-route-card-badge">{buildTileLabel(item.title)}</span>
                      <div>
                        <h3>{item.title}</h3>
                        <p>{item.subtitle}</p>
                      </div>
                    </div>

                    <span className="payments-route-card-chip">
                      {item.recordCount} {item.recordCount === 1 ? "record" : "records"}
                    </span>
                  </div>

                  <div className="payments-route-card-amount">
                    <span>Processed amount</span>
                    <strong>{formatCurrency(item.amount)}</strong>
                  </div>
                </article>
              ))
            )}

            <Link className="payments-route-primary" to="/checkout">
              Add Payment Method
            </Link>
          </div>

          <div className="payments-route-rail">
            <article className="payments-route-note">
              <h3>Payment Security</h3>
              <p>
                Your payment data is encrypted and handled by gateway providers. We only surface the transaction trail and
                verification state.
              </p>
            </article>

            <article className="payments-route-note payments-route-note-accent">
              <span className="payments-route-kicker">Latest update</span>
              <strong>{paymentEntries[0] ? formatDateTime(paymentEntries[0].payment.created_at) : "No records yet"}</strong>
            </article>
          </div>
        </section>

        <section className="payments-route-history">
          <div className="payments-route-history-head">
            <div>
              <h2>Billing History</h2>
              <p>View your past transaction states and jump back into any related order.</p>
            </div>
          </div>

          {isLoading ? (
            <div className="page-state">Đang tải lịch sử thanh toán...</div>
          ) : paymentEntries.length === 0 ? (
            <div className="empty-card history-empty payments-route-empty">
              <h3>Bạn chưa có giao dịch nào</h3>
              <p>Hoàn tất một đơn hàng để payment records xuất hiện tại đây.</p>
            </div>
          ) : (
            <div className="payments-route-table-shell">
              <table className="payments-route-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th aria-label="actions" />
                  </tr>
                </thead>
                <tbody>
                  {paymentEntries.map(({ payment, orderCreatedAt }) => (
                    <tr key={payment.id}>
                      <td>
                        <div className="payments-route-order-cell">
                          <strong>{formatShortOrderId(payment.order_id)}</strong>
                          <span>Order from {formatShortDate(orderCreatedAt)}</span>
                        </div>
                      </td>
                      <td>{formatShortDate(payment.created_at)}</td>
                      <td>{`${humanizeToken(payment.gateway_provider)} · ${humanizeToken(payment.payment_method)}`}</td>
                      <td>
                        <span className={`payments-route-status payments-route-status-${getPaymentStatusTone(payment.status)}`}>
                          {formatStatusLabel(payment.status)}
                        </span>
                      </td>
                      <td>{formatCurrency(payment.amount)}</td>
                      <td>
                        <div className="payments-route-actions">
                          <Link className="payments-route-link" to={`/orders/${payment.order_id}`}>
                            View Order
                          </Link>
                          {payment.checkout_url ? (
                            <a className="payments-route-link" href={payment.checkout_url} rel="noreferrer" target="_blank">
                              Checkout URL
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AccountPageLayout>
  );
}

function buildPaymentMethodHighlights(payments: Payment[]) {
  const methods = new Map<string, PaymentMethodHighlight>();

  payments.forEach((payment) => {
    const key = `${payment.gateway_provider}:${payment.payment_method}`;
    const current = methods.get(key);

    if (current) {
      current.recordCount += 1;
      current.amount += payment.amount;
      return;
    }

    methods.set(key, {
      key,
      title: humanizeToken(payment.gateway_provider),
      subtitle: humanizeToken(payment.payment_method),
      amount: payment.amount,
      recordCount: 1
    });
  });

  return Array.from(methods.values())
    .sort((left, right) => right.recordCount - left.recordCount || right.amount - left.amount)
    .slice(0, 2);
}
