import { CheckCircle2, CreditCard, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import type { Order, OrderEvent, Payment, ShipmentTracking } from "../../types/api";
import { formatCurrency, formatDate } from "../../utils/format";
import { isPositiveStatus, statusLabel } from "../../utils/status";

/**
 * Cột phải của chi tiết đơn: tổng tiền, timeline trạng thái, lịch sử
 * thanh toán theo đơn, tracking vận chuyển và địa chỉ giao. Thuần hiển thị.
 */
export function OrderSidebar({
  order,
  timeline,
  payments,
  tracking,
}: {
  order: Order;
  timeline: OrderEvent[];
  payments: Payment[];
  tracking: ShipmentTracking | null;
}) {
  const timelineEvents =
    timeline.length > 0
      ? timeline
      : [
          {
            id: order.id,
            order_id: order.id,
            type: "order_created",
            status: order.status,
            message: "Đơn hàng đã được tạo",
            created_at: order.created_at,
          },
        ];

  return (
    <aside className="order-detail-side">
      <section className="summary-card">
        <span className="eyebrow">Payment</span>
        <div className="summary-row">
          <span>Tạm tính</span>
          <strong>{formatCurrency(order.subtotal_price)}</strong>
        </div>
        <div className="summary-row">
          <span>Giảm giá</span>
          <strong>{formatCurrency(order.discount_amount)}</strong>
        </div>
        <div className="summary-row">
          <span>Giao hàng</span>
          <strong>{formatCurrency(order.shipping_fee)}</strong>
        </div>
        <div className="summary-row summary-row--total">
          <span>Tổng</span>
          <strong>{formatCurrency(order.total_price)}</strong>
        </div>
      </section>

      <section className="surface-section order-side-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Timeline</span>
            <h2>Trạng thái</h2>
          </div>
          <CheckCircle2 size={22} />
        </div>
        <div className="timeline-list">
          {timelineEvents.map((event) => (
            <article key={event.id} className="timeline-item">
              <span />
              <div>
                <strong>{statusLabel(event.status || event.type)}</strong>
                <p>{event.message}</p>
                <small>{formatDate(event.created_at)}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="surface-section order-side-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Payments</span>
            <h2>Lịch sử thanh toán</h2>
          </div>
          <CreditCard size={22} />
        </div>
        {payments.length === 0 ? (
          <p className="muted-text">Chưa có thanh toán cho đơn này.</p>
        ) : (
          <div className="payment-history-list">
            {payments.map((payment) => (
              <Link
                key={payment.id}
                to={`/payments/${payment.id}`}
                className="payment-history-card"
              >
                <div>
                  <strong>{payment.payment_method}</strong>
                  <p>{formatDate(payment.created_at)}</p>
                </div>
                <span
                  className={`status-pill${isPositiveStatus(payment.status) ? " is-good" : ""}`}
                >
                  {statusLabel(payment.status)}
                </span>
                <strong>{formatCurrency(payment.amount)}</strong>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="surface-section order-side-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Carrier</span>
            <h2>Theo dõi vận chuyển</h2>
          </div>
          <Truck size={22} />
        </div>
        {tracking ? (
          <div className="tracking-card">
            <div>
              <span>Đơn vị vận chuyển</span>
              <strong>{tracking.carrier}</strong>
            </div>
            <div>
              <span>Mã tracking</span>
              <strong>{tracking.tracking_number}</strong>
            </div>
            <div>
              <span>Trạng thái</span>
              <strong>{statusLabel(tracking.status)}</strong>
            </div>
            {tracking.estimated_delivery_at ? (
              <div>
                <span>Dự kiến giao</span>
                <strong>{formatDate(tracking.estimated_delivery_at)}</strong>
              </div>
            ) : null}
            {tracking.tracking_url ? (
              <a className="button button--secondary" href={tracking.tracking_url}>
                Mở trang carrier
              </a>
            ) : null}
          </div>
        ) : (
          <p className="muted-text">Chưa có mã tracking từ đơn vị vận chuyển.</p>
        )}
      </section>

      <section className="surface-section order-side-section">
        <span className="eyebrow">Shipping</span>
        <h2>{order.shipping_method}</h2>
        {order.shipping_address ? (
          <p>
            {order.shipping_address.recipient_name} - {order.shipping_address.phone}
            <br />
            {order.shipping_address.location}
          </p>
        ) : (
          <p>Nhận tại điểm lấy hàng</p>
        )}
      </section>
    </aside>
  );
}
