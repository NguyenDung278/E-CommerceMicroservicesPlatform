import type { FormEvent } from "react";

import type { ReturnQueueHealth, ReturnRequest } from "@/types/api";
import { formatCurrency, formatDateTime, formatStatusLabel } from "@/utils/format";

type AdminReturnsSectionProps = {
  busyReturnAction: "" | "refund" | "status";
  busyReturnId: string;
  queueLastUpdatedAt: string;
  isLoadingQueueHealth: boolean;
  isLoadingReturns: boolean;
  limit: number;
  page: number;
  queryDraft: string;
  queueHealth: ReturnQueueHealth | null;
  returns: ReturnRequest[];
  selectedStatus: string;
  total: number;
  onPageChange: (page: number) => void;
  onQueryDraftChange: (value: string) => void;
  onQueueRefund: (returnRequest: ReturnRequest) => void;
  onResetFilters: () => void;
  onSelectStatus: (value: string) => void;
  onSubmitFilters: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateStatus: (
    returnRequest: ReturnRequest,
    status: "approved" | "rejected" | "received" | "cancelled"
  ) => void;
};

const returnStatusOptions = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "requested", label: "Requested" },
  { value: "approved", label: "Approved" },
  { value: "received", label: "Received" },
  { value: "refund_pending", label: "Refund pending" },
  { value: "refunded", label: "Refunded" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
] as const;

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

function buildReturnStatusActions(returnRequest: ReturnRequest) {
  switch (returnRequest.status) {
    case "requested":
      return [
        { key: "approved", label: "Chấp nhận", status: "approved" as const },
        { key: "rejected", label: "Từ chối", status: "rejected" as const },
        { key: "cancelled", label: "Hủy yêu cầu", status: "cancelled" as const },
      ];
    case "approved":
      return [
        { key: "received", label: "Đã nhận hàng", status: "received" as const },
        { key: "cancelled", label: "Hủy yêu cầu", status: "cancelled" as const },
      ];
    default:
      return [];
  }
}

function formatRefundSummary(returnRequest: ReturnRequest) {
  if (typeof returnRequest.refund_amount !== "number") {
    return "Sẽ tính sau khi đối soát trả hàng.";
  }

  if (returnRequest.status === "refund_pending") {
    return `Đang chờ hoàn ${formatCurrency(returnRequest.refund_amount)}.`;
  }
  if (returnRequest.status === "refunded") {
    return `Đã hoàn ${formatCurrency(returnRequest.refund_amount)}.`;
  }

  return `Ước tính hoàn ${formatCurrency(returnRequest.refund_amount)} khi xử lý xong.`;
}

/**
 * Render the admin returns queue with filters, timeline history, and refund actions.
 */
