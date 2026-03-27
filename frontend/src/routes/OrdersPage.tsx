import { useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useOrderPayments } from "../hooks/useOrderPayments";
import type { Order } from "../types/api";
import { AccountPageFrame } from "../ui/account/AccountPageFrame";
import { buildTileLabel, formatShortDate, formatShortOrderId, getOrderStatusTone } from "../ui/account/accountConfig";
import { formatCurrency, formatStatusLabel } from "../utils/format";
import "./OrdersPage.css";

export function OrdersPage() {
  const { token } = useAuth();
  const { orders, isLoading, error } = useOrderPayments(token);
  const [visibleCount, setVisibleCount] = useState(3);
  const visibleOrders = orders.slice(0, visibleCount);
  const hasMoreOrders = visibleCount < orders.length;

  return (
    <AccountPageFrame>
      <div className="orders-route">
        <header className="orders-route-head">
          <h1>Order History</h1>
          <p>Review your past purchases and track current deliveries from our latest seasonal collections.</p>
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
          <>
            <div className="orders-route-list">
              {visibleOrders.map((order, index) => (
              <article className="orders-route-card" key={order.id}>
                <div className="orders-route-thumb" aria-hidden="true">
                  <span className="orders-route-thumb-kicker">
                    {order.items.length} {order.items.length === 1 ? "piece selected" : "pieces selected"}
                  </span>
                  <strong>{buildTileLabel(order.items[0]?.name || `ND ${index + 1}`)}</strong>
                  <span className="orders-route-thumb-shadow" />
                </div>

                <div className="orders-route-card-body">
                  <div className="orders-route-card-head">
                    <div className="orders-route-order-copy">
                      <span className="orders-route-eyebrow">Order Reference</span>
                      <h3>{formatShortOrderId(order.id)}</h3>
                      <p>Placed on {formatShortDate(order.created_at)}</p>
                      <p className="orders-route-order-summary">{describeOrder(order)}</p>
                    </div>

                    <strong className={`orders-route-status orders-route-status-${getOrderStatusTone(order.status)}`}>
                      {formatStatusLabel(order.status)}
                    </strong>
                  </div>

                  <div className="orders-route-divider" />

                  <div className="orders-route-card-foot">
                    <div className="orders-route-meta-block">
                      <span>Total Amount</span>
                      <strong>{formatCurrency(order.total_price)}</strong>
                    </div>
                    <div className="orders-route-meta-block">
                      <span>Shipping Method</span>
                      <strong>{order.shipping_method || "Standard Delivery"}</strong>
                    </div>
                    <div className="orders-route-actions">
                      <Link className="orders-route-link" to={`/orders/${order.id}`}>
                        <span>View Details</span>
                        <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
              ))}
            </div>

            <div className="orders-route-footer">
              {hasMoreOrders ? (
                <button className="orders-route-load-more" type="button" onClick={() => setVisibleCount((current) => current + 3)}>
                  Load More Orders
                </button>
              ) : null}
              <p>
                Showing {visibleOrders.length} of {orders.length} orders
              </p>
            </div>
          </>
        )}
      </div>
    </AccountPageFrame>
  );
}

function describeOrder(order: Order) {
  const firstItemName = order.items[0]?.name;
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  if (!firstItemName) {
    return `${itemCount || order.items.length || 1} item prepared for delivery.`;
  }

  if (itemCount <= 1) {
    return firstItemName;
  }

  return `${firstItemName} and ${itemCount - 1} more ${itemCount - 1 === 1 ? "item" : "items"}.`;
}
