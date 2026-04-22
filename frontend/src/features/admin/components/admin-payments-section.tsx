import type { Order, Payment } from "@/types/api";
import { formatCurrency, formatDateTime } from "@/utils/format";

type AdminPaymentsSectionProps = {
  busyRefundId: string;
  hasMoreOrders: boolean;
  isLoadingOrders: boolean;
  isLoadingMoreOrders: boolean;
  orders: Order[];
  paymentsByOrder: Record<string, Payment[]>;
  onLoadMoreOrders: () => void;
  onRefund: (payment: Payment) => void;
};

type PaymentEntry = {
  order: Order;
  payment: Payment;
};

export function AdminPaymentsSection({
  busyRefundId,
  hasMoreOrders,
  isLoadingOrders,
  isLoadingMoreOrders,
  orders,
  paymentsByOrder,
  onLoadMoreOrders,
  onRefund,
}: AdminPaymentsSectionProps) {
  const paymentEntries = orders
    .flatMap((order) =>
      (paymentsByOrder[order.id] ?? []).map((payment) => ({
        order,
        payment,
      })),
    )
    .sort((left, right) => right.payment.created_at.localeCompare(left.payment.created_at));

  const completedCharges = paymentEntries.filter(
    ({ payment }) => payment.transaction_type === "charge" && payment.status === "completed",
  ).length;
  const refundsIssued = paymentEntries.filter(
    ({ payment }) => payment.transaction_type === "refund",
  ).length;
  const failedPayments = paymentEntries.filter(
    ({ payment }) => payment.status === "failed",
  ).length;

  return (
    <section className="admin-console-panel" id="admin-payment-ledger">
      <div className="section-heading">
        <div>
          <h2>Giao dịch thanh toán</h2>
          <p className="history-subtle">
            Xem riêng các giao dịch thanh toán, charge completed, refund và lỗi gateway mà không bị
            trộn với màn xử lý đơn hàng.
          </p>
        </div>
      </div>

      <div className="history-meta-grid">
        <div>
          <span>Charge hoàn tất</span>
          <strong>{completedCharges}</strong>
        </div>
        <div>
          <span>Refund đã tạo</span>
          <strong>{refundsIssued}</strong>
        </div>
        <div>
          <span>Giao dịch lỗi</span>
          <strong>{failedPayments}</strong>
        </div>
        <div>
          <span>Đơn trong batch</span>
          <strong>{orders.length}</strong>
        </div>
      </div>

      {isLoadingOrders ? <div className="page-state">Đang tải payment ledger...</div> : null}

      <div className="history-grid">
        {paymentEntries.map(({ order, payment }: PaymentEntry) => (
          <article className="history-card admin-console-record" key={payment.id}>
            <div className="history-card-head">
              <div>
                <p className="history-kicker">Giao dịch</p>
                <h3>{payment.id}</h3>
                <p className="history-subtle">
                  Order: {payment.order_id} • {formatDateTime(payment.created_at)}
                </p>
              </div>
              <span className="status-pill status-pill-neutral">{payment.status}</span>
            </div>

            <div className="history-meta-grid">
              <div>
                <span>Amount</span>
                <strong>{formatCurrency(payment.amount)}</strong>
              </div>
              <div>
                <span>Phương thức</span>
                <strong>{payment.payment_method}</strong>
              </div>
              <div>
                <span>Loại</span>
                <strong>{payment.transaction_type}</strong>
              </div>
              <div>
                <span>Khách hàng</span>
                <strong>{order.user_id}</strong>
              </div>
            </div>

            <div className="history-meta-grid">
              <div>
                <span>Gateway</span>
                <strong>{payment.gateway_provider || "n/a"}</strong>
              </div>
              <div>
                <span>Tổng đơn</span>
                <strong>{formatCurrency(payment.order_total)}</strong>
              </div>
              <div>
                <span>Còn lại</span>
                <strong>
                  {typeof payment.outstanding_amount === "number"
                    ? formatCurrency(payment.outstanding_amount)
                    : "n/a"}
                </strong>
              </div>
              <div>
                <span>Xác thực</span>
                <strong>{payment.signature_verified ? "verified" : "unchecked"}</strong>
              </div>
            </div>

            {payment.failure_reason ? (
              <p className="history-subtle">Lý do lỗi: {payment.failure_reason}</p>
            ) : null}

            {payment.transaction_type === "charge" && payment.status === "completed" ? (
              <div className="history-actions">
                <button
                  className="ghost-button"
                  disabled={busyRefundId === payment.id}
                  type="button"
                  onClick={() => onRefund(payment)}
                >
                  {busyRefundId === payment.id ? "Đang hoàn tiền..." : "Hoàn tiền"}
                </button>
              </div>
            ) : null}
          </article>
        ))}

        {!isLoadingOrders && paymentEntries.length === 0 ? (
          <p className="history-empty">Chưa có giao dịch thanh toán nào trong phạm vi đã tải.</p>
        ) : null}
      </div>

      {hasMoreOrders ? (
        <div className="history-actions">
          <button
            className="ghost-button"
            disabled={isLoadingMoreOrders}
            type="button"
            onClick={onLoadMoreOrders}
          >
            {isLoadingMoreOrders ? "Đang tải thêm..." : "Tải thêm payment ledger"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
