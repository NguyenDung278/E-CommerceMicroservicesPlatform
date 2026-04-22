import { formatCurrency, formatDateTime } from "@/utils/format";
import type { Order, Payment } from "@/types/api";

type AdminOrdersSectionProps = {
  busyOrderId: string;
  busyRefundId: string;
  hasMoreOrders: boolean;
  isLoadingOrders: boolean;
  isLoadingMoreOrders: boolean;
  orders: Order[];
  onLoadMoreOrders: () => void;
  paymentsByOrder: Record<string, Payment[]>;
  onCancelOrder: (order: Order) => void;
  onRefund: (payment: Payment) => void;
};

export function AdminOrdersSection({
  busyOrderId,
  busyRefundId,
  hasMoreOrders,
  isLoadingOrders,
  isLoadingMoreOrders,
  orders,
  onLoadMoreOrders,
  paymentsByOrder,
  onCancelOrder,
  onRefund,
}: AdminOrdersSectionProps) {
  return (
    <section className="admin-console-panel" id="admin-order-ledger">
      <div className="section-heading">
        <div>
          <h2>Điều hành đơn hàng</h2>
          <p className="history-subtle">
            Theo dõi các đơn gần đây, hủy thủ công khi cần, và mở refund cho những charge đã hoàn
            tất mà không phải rời khỏi luồng vận hành.
          </p>
        </div>
      </div>

      {isLoadingOrders ? <div className="page-state">Đang tải đơn gần đây...</div> : null}

      <div className="history-grid">
        {orders.map((order) => {
          const payments = paymentsByOrder[order.id] ?? [];

          return (
            <article className="history-card admin-console-record" key={order.id}>
              <div className="history-card-head">
                <div>
                  <p className="history-kicker">Order</p>
                  <h3>{order.id}</h3>
                  <p className="history-subtle">
                    User: {order.user_id} • {formatDateTime(order.created_at)}
                  </p>
                </div>
                <span className="status-pill status-pill-neutral">{order.status}</span>
              </div>

              <div className="history-meta-grid">
                <div>
                  <span>Tổng tiền</span>
                  <strong>{formatCurrency(order.total_price)}</strong>
                </div>
                <div>
                  <span>Vận chuyển</span>
                  <strong>{order.shipping_method}</strong>
                </div>
                <div>
                  <span>Sản phẩm</span>
                  <strong>{order.items.length}</strong>
                </div>
                <div>
                  <span>Khách hàng</span>
                  <strong>{order.user_id}</strong>
                </div>
              </div>

              {order.status === "pending" || order.status === "paid" ? (
                <div className="history-actions">
                  <button
                    className="ghost-button"
                    disabled={busyOrderId === order.id}
                    type="button"
                    onClick={() => onCancelOrder(order)}
                  >
                    {busyOrderId === order.id ? "Đang hủy..." : "Hủy thủ công"}
                  </button>
                </div>
              ) : null}

              <div className="payment-history-grid">
                {payments.map((payment) => (
                  <div className="history-item-preview" key={payment.id}>
                    <strong>{payment.id}</strong>
                    <span>
                      {payment.payment_method} • {payment.transaction_type} • {payment.status}
                    </span>
                    <span>{formatCurrency(payment.amount)}</span>
                    {payment.transaction_type === "charge" && payment.status === "completed" ? (
                      <button
                        className="ghost-button"
                        disabled={busyRefundId === payment.id}
                        type="button"
                        onClick={() => onRefund(payment)}
                      >
                        {busyRefundId === payment.id ? "Đang hoàn tiền..." : "Hoàn tiền"}
                      </button>
                    ) : null}
                  </div>
                ))}

                {payments.length === 0 ? (
                  <p className="history-empty">Chưa có giao dịch nào cho đơn này.</p>
                ) : null}
              </div>
            </article>
          );
        })}

        {!isLoadingOrders && orders.length === 0 ? (
          <p className="history-empty">Chưa có đơn hàng nào để xử lý.</p>
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
            {isLoadingMoreOrders ? "Đang tải thêm..." : "Tải thêm đơn hàng"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
