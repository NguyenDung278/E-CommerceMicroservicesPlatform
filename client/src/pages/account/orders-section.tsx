import { CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import type { Order, Payment } from "../../types/api";
import { formatCurrency, formatDate } from "../../utils/format";
import { statusLabel } from "../../utils/status";

/** Danh sách đơn hàng kèm trạng thái thanh toán gần nhất của từng đơn. */
export function OrdersSection({
  orders,
  paymentsByOrder,
}: {
  orders: Order[];
  paymentsByOrder: Record<string, Payment[]>;
}) {
  const pendingOrders = orders.filter((order) => order.status === "pending").length;

  return (
    <section className="surface-section" id="orders">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Orders</span>
          <h2>Đơn hàng</h2>
          <p>{pendingOrders} đơn đang chờ xử lý</p>
        </div>
        <Link to="/products">Mua thêm</Link>
      </div>
      {orders.length === 0 ? (
        <p>Chưa có đơn hàng.</p>
      ) : (
        <div className="order-list">
          {orders.map((order) => {
            const orderPayments = paymentsByOrder[order.id] ?? [];
            const lastPayment = orderPayments[0];
            return (
              <article key={order.id} className="order-card order-card--rich">
                <div>
                  <Link to={`/account/orders/${order.id}`}>{order.id}</Link>
                  <p>{formatDate(order.created_at)}</p>
                </div>
                <span className="status-pill">{statusLabel(order.status)}</span>
                <strong>{formatCurrency(order.total_price)}</strong>
                <span>{lastPayment ? statusLabel(lastPayment.status) : "Chưa có thanh toán"}</span>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Lịch sử thanh toán của user, mỗi payment link tới trang trạng thái. */
export function PaymentsSection({ payments }: { payments: Payment[] }) {
  return (
    <section className="surface-section" id="payments">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Payments</span>
          <h2>Lịch sử thanh toán</h2>
        </div>
        <CreditCard size={24} />
      </div>
      {payments.length === 0 ? (
        <p>Chưa có thanh toán.</p>
      ) : (
        <div className="payment-list">
          {payments.map((payment) => (
            <article key={payment.id} className="payment-card">
              <div>
                <Link to={`/payments/${payment.id}`}>{payment.payment_method}</Link>
                <p>{payment.order_id}</p>
              </div>
              <span className="status-pill">{statusLabel(payment.status)}</span>
              <strong>{formatCurrency(payment.amount)}</strong>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
