import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { api, getErrorMessage } from "@/services/api";
import type { Order, Payment, Product, ReturnRequest } from "@/types/api";
import { formatCurrency, formatDateTime, formatStatusLabel } from "@/utils/format";
import "@/styles/pages/account/order-detail-page.css";

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
  const [orderReturns, setOrderReturns] = useState<ReturnRequest[]>([]);
  const [feedback, setFeedback] = useState("");
  const [returnFeedback, setReturnFeedback] = useState("");
  const [productLookup, setProductLookup] = useState<Record<string, Product>>({});
  const [returnReason, setReturnReason] = useState("");
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnItemReasons, setReturnItemReasons] = useState<Record<string, string>>({});
  const [isLoadingReturns, setIsLoadingReturns] = useState(false);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  useEffect(() => {
    let active = true;

    if (!token) {
      return () => {
        active = false;
      };
    }

    async function loadOrderSnapshot() {
      try {
        setIsLoadingReturns(true);
        setFeedback("");
        const orderResponse = await api.getOrderById(token, orderId);
        if (!active) {
          return;
        }

        setOrder(orderResponse.data);

        const [paymentResult, returnResult] = await Promise.allSettled([
          api.listPaymentsByOrder(token, orderId),
          api.listOrderReturns(token, orderId),
        ]);

        if (!active) {
          return;
        }

        setPayments(paymentResult.status === "fulfilled" ? paymentResult.value.data : []);
        setOrderReturns(returnResult.status === "fulfilled" ? returnResult.value.data : []);
      } catch (reason) {
        if (active) {
          setFeedback(getErrorMessage(reason));
        }
      } finally {
        if (active) {
          setIsLoadingReturns(false);
        }
      }
    }

    void loadOrderSnapshot();

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

    const uniqueProductIds = Array.from(
      new Set(order.items.map((item) => item.product_id).filter(Boolean))
    );
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

  const sortedReturns = useMemo(
    () => [...orderReturns].sort((left, right) => right.created_at.localeCompare(left.created_at)),
    [orderReturns]
  );
  const returnedQuantities = useMemo(
    () => buildReturnedQuantityMap(sortedReturns),
    [sortedReturns]
  );
  const returnableItems = useMemo(
    () =>
      (order?.items ?? []).map((item) => ({
        ...item,
        remainingQuantity: Math.max(item.quantity - (returnedQuantities[item.id] ?? 0), 0),
      })),
    [order, returnedQuantities]
  );
  const hasReturnableItems = returnableItems.some((item) => item.remainingQuantity > 0);
  const canRequestReturn = order?.status === "delivered" && hasReturnableItems;

  if (!order && !feedback) {
    return <div className="page-state">Đang tải chi tiết đơn hàng...</div>;
  }

  const sortedPayments = [...payments].sort((left, right) =>
    right.created_at.localeCompare(left.created_at)
  );
  const latestPayment = confirmationState?.paymentId
    ? (sortedPayments.find((payment) => payment.id === confirmationState.paymentId) ??
      sortedPayments[0])
    : sortedPayments[0];
  const isConfirmation = confirmationState?.confirmation ?? false;

  const orderItems: OrderDisplayItem[] = order
    ? order.items.map((item) => {
        const product = productLookup[item.product_id];
        return {
          ...item,
          imageUrl: product?.image_url || product?.image_urls[0],
          subtitle: buildOrderItemSubtitle(product),
        };
      })
    : [];

  async function handleSubmitReturn() {
    if (!token || !order) {
      setReturnFeedback("Bạn cần đăng nhập để gửi yêu cầu trả hàng.");
      return;
    }

    const normalizedReason = returnReason.trim();
    const selectedItems = returnableItems
      .map((item) => ({
        order_item_id: item.id,
        quantity: Math.max(0, Math.min(item.remainingQuantity, returnQuantities[item.id] ?? 0)),
        reason: returnItemReasons[item.id]?.trim() || undefined,
      }))
      .filter((item) => item.quantity > 0);

    if (!normalizedReason) {
      setReturnFeedback("Hãy điền lý do chung cho yêu cầu trả hàng.");
      return;
    }
    if (selectedItems.length === 0) {
      setReturnFeedback("Hãy chọn ít nhất một mặt hàng và số lượng cần trả.");
      return;
    }

    try {
      setIsSubmittingReturn(true);
      const response = await api.createReturn(token, order.id, {
        reason: normalizedReason,
        items: selectedItems,
      });

      setOrderReturns((current) => [response.data, ...current]);
      setReturnReason("");
      setReturnQuantities({});
      setReturnItemReasons({});
      setReturnFeedback(`Đã tạo yêu cầu trả hàng ${response.data.id}.`);
    } catch (reason) {
      setReturnFeedback(getErrorMessage(reason));
    } finally {
      setIsSubmittingReturn(false);
    }
  }

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
                <span>
                  Your payment provider returned a hosted checkout session. You can complete it at
                  any time.
                </span>
                <a
                  className="text-link"
                  href={latestPayment.checkout_url}
                  rel="noreferrer"
                  target="_blank"
                >
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
                      {item.imageUrl ? (
                        <img alt={item.name} src={item.imageUrl} />
                      ) : (
                        <span>{item.name.slice(0, 1)}</span>
                      )}
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
                  <span>
                    {order.shipping_fee === 0
                      ? "Complimentary"
                      : formatCurrency(order.shipping_fee)}
                  </span>
                </div>
                {order.discount_amount > 0 ? (
                  <div className="order-confirmation-total-line">
                    <span>Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
                    <span>-{formatCurrency(order.discount_amount)}</span>
                  </div>
                ) : null}
                <div className="order-confirmation-total-line order-confirmation-total-line-emphasis">
                  <span>Total Paid</span>
                  <strong>{formatCurrency(order.total_price)}</strong>
                </div>
              </div>
            </section>

            <section className="order-return-portal">
              <div className="order-return-head">
                <div>
                  <span className="order-return-kicker">Aftercare portal</span>
                  <h2>Returns for this order</h2>
                  <p>
                    Yêu cầu trả hàng sẽ được đồng bộ vào khu vực account và timeline vận hành ngay
                    sau khi bạn gửi form.
                  </p>
                </div>
                <Link className="text-link" to="/returns">
                  Open full returns center
                </Link>
              </div>

              {returnFeedback ? (
                <div className="feedback feedback-info">{returnFeedback}</div>
              ) : null}

              {canRequestReturn ? (
                <div className="order-return-form-card">
                  <div className="order-return-form-head">
                    <div>
                      <strong>Request a return</strong>
                      <p>
                        Chọn các dòng hàng còn khả dụng để trả, thêm lý do tổng quát và ghi chú cho
                        từng item nếu cần.
                      </p>
                    </div>
                    <span className="status-pill status-pill-neutral">
                      {returnableItems.filter((item) => item.remainingQuantity > 0).length}{" "}
                      returnable lines
                    </span>
                  </div>

                  <label className="order-return-field">
                    <span>Overall reason</span>
                    <textarea
                      placeholder="Example: wrong size, damaged packaging, or product mismatch"
                      value={returnReason}
                      onChange={(event) => setReturnReason(event.target.value)}
                    />
                  </label>

                  <div className="order-return-line-grid">
                    {returnableItems.map((item) => (
                      <article className="order-return-line-card" key={item.id}>
                        <div className="order-return-line-copy">
                          <strong>{item.name}</strong>
                          <span>
                            Purchased {item.quantity} • Remaining returnable{" "}
                            {item.remainingQuantity}
                          </span>
                        </div>

                        <div className="order-return-line-controls">
                          <label className="order-return-field">
                            <span>Quantity</span>
                            <select
                              value={String(returnQuantities[item.id] ?? 0)}
                              onChange={(event) =>
                                setReturnQuantities((current) => ({
                                  ...current,
                                  [item.id]: Math.max(
                                    0,
                                    Math.min(
                                      item.remainingQuantity,
                                      Number.parseInt(event.target.value, 10) || 0
                                    )
                                  ),
                                }))
                              }
                            >
                              {Array.from({ length: item.remainingQuantity + 1 }, (_, index) => (
                                <option key={`${item.id}-${index}`} value={index}>
                                  {index}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="order-return-field">
                            <span>Line note</span>
                            <input
                              disabled={item.remainingQuantity === 0}
                              placeholder="Optional note for this item"
                              value={returnItemReasons[item.id] ?? ""}
                              onChange={(event) =>
                                setReturnItemReasons((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))
                              }
                            />
                          </label>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="order-return-form-actions">
                    <button
                      className="primary-button"
                      disabled={isSubmittingReturn}
                      type="button"
                      onClick={() => void handleSubmitReturn()}
                    >
                      {isSubmittingReturn ? "Submitting..." : "Request return"}
                    </button>
                    <span className="history-subtle">
                      Only delivered lines with remaining quantity can be returned.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="order-return-empty-state">
                  <strong>Return request unavailable</strong>
                  <p>
                    {order.status !== "delivered"
                      ? "Returns open after the order reaches delivered status."
                      : "All quantities from this order have already been accounted for in existing return requests."}
                  </p>
                </div>
              )}

              {isLoadingReturns ? (
                <div className="page-state">Đang tải lịch sử trả hàng của đơn này...</div>
              ) : sortedReturns.length > 0 ? (
                <div className="order-return-history">
                  {sortedReturns.map((returnRequest) => (
                    <article
                      className="history-card order-return-history-card"
                      key={returnRequest.id}
                    >
                      <div className="history-card-head">
                        <div>
                          <p className="history-kicker">Return request</p>
                          <h3>{returnRequest.id}</h3>
                          <p className="history-subtle">
                            Created {formatDateTime(returnRequest.created_at)}
                          </p>
                        </div>

                        <span className={getReturnStatusClassName(returnRequest.status)}>
                          {formatStatusLabel(returnRequest.status)}
                        </span>
                      </div>

                      <div className="history-meta-grid">
                        <div>
                          <span>Main reason</span>
                          <strong>{returnRequest.reason}</strong>
                        </div>
                        <div>
                          <span>Refund</span>
                          <strong>{buildReturnRefundCopy(returnRequest)}</strong>
                        </div>
                        <div>
                          <span>Attempts</span>
                          <strong>{returnRequest.refund_attempt_count ?? 0}</strong>
                        </div>
                        <div>
                          <span>Last update</span>
                          <strong>
                            {returnRequest.events.length
                              ? formatDateTime(
                                  returnRequest.events[returnRequest.events.length - 1].created_at
                                )
                              : formatDateTime(returnRequest.updated_at)}
                          </strong>
                        </div>
                      </div>

                      <div className="order-return-history-grid">
                        <div className="order-return-history-subcard">
                          <div className="history-line">
                            <strong>Return items</strong>
                            <span className="history-subtle">
                              {returnRequest.items.length} lines
                            </span>
                          </div>

                          <div className="order-return-line-list">
                            {returnRequest.items.map((item) => (
                              <div className="history-item-preview" key={item.id}>
                                <strong>{item.product_id}</strong>
                                <span>
                                  Order item {item.order_item_id} • Quantity {item.quantity}
                                </span>
                                <span>{item.reason || "No item-level note."}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="order-return-history-subcard">
                          <div className="history-line">
                            <strong>Timeline</strong>
                            <span className="history-subtle">
                              {returnRequest.events.length} milestones
                            </span>
                          </div>

                          <div className="order-return-event-list">
                            {returnRequest.events.map((event) => (
                              <div className="order-return-event" key={event.id}>
                                <strong>{formatStatusLabel(event.status)}</strong>
                                <span>{event.message}</span>
                                <span className="history-subtle">
                                  {event.actor_role || "system"} •{" "}
                                  {formatDateTime(event.created_at)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {returnRequest.refund_last_error ? (
                        <div className="feedback feedback-warning order-return-warning" role="note">
                          <strong>Last refund attempt did not complete.</strong>
                          <span>{returnRequest.refund_last_error}</span>
                          {returnRequest.refund_next_retry_at ? (
                            <span>
                              Next retry at {formatDateTime(returnRequest.refund_next_retry_at)}.
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      <Link className="text-link" to={`/returns/${returnRequest.id}`}>
                        View return detail
                      </Link>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="order-return-empty-state">
                  <strong>No return requests yet</strong>
                  <p>
                    Once you submit a request for this order, the full timeline will appear here.
                  </p>
                </div>
              )}
            </section>

            <div className="order-confirmation-actions">
              <Link className="primary-button order-confirmation-primary" to="/myorders">
                View Order History
              </Link>
              <Link className="order-confirmation-secondary-link" to="/returns">
                Open Returns Center
              </Link>
              <Link className="order-confirmation-secondary-link" to="/products">
                Back to Shop
              </Link>
            </div>

            <section className="order-confirmation-join-card">
              <span className="order-confirmation-badge">Dev Only: Beta Feature</span>
              <h3>Join the Inner Circle</h3>
              <p>
                Track your delivery in real-time and get exclusive early access to our next ND Shop
                release.
              </p>

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

function buildReturnedQuantityMap(returnRequests: ReturnRequest[]) {
  return returnRequests.reduce<Record<string, number>>((result, returnRequest) => {
    if (isIgnoredReturnStatus(returnRequest.status)) {
      return result;
    }

    returnRequest.items.forEach((item) => {
      result[item.order_item_id] = (result[item.order_item_id] ?? 0) + item.quantity;
    });
    return result;
  }, {});
}

function isIgnoredReturnStatus(status: string) {
  return status === "rejected" || status === "cancelled";
}

function buildReturnRefundCopy(returnRequest: ReturnRequest) {
  if (typeof returnRequest.refund_amount !== "number") {
    return "Pending review";
  }

  if (returnRequest.status === "refunded") {
    return formatCurrency(returnRequest.refund_amount);
  }
  if (returnRequest.status === "refund_pending") {
    return `${formatCurrency(returnRequest.refund_amount)} queued`;
  }

  return `${formatCurrency(returnRequest.refund_amount)} est.`;
}

function getReturnStatusClassName(status: string) {
  switch (status) {
    case "approved":
    case "received":
    case "refunded":
      return "status-pill status-pill-success";
    case "refund_pending":
      return "status-pill status-pill-warning";
    case "rejected":
    case "cancelled":
      return "status-pill status-pill-danger";
    default:
      return "status-pill status-pill-neutral";
  }
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

  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
  }).format(start);
  const endLabel = sameMonth
    ? `${new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(end)}, ${end.getFullYear()}`
    : new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(end);

  return `${startLabel} — ${endLabel}`;
}
