import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { api, getErrorMessage } from "../lib/api";
import type { Order, Payment, Product } from "../types/api";
import { formatCurrency } from "../utils/format";
import "./OrderDetailPage.css";

type ConfirmationLocationState = {
  confirmation?: boolean;
  paymentId?: string;
};

type OrderDisplayItem = {
  id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  subtitle: string;
};

export function OrderDetailPage() {
  const { token } = useAuth();
  const { orderId = "" } = useParams();
  const location = useLocation();
  const confirmationState = (location.state as ConfirmationLocationState | null) ?? null;

  const [order, setOrder] = useState<Order | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [feedback, setFeedback] = useState("");
  const [productLookup, setProductLookup] = useState<Record<string, Product>>({});

  useEffect(() => {
    let active = true;

    if (!token) {
      return () => {
        active = false;
      };
    }

    void api
      .getOrderById(token, orderId)
      .then(async (response) => {
        if (!active) {
          return;
        }

        setOrder(response.data);

        try {
          const paymentResponse = await api.listPaymentsByOrder(token, orderId);
          if (active) {
            setPayments(paymentResponse.data);
          }
        } catch {
          if (active) {
            setPayments([]);
          }
        }
      })
      .catch((reason) => {
        if (active) {
          setFeedback(getErrorMessage(reason));
        }
      });

    return () => {
      active = false;
    };
  }, [orderId, token]);

  useEffect(() => {
    let active = true;

    if (!order) {
      setProductLookup({});
      return () => {
        active = false;
      };
    }

    const uniqueProductIds = Array.from(new Set(order.items.map((item) => item.product_id).filter(Boolean)));
    if (uniqueProductIds.length === 0) {
      setProductLookup({});
      return () => {
        active = false;
      };
    }

    void Promise.all(
      uniqueProductIds.map((productId) =>
        api
          .getProductById(productId)
          .then((response) => [productId, response.data] as const)
          .catch(() => [productId, null] as const)
      )
    ).then((entries) => {
      if (!active) {
        return;
      }

      const nextLookup: Record<string, Product> = {};
      entries.forEach(([productId, product]) => {
        if (product) {
          nextLookup[productId] = product;
        }
      });
      setProductLookup(nextLookup);
    });

    return () => {
      active = false;
    };
  }, [order]);

  if (!order && !feedback) {
    return <div className="page-state">Đang tải chi tiết đơn hàng...</div>;
  }

  const sortedPayments = [...payments].sort((left, right) => right.created_at.localeCompare(left.created_at));
  const latestPayment = confirmationState?.paymentId
    ? sortedPayments.find((payment) => payment.id === confirmationState.paymentId) ?? sortedPayments[0]
    : sortedPayments[0];
  const isConfirmation = confirmationState?.confirmation ?? false;

  const orderItems: OrderDisplayItem[] = order
    ? order.items.map((item) => {
        const product = productLookup[item.product_id];
        return {
          ...item,
          imageUrl: product?.image_url || product?.image_urls[0],
          subtitle: buildOrderItemSubtitle(product)
        };
      })
    : [];

  return (
    <div className="page-stack order-confirmation-page">
      <section className="content-section order-confirmation-shell">
        {feedback ? <div className="feedback feedback-error">{feedback}</div> : null}

        {order ? (
          <>
            <div className="order-confirmation-hero">
              <div className="order-confirmation-icon" aria-hidden="true">
                <span className="order-confirmation-check" />
              </div>

              <h1>{isConfirmation ? "Thank You" : "Order Details"}</h1>
              <p>
                {isConfirmation
                  ? "Your order has been placed successfully and is now being prepared with care in our atelier."
                  : "Review your latest order snapshot, payment status and shipping details in one place."}
              </p>
            </div>

            {latestPayment?.checkout_url ? (
              <div className="coupon-preview-card order-confirmation-payment-note">
                <strong>External payment step available</strong>
                <span>Your payment provider returned a hosted checkout session. You can complete it at any time.</span>
                <a className="text-link" href={latestPayment.checkout_url} rel="noreferrer" target="_blank">
                  Open payment checkout
                </a>
              </div>
            ) : null}

            <div className="order-confirmation-meta-grid">
              <article className="order-confirmation-meta-card">
                <span>Order Number</span>
                <strong>#{order.id}</strong>

                <span className="order-confirmation-meta-label">Estimated Arrival</span>
                <strong>{formatArrivalWindow(order.created_at)}</strong>
              </article>

              <article className="order-confirmation-meta-card">
                <span>Shipping To</span>
                {order.shipping_address ? (
                  <address>
                    <strong>{order.shipping_address.recipient_name}</strong>
                    <span>{order.shipping_address.street}</span>
                    <span>
                      {[order.shipping_address.ward, order.shipping_address.district, order.shipping_address.city]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                    <span>{order.shipping_address.phone}</span>
                  </address>
                ) : (
                  <p>Pickup order. Shipping address was not required for this order.</p>
                )}
              </article>
            </div>

            <section className="order-confirmation-summary">
              <h2>Order Summary</h2>

              <div className="order-confirmation-items">
                {orderItems.map((item) => (
                  <article className="order-confirmation-item" key={item.id}>
                    <div className="order-confirmation-thumb">
                      {item.imageUrl ? <img alt={item.name} src={item.imageUrl} /> : <span>{item.name.slice(0, 1)}</span>}
                    </div>

                    <div className="order-confirmation-item-copy">
                      <h3>{item.name}</h3>
                      <p>{item.subtitle}</p>
                      <div className="order-confirmation-item-meta">
                        <span>Quantity: {item.quantity}</span>
                        <strong>{formatCurrency(item.price * item.quantity)}</strong>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="order-confirmation-total-block">
                <div className="order-confirmation-total-line">
                  <span>Subtotal</span>
                  <span>{formatCurrency(order.subtotal_price)}</span>
                </div>
                <div className="order-confirmation-total-line">
                  <span>Shipping</span>
                  <span>{order.shipping_fee === 0 ? "Complimentary" : formatCurrency(order.shipping_fee)}</span>
                </div>
                {order.discount_amount > 0 ? (
                  <div className="order-confirmation-total-line">
                    <span>Discount</span>
                    <span>-{formatCurrency(order.discount_amount)}</span>
                  </div>
                ) : null}
                <div className="order-confirmation-total-line order-confirmation-total-line-emphasis">
                  <span>Total Paid</span>
                  <strong>{formatCurrency(order.total_price)}</strong>
                </div>
              </div>
            </section>

            <div className="order-confirmation-actions">
              <Link className="primary-button order-confirmation-primary" to="/profile">
                View Order History
              </Link>
              <Link className="order-confirmation-secondary-link" to="/products">
                Back to Shop
              </Link>
            </div>

            <section className="order-confirmation-join-card">
              <span className="order-confirmation-badge">Dev Only: Beta Feature</span>
              <h3>Join the Inner Circle</h3>
              <p>Track your delivery in real-time and get exclusive early access to our next ND Shop release.</p>

              <div className="order-confirmation-join-form">
                <input placeholder="Enter your email" type="email" />
                <button type="button">Join</button>
              </div>
            </section>
          </>
        ) : null}
      </section>
    </div>
  );
}

function buildOrderItemSubtitle(product?: Product) {
  if (!product) {
    return "Curated atelier piece";
  }

  const subtitle = [product.category, product.brand].filter(Boolean).join(" / ");
  return subtitle || "Editorial selection";
}

function formatArrivalWindow(createdAt: string) {
  const baseDate = new Date(createdAt);
  if (Number.isNaN(baseDate.getTime())) {
    return "Preparing delivery window";
  }

  const start = new Date(baseDate);
  const end = new Date(baseDate);
  start.setDate(start.getDate() + 3);
  end.setDate(end.getDate() + 6);

  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric"
  }).format(start);
  const endLabel = sameMonth
    ? `${new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(end)}, ${end.getFullYear()}`
    : new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      }).format(end);

  return `${startLabel} — ${endLabel}`;
}
