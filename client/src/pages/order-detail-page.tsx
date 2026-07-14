import { ArrowLeft, ShoppingCart, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyView, ErrorView, LoadingView } from "../components/status-view";
import {
  cancelOrder,
  getOrder,
  getOrderTimeline,
  getReturnEligibility,
  getShipmentTracking,
  listOrderReturns,
} from "../services/order-service";
import { listPaymentsByOrder } from "../services/payment-service";
import { useAuth } from "../state/auth-context";
import { useCart } from "../state/cart-context";
import type {
  Order,
  OrderEvent,
  Payment,
  ReturnEligibilitySnapshot,
  ReturnRequest,
  ShipmentTracking,
} from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";
import { isPositiveStatus, statusLabel } from "../utils/status";
import { OrderSidebar } from "./order/order-sidebar";
import { ReturnsSection } from "./order/returns-section";
import { ReviewsSection } from "./order/reviews-section";

/**
 * Chi tiết đơn hàng: nạp order + timeline + payment history + tracking +
 * return state trong một lượt, rồi giao phần trả hàng cho ReturnsSection,
 * đánh giá sau mua cho ReviewsSection và cột tóm tắt cho OrderSidebar.
 */
export function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { addItem } = useCart();
  const [order, setOrder] = useState<Order | null>(null);
  const [timeline, setTimeline] = useState<OrderEvent[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tracking, setTracking] = useState<ShipmentTracking | null>(null);
  const [eligibility, setEligibility] = useState<ReturnEligibilitySnapshot | null>(null);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const canCancel = order?.status === "pending";
  const isDelivered = order?.status === "delivered";

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      if (!token || !id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const [orderData, timelineData, paymentData, trackingData, eligibilityData, returnData] =
          await Promise.all([
            getOrder(token, id),
            getOrderTimeline(token, id).catch(() => []),
            listPaymentsByOrder(token, id).catch(() => []),
            getShipmentTracking(token, id).catch(() => null),
            getReturnEligibility(token, id).catch(() => null),
            listOrderReturns(token, id).catch(() => []),
          ]);

        if (!active) {
          return;
        }

        setOrder(orderData);
        setTimeline(timelineData);
        setPayments(paymentData);
        setTracking(trackingData);
        setEligibility(eligibilityData);
        setReturns(returnData);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Không tải được chi tiết đơn hàng");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      active = false;
    };
  }, [id, token]);

  async function refreshReturnState() {
    if (!token || !id) {
      return;
    }

    const [eligibilityData, returnData] = await Promise.all([
      getReturnEligibility(token, id).catch(() => null),
      listOrderReturns(token, id).catch(() => []),
    ]);
    setEligibility(eligibilityData);
    setReturns(returnData);
  }

  async function handleCancelOrder() {
    if (!token || !order || !window.confirm("Hủy đơn hàng này?")) {
      return;
    }

    try {
      setCancelling(true);
      setActionError(null);
      await cancelOrder(token, order.id);
      const [orderData, timelineData] = await Promise.all([
        getOrder(token, order.id),
        getOrderTimeline(token, order.id).catch(() => []),
      ]);
      setOrder(orderData);
      setTimeline(timelineData);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Không hủy được đơn hàng");
    } finally {
      setCancelling(false);
    }
  }

  async function handleReorder() {
    if (!order) {
      return;
    }

    try {
      setReordering(true);
      setActionError(null);
      setActionStatus(null);
      for (const item of order.items) {
        await addItem(item.product_id, item.quantity);
      }
      setActionStatus("Đã thêm lại sản phẩm vào giỏ hàng");
      navigate("/cart");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Không thêm lại được sản phẩm");
    } finally {
      setReordering(false);
    }
  }

  if (!token) {
    return (
      <EmptyView title="Cần đăng nhập">
        <Link to="/account">Đăng nhập để xem đơn hàng</Link>
      </EmptyView>
    );
  }

  if (loading) {
    return <LoadingView label="Đang tải chi tiết đơn hàng" />;
  }

  if (error || !order) {
    return <ErrorView message={error ?? "Không tìm thấy đơn hàng"} />;
  }

  return (
    <div className="page-stack">
      <Link to="/account#orders" className="text-link">
        <ArrowLeft size={16} />
        Quay lại tài khoản
      </Link>

      <section className="order-detail-hero">
        <div>
          <span className="eyebrow">Order detail</span>
          <h1>{order.id}</h1>
          <p>Đặt lúc {formatDate(order.created_at)}</p>
        </div>
        <div className="order-detail-hero__actions">
          <span className={`status-pill${isPositiveStatus(order.status) ? " is-good" : ""}`}>
            {statusLabel(order.status)}
          </span>
          <button
            className="button button--primary"
            type="button"
            disabled={reordering}
            onClick={() => void handleReorder()}
          >
            <ShoppingCart size={17} />
            {reordering ? "Đang thêm" : "Mua lại"}
          </button>
          {canCancel ? (
            <button
              className="button button--secondary"
              type="button"
              disabled={cancelling}
              onClick={() => void handleCancelOrder()}
            >
              <XCircle size={17} />
              {cancelling ? "Đang hủy" : "Hủy đơn"}
            </button>
          ) : null}
        </div>
      </section>

      {actionError ? <p className="inline-error">{actionError}</p> : null}
      {actionStatus ? <p className="inline-success">{actionStatus}</p> : null}

      <section className="order-detail-layout">
        <div className="order-detail-main">
          <section className="surface-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Items</span>
                <h2>Sản phẩm trong đơn</h2>
              </div>
              <strong>{formatCurrency(order.total_price)}</strong>
            </div>
            <div className="order-item-list">
              {order.items.map((item) => (
                <article key={item.id} className="order-item-row">
                  <div>
                    <Link to={`/products/${item.product_id}`}>{item.name}</Link>
                    <p>
                      {item.quantity} x {formatCurrency(item.price)}
                    </p>
                  </div>
                  <strong>{formatCurrency(item.price * item.quantity)}</strong>
                </article>
              ))}
            </div>
          </section>

          <ReturnsSection
            orderId={order.id}
            eligibility={eligibility}
            returns={returns}
            setReturns={setReturns}
            onRefresh={refreshReturnState}
            onError={setActionError}
          />

          {isDelivered ? <ReviewsSection order={order} /> : null}
        </div>

        <OrderSidebar order={order} timeline={timeline} payments={payments} tracking={tracking} />
      </section>
    </div>
  );
}
