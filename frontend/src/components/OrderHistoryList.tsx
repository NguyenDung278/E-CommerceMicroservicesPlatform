import { Link } from "react-router-dom";

import type { Order, Payment } from "../types/api";
import { formatCurrency, formatDateTime, formatStatusLabel } from "../utils/format";

type OrderHistoryListProps = {
  orders: Order[];
  paymentsByOrder: Record<string, Payment[]>;
  emptyTitle?: string;
  emptyDescription?: string;
};

function badgeClassName(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("fail")) {
    return "status-pill status-pill-danger";
  }
  if (normalized.includes("complete") || normalized.includes("paid") || normalized.includes("success")) {
    return "status-pill status-pill-success";
  }

  return "status-pill status-pill-neutral";
}

export function OrderHistoryList({
  orders,
  paymentsByOrder,
  emptyTitle = "Chưa có đơn hàng",
  emptyDescription = "Danh sách đơn hàng sẽ xuất hiện tại đây sau khi bạn mua sắm."
}: OrderHistoryListProps) {
  if (orders.length === 0) {
    return (
      <div className="empty-card history-empty">
        <h3>{emptyTitle}</h3>
        <p>{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="history-grid">
      {orders.map((order) => {
        const payment = paymentsByOrder[order.id]?.[0] ?? null;
        const orderItems = Array.isArray(order.items) ? order.items : [];
        const remainingItems = orderItems.length - 2;

        return (
          <article className="history-card" key={order.id}>
            <div className="history-card-head">
              <div>
                <p className="history-kicker">Đơn hàng</p>
                <h3>{order.id}</h3>
              </div>
              <span className={badgeClassName(order.status)}>{formatStatusLabel(order.status)}</span>
            </div>

            <div className="history-meta-grid">
              <div>
                <span>Ngày đặt</span>
                <strong>{formatDateTime(order.created_at)}</strong>
              </div>
              <div>
                <span>Tổng tiền</span>
                <strong>{formatCurrency(order.total_price)}</strong>
              </div>
              <div>
                <span>Thanh toán</span>
                <strong>{payment ? formatStatusLabel(payment.status) : "Chưa thanh toán"}</strong>
              </div>
              <div>
                <span>Số sản phẩm</span>
                <strong>{orderItems.length}</strong>
              </div>
            </div>

            <div className="history-item-preview">
              {orderItems.slice(0, 2).map((item) => (
                <div className="history-line" key={item.id}>
                  <span>
                    {item.name} x {item.quantity}
                  </span>
                  <strong>{formatCurrency(item.price * item.quantity)}</strong>
                </div>
              ))}
              {remainingItems > 0 ? (
                <span className="history-subtle">+{remainingItems} sản phẩm khác</span>
              ) : null}
            </div>

            <div className="history-actions">
              <Link className="text-link" to={`/orders/${order.id}`}>
                Xem chi tiết
              </Link>
              {payment ? (
                <Link className="text-link" to="/payments">
                  Xem thanh toán
                </Link>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
