import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  FileImage,
  PackageCheck,
  RotateCcw,
  ShoppingCart,
  Star,
  Trash2,
  Truck,
  Upload,
  XCircle,
} from "lucide-react";
import { EmptyView, ErrorView, LoadingView } from "../components/status-view";
import { ApiError } from "../services/http";
import {
  cancelOrder,
  createReturnRequest,
  getOrder,
  getOrderTimeline,
  getReturnEligibility,
  getShipmentTracking,
  listOrderReturns,
  uploadReturnEvidence,
} from "../services/order-service";
import { listPaymentsByOrder } from "../services/payment-service";
import {
  createProductReview,
  deleteMyProductReview,
  getMyProductReview,
  updateMyProductReview,
} from "../services/product-service";
import { useAuth } from "../state/auth-context";
import { useCart } from "../state/cart-context";
import type {
  Order,
  OrderEvent,
  Payment,
  ProductReview,
  ReturnEligibilitySnapshot,
  ReturnRequest,
  ShipmentTracking,
} from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";

type ReturnLineDraft = {
  selected: boolean;
  quantity: number;
  reason: string;
};

type ReviewDraft = {
  rating: number;
  comment: string;
  existing: ProductReview | null;
  submitting: boolean;
  error: string | null;
  status: string | null;
};

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    pending: "Chờ xử lý",
    paid: "Đã thanh toán",
    shipped: "Đang giao",
    delivered: "Đã giao",
    cancelled: "Đã hủy",
    refunded: "Đã hoàn tiền",
    completed: "Hoàn tất",
    failed: "Thất bại",
    requested: "Đã gửi yêu cầu",
    approved: "Đã duyệt",
    rejected: "Từ chối",
    received: "Đã nhận hàng trả",
    refund_pending: "Đang hoàn tiền",
    in_transit: "Đang vận chuyển",
    out_for_delivery: "Đang giao hôm nay",
    exception: "Cần kiểm tra",
  };

  return labels[value] ?? value;
}

function isPositiveStatus(value: string) {
  return ["paid", "shipped", "delivered", "completed", "approved", "refunded"].includes(value);
}

function initialReturnDraft(snapshot: ReturnEligibilitySnapshot | null) {
  return Object.fromEntries(
    (snapshot?.items ?? []).map((item) => [
      item.order_item_id,
      {
        selected: false,
        quantity: Math.min(1, Math.max(0, item.remaining_quantity)),
        reason: "",
      },
    ]),
  ) as Record<string, ReturnLineDraft>;
}

