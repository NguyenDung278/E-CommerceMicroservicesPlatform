import { Link } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useOrderPayments } from "../hooks/useOrderPayments";
import { AccountPageFrame } from "../ui/account/AccountPageFrame";
import { buildTileLabel, formatShortDate, formatShortOrderId, getOrderStatusTone } from "../ui/account/accountConfig";
import { formatCurrency, formatStatusLabel } from "../utils/format";
import "./OrdersPage.css";

export function OrdersPage() {
  const { token } = useAuth();
  const { orders, isLoading, error } = useOrderPayments(token);

  return (
    <AccountPageFrame>
      <div className="orders-route">
        <header className="orders-route-head">
          <h1>My Orders</h1>
          <p>Review your order history, track current shipments, and manage returns for your recent purchases.</p>
        </header>

        {error ? <div className="feedback feedback-error">{error}</div> : null}

        {isLoading ? (
          <div className="page-state">Đang tải lịch sử đơn hàng...</div>
        ) : orders.length === 0 ? (
          <div className="empty-card history-empty orders-route-empty">
            <h3>You have not placed an order yet</h3>
            <p>Your order history will appear here after your first checkout.</p>
          </div>
        ) : (
          <div className="orders-route-list">
            {orders.map((order) => (
              <article className="orders-route-card" key={order.id}>
                <div className="orders-route-primary">
                  <div className="orders-route-thumb" aria-hidden="true">
                    <span>{buildTileLabel(order.items[0]?.name || "ND")}</span>
                  </div>

                  <div>
                    <h3>{formatShortOrderId(order.id)}</h3>
                    <p>{formatShortDate(order.created_at)}</p>
                  </div>
                </div>

                <div className="orders-route-meta">
                  <div className="orders-route-meta-block">
                    <span>Total</span>
                    <strong>{formatCurrency(order.total_price)}</strong>
                  </div>
                  <div className="orders-route-meta-block">
                    <span>Status</span>
                    <strong className={`orders-route-status orders-route-status-${getOrderStatusTone(order.status)}`}>
                      {formatStatusLabel(order.status)}
                    </strong>
                  </div>
                  <div className="orders-route-actions">
                    <Link className="orders-route-link" to={`/orders/${order.id}`}>
                      View Details
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AccountPageFrame>
  );
}
