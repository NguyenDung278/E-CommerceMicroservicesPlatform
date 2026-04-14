import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { AccountPageLayout } from "@/features/account/components/account-page-layout";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { api, getErrorMessage } from "@/services/api";
import type { ApiMeta, ReturnRequest } from "@/types/api";
import { formatCurrency, formatDateTime, formatStatusLabel } from "@/utils/format";
import "@/styles/pages/account/returns-page.css";

const userReturnPageSize = 6;

const returnStatusOptions = [
  { value: "all", label: "All statuses" },
  { value: "requested", label: "Requested" },
  { value: "approved", label: "Approved" },
  { value: "received", label: "Received" },
  { value: "refund_pending", label: "Refund pending" },
  { value: "refunded", label: "Refunded" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export function ReturnsPage() {
  const { token } = useAuth();
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [queryDraft, setQueryDraft] = useState("");
  const [meta, setMeta] = useState<ApiMeta>({
    page: 1,
    limit: userReturnPageSize,
    total: 0,
  });

  useEffect(() => {
    let active = true;

    if (!token) {
      return () => {
        active = false;
      };
    }

    async function loadReturns() {
      try {
        setIsLoading(true);
        const response = await api.listReturns(token, {
          page,
          limit: userReturnPageSize,
          query: query || undefined,
          status: selectedStatus === "all" ? undefined : selectedStatus,
        });

        if (!active) {
          return;
        }

        const total = response.meta?.total ?? 0;
        if (page > 1 && response.data.length === 0 && total > 0) {
          setPage(page - 1);
          return;
        }

        setReturns(response.data);
        setMeta({
          page: response.meta?.page ?? page,
          limit: response.meta?.limit ?? userReturnPageSize,
          total,
        });
        setFeedback("");
      } catch (reason) {
        if (active) {
          setFeedback(getErrorMessage(reason));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadReturns();

    return () => {
      active = false;
    };
  }, [page, query, selectedStatus, token]);

  const totalPages = Math.max(1, Math.ceil((meta.total ?? 0) / Math.max(meta.limit ?? 1, 1)));
  const visibleRangeStart =
    returns.length === 0 ? 0 : ((meta.page ?? page) - 1) * (meta.limit ?? userReturnPageSize) + 1;
  const visibleRangeEnd =
    returns.length === 0 ? 0 : visibleRangeStart + Math.max(returns.length - 1, 0);

  const stats = useMemo(() => {
    const activeCount = returns.filter((item) =>
      ["requested", "approved", "received", "refund_pending"].includes(item.status)
    ).length;
    const refundedCount = returns.filter((item) => item.status === "refunded").length;
    const waitingRetryCount = returns.filter((item) => item.status === "refund_pending").length;

    return {
      activeCount,
      refundedCount,
      waitingRetryCount,
    };
  }, [returns]);

  function handleSubmitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = queryDraft.trim();
    setPage(1);
    setQuery(nextQuery);
  }

  function handleResetFilters() {
    setPage(1);
    setSelectedStatus("all");
    setQuery("");
    setQueryDraft("");
  }

  return (
    <AccountPageLayout>
      <div className="returns-route">
        <header className="returns-route-head">
          <div>
            <p className="returns-route-kicker">Post-purchase care</p>
            <h1>Returns & Refunds</h1>
            <p>
              Theo dõi yêu cầu trả hàng, tiến trình hoàn tiền và lịch sử xử lý của từng đơn ngay
              trong khu vực tài khoản.
            </p>
          </div>

          <div className="returns-route-stat-grid">
            <article className="returns-route-stat-card">
              <span>Open cases</span>
              <strong>{stats.activeCount}</strong>
            </article>
            <article className="returns-route-stat-card">
              <span>Refunded</span>
              <strong>{stats.refundedCount}</strong>
            </article>
            <article className="returns-route-stat-card">
              <span>Waiting retry</span>
              <strong>{stats.waitingRetryCount}</strong>
            </article>
          </div>
        </header>

        <form className="returns-route-filter-form" onSubmit={handleSubmitFilters}>
          <label className="returns-route-filter-field">
            <span>Search return or order</span>
            <input
              name="return-query"
              placeholder="Ex: return-1 or order-1"
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
            />
          </label>

          <label className="returns-route-filter-field">
            <span>Status</span>
            <select
              value={selectedStatus}
              onChange={(event) => {
                setSelectedStatus(event.target.value);
                setPage(1);
              }}
            >
              {returnStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="returns-route-filter-actions">
            <button className="ghost-button" type="submit">
              Apply
            </button>
            <button className="ghost-button" type="button" onClick={handleResetFilters}>
              Reset
            </button>
          </div>
        </form>

        <div className="returns-route-toolbar">
          <p className="history-subtle">
            Showing {visibleRangeStart}-{visibleRangeEnd} of {meta.total ?? 0} returns.
          </p>

          <div className="returns-route-pagination">
            <button
              className="ghost-button"
              disabled={(meta.page ?? page) <= 1}
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <span>
              Page {meta.page ?? page}/{totalPages}
            </span>
            <button
              className="ghost-button"
              disabled={(meta.page ?? page) >= totalPages}
              type="button"
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>

        {feedback ? <div className="feedback feedback-error">{feedback}</div> : null}

        {isLoading ? (
          <div className="page-state">Đang tải yêu cầu trả hàng...</div>
        ) : returns.length === 0 ? (
          <div className="empty-card history-empty returns-route-empty">
            <h3>No returns found</h3>
            <p>
              Khi bạn tạo yêu cầu trả hàng từ trang chi tiết đơn, chúng sẽ xuất hiện ở đây cùng
              timeline xử lý.
            </p>
            <Link className="primary-button" to="/myorders">
              Review your orders
            </Link>
          </div>
        ) : (
          <div className="returns-route-list">
            {returns.map((returnRequest) => {
              const latestEvent = returnRequest.events[returnRequest.events.length - 1];

              return (
                <article className="history-card returns-route-card" key={returnRequest.id}>
                  <div className="history-card-head">
                    <div>
                      <p className="history-kicker">Return request</p>
                      <h3>
                        <Link to={`/returns/${returnRequest.id}`}>{returnRequest.id}</Link>
                      </h3>
                      <p className="history-subtle">
                        Linked to order{" "}
                        <Link to={`/orders/${returnRequest.order_id}`}>
                          {returnRequest.order_id}
                        </Link>
                      </p>
                    </div>

                    <span className={getReturnStatusClassName(returnRequest.status)}>
                      {formatStatusLabel(returnRequest.status)}
                    </span>
                  </div>

                  <div className="history-meta-grid">
                    <div>
                      <span>Created</span>
                      <strong>{formatDateTime(returnRequest.created_at)}</strong>
                    </div>
                    <div>
                      <span>Items</span>
                      <strong>{returnRequest.items.length}</strong>
                    </div>
                    <div>
                      <span>Refund</span>
                      <strong>{buildReturnRefundSummary(returnRequest)}</strong>
                    </div>
                    <div>
                      <span>Latest update</span>
                      <strong>
                        {latestEvent ? formatStatusLabel(latestEvent.status) : "Requested"}
                      </strong>
                    </div>
                  </div>

                  <div className="returns-route-detail-grid">
                    <div className="returns-route-subcard">
                      <div className="history-line">
                        <strong>Reason</strong>
                        <span className="history-subtle">
                          {returnRequest.items.length} return lines
                        </span>
                      </div>
                      <p>{returnRequest.reason}</p>

                      <div className="returns-route-item-list">
                        {returnRequest.items.map((item) => (
                          <div className="history-item-preview" key={item.id}>
                            <strong>{item.product_id}</strong>
                            <span>
                              Order item {item.order_item_id} • Qty {item.quantity}
                            </span>
                            <span>{item.reason || "No extra note for this line."}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="returns-route-subcard">
                      <div className="history-line">
                        <strong>Timeline</strong>
                        <span className="history-subtle">
                          {returnRequest.events.length} milestones
                        </span>
                      </div>

                      <div className="returns-route-event-list">
                        {returnRequest.events.map((event) => (
                          <div className="returns-route-event" key={event.id}>
                            <strong>{formatStatusLabel(event.status)}</strong>
                            <span>{event.message}</span>
                            <span className="history-subtle">
                              {event.actor_role || "system"} • {formatDateTime(event.created_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {returnRequest.refund_last_error ? (
                    <div className="feedback feedback-warning returns-route-warning">
                      <strong>Last refund attempt needs attention.</strong>
                      <span>{returnRequest.refund_last_error}</span>
                      {returnRequest.refund_next_retry_at ? (
                        <span>
                          Next retry at {formatDateTime(returnRequest.refund_next_retry_at)}.
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="returns-route-actions">
                    <Link className="ghost-button" to={`/returns/${returnRequest.id}`}>
                      View details
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AccountPageLayout>
  );
}

function buildReturnRefundSummary(returnRequest: ReturnRequest) {
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
