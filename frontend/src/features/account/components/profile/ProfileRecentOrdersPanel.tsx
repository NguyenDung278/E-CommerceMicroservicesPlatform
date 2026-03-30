import { Link } from "react-router-dom";

import type { Order } from "../../../../shared/types/api";
import { formatCurrency, formatStatusLabel } from "../../../../shared/utils/format";
import { formatShortDate, formatShortOrderId } from "../../utils/accountPresentation";
import { getProfileOrderStatusClassName } from "../../utils/profileEditor";

type ProfileRecentOrdersPanelProps = {
  isLoading: boolean;
  orders: Order[];
};

export function ProfileRecentOrdersPanel({ isLoading, orders }: ProfileRecentOrdersPanelProps) {
  return (
    <div className="profile-route-orders-panel">
      {isLoading ? (
        <div className="page-state">Đang tải lịch sử giao dịch...</div>
      ) : orders.length === 0 ? (
        <div className="empty-card history-empty profile-route-empty-state">
          <h3>You have not placed an order yet</h3>
          <p>Your most recent orders will appear here once checkout is complete.</p>
        </div>
      ) : (
        <table className="profile-route-orders-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Date</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link className="profile-route-order-link" to={`/orders/${order.id}`}>
                    {formatShortOrderId(order.id)}
                  </Link>
                </td>
                <td>{formatShortDate(order.created_at)}</td>
                <td>{formatCurrency(order.total_price)}</td>
                <td>
                  <span className={getProfileOrderStatusClassName(order.status)}>{formatStatusLabel(order.status)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