export function AdminReturnsSection({
  busyReturnAction,
  busyReturnId,
  queueLastUpdatedAt,
  isLoadingQueueHealth,
  isLoadingReturns,
  limit,
  page,
  queryDraft,
  queueHealth,
  returns,
  selectedStatus,
  total,
  onPageChange,
  onQueryDraftChange,
  onQueueRefund,
  onResetFilters,
  onSelectStatus,
  onSubmitFilters,
  onUpdateStatus,
}: AdminReturnsSectionProps) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(limit, 1)));
  const showingFrom = total === 0 || returns.length === 0 ? 0 : (page - 1) * limit + 1;
  const showingTo =
    total === 0 || returns.length === 0 ? 0 : Math.min(total, showingFrom + returns.length - 1);
  const queueAlerts = buildReturnQueueAlerts(queueHealth, queueLastUpdatedAt);

  return (
    <section className="admin-console-panel admin-returns-panel" id="admin-return-timeline">
      <div className="section-heading">
        <div>
          <h2>Returns timeline</h2>
          <p className="history-subtle">
            Theo dõi toàn bộ yêu cầu trả hàng, trạng thái hoàn tiền, và lịch sử thao tác của đội vận
            hành trong cùng một bề mặt.
          </p>
        </div>
      </div>

      <div className="admin-return-health-shell">
        <div className="history-line">
          <strong>Refund queue health</strong>
          {queueLastUpdatedAt ? (
            <span className="history-subtle">
              Auto-refresh mỗi 20 giây • cập nhật {formatDateTime(queueLastUpdatedAt)}
            </span>
          ) : queueHealth?.oldest_pending_at ? (
            <span className="history-subtle">
              Job chờ lâu nhất từ {formatDateTime(queueHealth.oldest_pending_at)}
            </span>
          ) : (
            <span className="history-subtle">Chưa có job refund_pending tồn đọng.</span>
          )}
        </div>

        {queueAlerts.length > 0 ? (
          <div className="admin-return-alert-list">
            {queueAlerts.map((alert) => (
              <article
                className={`admin-return-alert admin-return-alert-${alert.severity}`}
                key={alert.id}
              >
                <strong>{alert.title}</strong>
                <p>{alert.description}</p>
              </article>
            ))}
          </div>
        ) : null}

        {isLoadingQueueHealth ? (
          <div className="page-state">Đang tải queue health...</div>
        ) : (
          <>
            <div className="admin-return-health-grid">
              <article className="admin-return-health-card">
                <span className="admin-return-health-label">Jobs đang chờ</span>
                <strong>{queueHealth?.pending_count ?? 0}</strong>
                <p>{queueHealth?.failed_attempt_count ?? 0} job đã phát sinh lỗi cần theo dõi.</p>
              </article>

              <article className="admin-return-health-card">
                <span className="admin-return-health-label">Sẵn sàng chạy</span>
                <strong>{queueHealth?.ready_now_count ?? 0}</strong>
                <p>Có thể nhận lease ngay trong vòng quét worker kế tiếp.</p>
              </article>

              <article className="admin-return-health-card">
                <span className="admin-return-health-label">Đang xử lý</span>
                <strong>{queueHealth?.in_flight_count ?? 0}</strong>
                <p>Job đang có worker giữ lease và gọi payment-service.</p>
              </article>

              <article className="admin-return-health-card">
                <span className="admin-return-health-label">Đang đợi retry</span>
                <strong>{queueHealth?.retry_scheduled_count ?? 0}</strong>
                <p>
                  {queueHealth?.next_retry_at
                    ? `Lần retry gần nhất vào ${formatDateTime(queueHealth.next_retry_at)}.`
                    : `Số attempt cao nhất hiện tại là ${queueHealth?.max_attempt_count ?? 0}.`}
                </p>
              </article>
            </div>

            <div className="admin-return-failure-panel">
              <div className="history-line">
                <strong>Lỗi gần nhất</strong>
                <span className="history-subtle">
                  Tối đa {queueHealth?.recent_failures.length ?? 0} job gần đây
                </span>
              </div>

              {queueHealth?.recent_failures?.length ? (
                <div className="admin-return-failure-list">
                  {queueHealth.recent_failures.map((failure) => (
                    <article className="admin-return-failure-item" key={failure.return_id}>
                      <div>
                        <strong>{failure.return_id}</strong>
                        <p>Order {failure.order_id}</p>
                      </div>
                      <div>
                        <span className="history-subtle">
                          Attempt {failure.attempt_count} • {formatDateTime(failure.updated_at)}
                        </span>
                        <p>{failure.last_error}</p>
                        {failure.next_retry_at ? (
                          <span className="history-subtle">
                            Retry tiếp theo: {formatDateTime(failure.next_retry_at)}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="history-empty">Chưa ghi nhận lỗi refund_pending nào gần đây.</p>
              )}
            </div>
          </>
        )}
      </div>

      <form className="admin-return-filter-form" onSubmit={onSubmitFilters}>
        <label className="admin-return-filter-field">
          <span>Tìm theo mã đơn, return, khách hàng</span>
          <input
            name="admin-return-query"
            placeholder="Ví dụ: order-1 hoặc user@example.com"
            value={queryDraft}
            onChange={(event) => onQueryDraftChange(event.target.value)}
          />
        </label>

        <label className="admin-return-filter-field">
          <span>Trạng thái</span>
          <select
            name="admin-return-status-filter"
            value={selectedStatus}
            onChange={(event) => onSelectStatus(event.target.value)}
          >
            {returnStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="admin-return-filter-actions">
          <button className="ghost-button" type="submit">
            Áp dụng bộ lọc
          </button>
          <button className="ghost-button" type="button" onClick={onResetFilters}>
            Xóa lọc
          </button>
        </div>
      </form>

      <div className="admin-return-toolbar">
        <p className="history-subtle">
          Hiển thị {showingFrom}-{showingTo} trên tổng {total} yêu cầu.
        </p>
        <div className="admin-return-pagination">
          <button
            className="ghost-button"
            disabled={page <= 1}
            type="button"
            onClick={() => onPageChange(page - 1)}
          >
            Trang trước
          </button>
          <span>
            Trang {page}/{totalPages}
          </span>
          <button
            className="ghost-button"
            disabled={page >= totalPages}
            type="button"
            onClick={() => onPageChange(page + 1)}
          >
            Trang sau
          </button>
        </div>
      </div>

      {isLoadingReturns ? <div className="page-state">Đang tải danh sách trả hàng...</div> : null}

      <div className="history-grid">
        {returns.map((returnRequest) => {
          const availableStatusActions = buildReturnStatusActions(returnRequest);
          const isBusy = busyReturnId === returnRequest.id;

          return (
            <article
              className="history-card admin-console-record admin-return-card"
              key={returnRequest.id}
            >
              <div className="history-card-head">
                <div>
                  <p className="history-kicker">Return</p>
                  <h3>{returnRequest.id}</h3>
                  <p className="history-subtle">
                    Order {returnRequest.order_id} •{" "}
                    {returnRequest.user_email || returnRequest.user_id}
                  </p>
                </div>
                <span className={getReturnStatusClassName(returnRequest.status)}>
                  {formatStatusLabel(returnRequest.status)}
                </span>
              </div>

              <div className="history-meta-grid">
                <div>
                  <span>Lý do chính</span>
                  <strong>{returnRequest.reason}</strong>
                </div>
                <div>
                  <span>Khởi tạo lúc</span>
                  <strong>{formatDateTime(returnRequest.created_at)}</strong>
                </div>
                <div>
                  <span>Tổng dòng trả</span>
                  <strong>{returnRequest.items.length}</strong>
                </div>
                <div>
                  <span>Trạng thái refund</span>
                  <strong>{formatRefundSummary(returnRequest)}</strong>
                </div>
              </div>

              <div className="admin-return-detail-grid">
                <div className="admin-return-subcard">
                  <div className="history-line">
                    <strong>Mặt hàng trả lại</strong>
                    <span className="history-subtle">{returnRequest.items.length} dòng</span>
                  </div>

                  <div className="admin-return-item-list">
                    {returnRequest.items.map((item) => (
                      <div className="history-item-preview" key={item.id}>
                        <strong>{item.product_id}</strong>
                        <span>
                          Order item {item.order_item_id} • Số lượng {item.quantity}
                        </span>
                        <span>{item.reason || "Không có ghi chú bổ sung."}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="admin-return-subcard">
                  <div className="history-line">
                    <strong>Lịch sử xử lý</strong>
                    <span className="history-subtle">{returnRequest.events.length} mốc</span>
                  </div>

                  <div className="admin-return-timeline">
                    {returnRequest.events.map((event) => (
                      <div className="admin-return-timeline-item" key={event.id}>
                        <div className="admin-return-timeline-copy">
                          <strong>{formatStatusLabel(event.status)}</strong>
                          <span>{event.message}</span>
                        </div>
                        <span className="history-subtle">
                          {event.actor_role || "system"} • {formatDateTime(event.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {returnRequest.refund_last_error ? (
                <div className="feedback feedback-warning admin-return-warning" role="note">
                  <strong>Lần hoàn tiền gần nhất chưa thành công.</strong>
                  <span>{returnRequest.refund_last_error}</span>
                  {returnRequest.refund_next_retry_at ? (
                    <span>
                      Hệ thống sẽ thử lại sau {formatDateTime(returnRequest.refund_next_retry_at)}.
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div className="admin-return-footer">
                <div className="admin-return-refund-meta">
                  <span className="history-subtle">
                    Refund attempts: {returnRequest.refund_attempt_count ?? 0}
                  </span>
                  {returnRequest.refund_payment_id ? (
                    <span className="history-subtle">
                      Refund payment: {returnRequest.refund_payment_id}
                    </span>
                  ) : null}
                </div>

                <div className="history-actions admin-return-actions">
                  {availableStatusActions.map((action) => (
                    <button
                      className="ghost-button"
                      disabled={isBusy}
                      key={action.key}
                      type="button"
                      onClick={() => onUpdateStatus(returnRequest, action.status)}
                    >
                      {isBusy && busyReturnAction === "status" ? "Đang cập nhật..." : action.label}
                    </button>
                  ))}

                  {returnRequest.status === "approved" ||
                  returnRequest.status === "received" ||
                  returnRequest.status === "refund_pending" ? (
                    <button
                      className="primary-button"
                      disabled={isBusy}
                      type="button"
                      onClick={() => onQueueRefund(returnRequest)}
                    >
                      {isBusy && busyReturnAction === "refund"
                        ? "Đang xếp hàng..."
                        : returnRequest.status === "refund_pending"
                          ? "Thử lại hoàn tiền"
                          : "Xếp hàng hoàn tiền"}
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}

        {!isLoadingReturns && returns.length === 0 ? (
          <p className="history-empty">Chưa có yêu cầu trả hàng nào khớp với bộ lọc hiện tại.</p>
        ) : null}
      </div>
    </section>
  );
}

function buildReturnQueueAlerts(queueHealth: ReturnQueueHealth | null, queueLastUpdatedAt: string) {
  if (!queueHealth) {
    return [];
  }

  const alerts: Array<{
    id: string;
    severity: "warning" | "danger";
    title: string;
    description: string;
  }> = [];

  if (queueHealth.pending_count >= 10) {
    alerts.push({
      id: "pending-backlog",
      severity: "warning",
      title: "Backlog refund_pending đang tăng",
      description: `${queueHealth.pending_count} job đang chờ xử lý. Nên kiểm tra worker và payment-service trước khi hàng đợi phình thêm.`,
    });
  }

  if (queueHealth.failed_attempt_count > 0) {
    alerts.push({
      id: "failed-attempts",
      severity: "warning",
      title: "Có job refund thất bại gần đây",
      description: `${queueHealth.failed_attempt_count} job đang mang lỗi gần nhất và cần theo dõi retry hoặc can thiệp tay.`,
    });
  }

  if (queueHealth.max_attempt_count >= 4) {
    alerts.push({
      id: "max-attempts",
      severity: "danger",
      title: "Một số job đã retry nhiều lần",
      description: `Attempt cao nhất đang là ${queueHealth.max_attempt_count}. Hãy rà lại idempotency, lease và lỗi gateway trước khi backlog tích tụ lâu hơn.`,
    });
  }

  if (queueHealth.oldest_pending_at) {
    const oldestPendingAgeMs = Date.now() - Date.parse(queueHealth.oldest_pending_at);
    if (oldestPendingAgeMs > 10 * 60 * 1000) {
      alerts.push({
        id: "oldest-pending",
        severity: "danger",
        title: "Job chờ quá lâu",
        description: `Job refund_pending lâu nhất đã chờ từ ${formatDateTime(queueHealth.oldest_pending_at)}. Luồng hoàn tiền đang có dấu hiệu nghẽn.`,
      });
    }
  }

  if (queueLastUpdatedAt) {
    const staleAgeMs = Date.now() - Date.parse(queueLastUpdatedAt);
    if (staleAgeMs > 60 * 1000) {
      alerts.push({
        id: "stale-dashboard",
        severity: "warning",
        title: "Dashboard queue health đang cũ",
        description:
          "Dữ liệu queue health chưa làm mới hơn 60 giây. Hãy kiểm tra kết nối API hoặc worker monitor.",
      });
    }
  }

  return alerts;
}