function buildReviewDraft(review: ProductReview | null): ReviewDraft {
  return {
    rating: review?.rating ?? 5,
    comment: review?.comment ?? "",
    existing: review,
    submitting: false,
    error: null,
    status: null,
  };
}

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
  const [returnDrafts, setReturnDrafts] = useState<Record<string, ReturnLineDraft>>({});
  const [returnReason, setReturnReason] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<Record<string, File | null>>({});
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [loading, setLoading] = useState(true);
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [uploadingReturnId, setUploadingReturnId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const canCancel = order?.status === "pending";
  const isDelivered = order?.status === "delivered";
  const eligibleReturnItems = useMemo(
    () => (eligibility?.items ?? []).filter((item) => item.eligible && item.remaining_quantity > 0),
    [eligibility],
  );
  const selectedReturnCount = Object.values(returnDrafts).filter((item) => item.selected).length;

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
        setReturnDrafts(initialReturnDraft(eligibilityData));

        if (orderData.status === "delivered") {
          const productIds = Array.from(new Set(orderData.items.map((item) => item.product_id)));
          const drafts = await Promise.all(
            productIds.map(async (productId) => {
              try {
                const review = await getMyProductReview(token, productId);
                return [productId, buildReviewDraft(review)] as const;
              } catch (err) {
                if (err instanceof ApiError && err.status === 404) {
                  return [productId, buildReviewDraft(null)] as const;
                }
                return [
                  productId,
                  {
                    ...buildReviewDraft(null),
                    error: err instanceof Error ? err.message : "Không tải được review",
                  },
                ] as const;
              }
            }),
          );
          if (active) {
            setReviewDrafts(Object.fromEntries(drafts));
          }
        } else {
          setReviewDrafts({});
        }
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
    setReturnDrafts(initialReturnDraft(eligibilityData));
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

  function updateReturnDraft(orderItemId: string, patch: Partial<ReturnLineDraft>) {
    setReturnDrafts((current) => ({
      ...current,
      [orderItemId]: {
        ...(current[orderItemId] ?? { selected: false, quantity: 1, reason: "" }),
        ...patch,
      },
    }));
  }

  async function submitReturn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !order) {
      return;
    }

    const selectedItems = eligibleReturnItems
      .map((item) => ({ item, draft: returnDrafts[item.order_item_id] }))
      .filter(({ draft }) => draft?.selected)
      .map(({ item, draft }) => ({
        order_item_id: item.order_item_id,
        quantity: Math.min(Math.max(1, draft.quantity), item.remaining_quantity),
        reason: draft.reason.trim() || undefined,
      }));

    if (returnReason.trim().length < 5) {
      setActionError("Lý do trả hàng cần ít nhất 5 ký tự");
      return;
    }
    if (selectedItems.length === 0) {
      setActionError("Chọn ít nhất một sản phẩm đã giao");
      return;
    }

    try {
      setSubmittingReturn(true);
      setActionError(null);
      await createReturnRequest(token, order.id, {
        reason: returnReason.trim(),
        items: selectedItems,
      });
      setReturnReason("");
      await refreshReturnState();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Không tạo được yêu cầu trả hàng");
    } finally {
      setSubmittingReturn(false);
    }
  }

  async function submitEvidence(returnId: string) {
    const file = evidenceFiles[returnId];
    if (!token || !file) {
      return;
    }

    try {
      setUploadingReturnId(returnId);
      setActionError(null);
      const updatedReturn = await uploadReturnEvidence(token, returnId, file);
      setReturns((current) => current.map((item) => (item.id === returnId ? updatedReturn : item)));
      setEvidenceFiles((current) => ({ ...current, [returnId]: null }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Không tải được bằng chứng");
    } finally {
      setUploadingReturnId(null);
    }
  }

  function updateReviewDraft(productId: string, patch: Partial<ReviewDraft>) {
    setReviewDrafts((current) => ({
      ...current,
      [productId]: {
        ...(current[productId] ?? buildReviewDraft(null)),
        ...patch,
      },
    }));
  }

  async function saveReview(productId: string) {
    if (!token) {
      return;
    }

    const draft = reviewDrafts[productId] ?? buildReviewDraft(null);
    try {
      updateReviewDraft(productId, { submitting: true, error: null, status: null });
      const payload = { rating: draft.rating, comment: draft.comment.trim() };
      const saved = draft.existing
        ? await updateMyProductReview(token, productId, payload)
        : await createProductReview(token, productId, payload);
      updateReviewDraft(productId, {
        existing: saved,
        rating: saved.rating,
        comment: saved.comment,
        submitting: false,
        status: draft.existing ? "Đã cập nhật review" : "Đã gửi review",
      });
    } catch (err) {
      updateReviewDraft(productId, {
        submitting: false,
        error: err instanceof Error ? err.message : "Không lưu được review",
      });
    }
  }

  async function removeReview(productId: string) {
    if (!token || !reviewDrafts[productId]?.existing) {
      return;
    }

    try {
      updateReviewDraft(productId, { submitting: true, error: null, status: null });
      await deleteMyProductReview(token, productId);
      updateReviewDraft(productId, {
        ...buildReviewDraft(null),
        status: "Đã xóa review",
      });
    } catch (err) {
      updateReviewDraft(productId, {
        submitting: false,
        error: err instanceof Error ? err.message : "Không xóa được review",
      });
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

          <section className="surface-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Returns</span>
                <h2>Trả hàng/hoàn tiền</h2>
                <p>
                  {eligibility?.eligible
                    ? `Còn hạn trả hàng đến ${
                        eligibility.return_window_expires_at
                          ? formatDate(eligibility.return_window_expires_at)
                          : "theo chính sách"
                      }`
                    : (eligibility?.reason ?? "Đơn hàng chưa đủ điều kiện trả hàng")}
                </p>
              </div>
              <RotateCcw size={24} />
            </div>

            {eligibleReturnItems.length > 0 ? (
              <form className="return-form" onSubmit={submitReturn}>
                <label>
                  Lý do chung
                  <textarea
                    value={returnReason}
                    onChange={(event) => setReturnReason(event.target.value)}
                    placeholder="Nhập lý do trả hàng"
                    rows={3}
                  />
                </label>
                <div className="return-item-list">
                  {eligibility?.items.map((item) => {
                    const draft = returnDrafts[item.order_item_id] ?? {
                      selected: false,
                      quantity: 1,
                      reason: "",
                    };
                    return (
                      <article key={item.order_item_id} className="return-item-card">
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={draft.selected}
                            disabled={!item.eligible || item.remaining_quantity <= 0}
                            onChange={(event) =>
                              updateReturnDraft(item.order_item_id, {
                                selected: event.target.checked,
                              })
                            }
                          />
                          <span>{item.product_name}</span>
                        </label>
                        <p>
                          Còn có thể trả: {item.remaining_quantity}/{item.ordered_quantity}
                          {item.reason ? ` - ${item.reason}` : ""}
                        </p>
                        <div className="return-item-card__controls">
                          <input
                            type="number"
                            min={1}
                            max={Math.max(1, item.remaining_quantity)}
                            value={draft.quantity}
                            disabled={!draft.selected}
                            onChange={(event) =>
                              updateReturnDraft(item.order_item_id, {
                                quantity: Number(event.target.value),
                              })
                            }
                          />
                          <input
                            value={draft.reason}
                            disabled={!draft.selected}
                            placeholder="Lý do riêng cho sản phẩm"
                            onChange={(event) =>
                              updateReturnDraft(item.order_item_id, {
                                reason: event.target.value,
                              })
                            }
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
                <button
                  className="button button--primary"
                  type="submit"
                  disabled={submittingReturn || selectedReturnCount === 0}
                >
                  {submittingReturn ? "Đang gửi yêu cầu" : "Gửi yêu cầu trả hàng"}
                </button>
              </form>
            ) : (
              <p className="muted-text">Không có sản phẩm nào đủ điều kiện trả hàng lúc này.</p>
            )}

            {returns.length > 0 ? (
              <div className="return-history">
                {returns.map((returnRequest) => (
                  <article key={returnRequest.id} className="return-history-card">
                    <div className="return-history-card__heading">
                      <div>
                        <strong>{returnRequest.id}</strong>
                        <p>{returnRequest.reason}</p>
                      </div>
                      <span
                        className={`status-pill${
                          isPositiveStatus(returnRequest.status) ? " is-good" : ""
                        }`}
                      >
                        {statusLabel(returnRequest.status)}
                      </span>
                    </div>
                    {returnRequest.evidence && returnRequest.evidence.length > 0 ? (
                      <div className="evidence-list">
                        {returnRequest.evidence.map((evidence) => (
                          <a key={evidence.id} href={evidence.url} target="_blank" rel="noreferrer">
                            <FileImage size={15} />
                            {evidence.file_name}
                          </a>
                        ))}
                      </div>
                    ) : null}
                    <div className="evidence-upload">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) =>
                          setEvidenceFiles((current) => ({
                            ...current,
                            [returnRequest.id]: event.target.files?.[0] ?? null,
                          }))
                        }
                      />
                      <button
                        className="button button--secondary"
                        type="button"
                        disabled={
                          !evidenceFiles[returnRequest.id] || uploadingReturnId === returnRequest.id
                        }
                        onClick={() => void submitEvidence(returnRequest.id)}
                      >
                        <Upload size={16} />
                        {uploadingReturnId === returnRequest.id ? "Đang tải" : "Tải bằng chứng"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          {isDelivered ? (
            <section className="surface-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Reviews</span>
                  <h2>Đánh giá sau mua</h2>
                </div>
                <PackageCheck size={24} />
              </div>
              <div className="review-editor-list">
                {order.items.map((item) => {
                  const draft = reviewDrafts[item.product_id] ?? buildReviewDraft(null);
                  return (
                    <article key={item.id} className="review-editor-card">
                      <div className="review-editor-card__heading">
                        <div>
                          <Link to={`/products/${item.product_id}`}>{item.name}</Link>
                          <p>{draft.existing ? "Đã có review" : "Chưa đánh giá"}</p>
                        </div>
                        {draft.existing ? (
                          <button
                            className="icon-button"
                            type="button"
                            disabled={draft.submitting}
                            onClick={() => void removeReview(item.product_id)}
                            aria-label="Xóa review"
                          >
                            <Trash2 size={17} />
                          </button>
                        ) : null}
                      </div>
                      <div className="rating-control" aria-label="Chọn số sao">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            className={rating <= draft.rating ? "is-active" : ""}
                            onClick={() => updateReviewDraft(item.product_id, { rating })}
                            aria-label={`${rating} sao`}
                          >
                            <Star size={19} fill="currentColor" />
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={draft.comment}
                        rows={3}
                        maxLength={2000}
                        placeholder="Chia sẻ trải nghiệm sản phẩm"
                        onChange={(event) =>
                          updateReviewDraft(item.product_id, { comment: event.target.value })
                        }
                      />
                      {draft.error ? <p className="inline-error">{draft.error}</p> : null}
                      {draft.status ? <p className="inline-success">{draft.status}</p> : null}
                      <button
                        className="button button--primary"
                        type="button"
                        disabled={draft.submitting}
                        onClick={() => void saveReview(item.product_id)}
                      >
                        {draft.submitting
                          ? "Đang lưu"
                          : draft.existing
                            ? "Cập nhật review"
                            : "Gửi review"}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

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
              {(timeline.length > 0
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
                  ]
              ).map((event) => (
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
      </section>
    </div>
  );
}
