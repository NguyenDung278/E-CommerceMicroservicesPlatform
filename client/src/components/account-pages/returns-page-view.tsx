"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { AccountShell } from "@/components/account-shared/account-shell";
import {
  EmptyState,
  InlineAlert,
  LoadingScreen,
  StatusPill,
  SurfaceCard,
} from "@/components/storefront-shared/storefront-ui";
import { useAuth } from "@/hooks/useAuth";
import { orderApi } from "@/lib/api";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import type { ApiMeta, ReturnRequest } from "@/types/api";
import { formatCurrency, formatDateTime, formatStatusLabel } from "@/utils/format";

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

export function ReturnsPageView() {
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
        const response = await orderApi.listReturns(token, {
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
      ["requested", "approved", "received", "refund_pending"].includes(item.status),
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
    setPage(1);
    setQuery(queryDraft.trim());
  }

  function handleResetFilters() {
    setPage(1);
    setSelectedStatus("all");
    setQuery("");
    setQueryDraft("");
  }

  return (
    <AccountShell
      title="Returns & Refunds"
      description="Theo dõi yêu cầu trả hàng, tiến trình hoàn tiền và toàn bộ lịch sử xử lý trong cùng một trung tâm."
    >
      {feedback ? <InlineAlert tone="error">{feedback}</InlineAlert> : null}

      <SurfaceCard className="p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Post-purchase care</p>
            <h2 className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary md:text-4xl">
              Returns & Refunds
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-on-surface-variant md:text-base">
              Theo dõi yêu cầu trả hàng, refund queue và toàn bộ lịch sử xử lý của từng case ngay trong account center.
            </p>
          </div>
          <p className="text-sm leading-7 text-on-surface-variant">
            Showing {visibleRangeStart}-{visibleRangeEnd} of {meta.total ?? 0} returns
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] bg-[#f6f1ea] px-5 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
              Open cases
            </p>
            <p className="mt-4 font-serif text-4xl font-semibold tracking-[-0.03em] text-primary">
              {stats.activeCount}
            </p>
          </div>
          <div className="rounded-[1.5rem] bg-[#f6f1ea] px-5 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
              Refunded
            </p>
            <p className="mt-4 font-serif text-4xl font-semibold tracking-[-0.03em] text-primary">
              {stats.refundedCount}
            </p>
          </div>
          <div className="rounded-[1.5rem] bg-[#f6f1ea] px-5 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
              Waiting retry
            </p>
            <p className="mt-4 font-serif text-4xl font-semibold tracking-[-0.03em] text-primary">
              {stats.waitingRetryCount}
            </p>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard className="p-6">
        <form className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_auto]" onSubmit={handleSubmitFilters}>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
              Search return or order
            </span>
            <input
              className="w-full rounded-[1rem] border border-outline-variant/30 bg-background px-4 py-3 text-sm text-primary outline-none"
              placeholder="Ex: return-1 or order-1"
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
              Status
            </span>
            <select
              className="w-full rounded-[1rem] border border-outline-variant/30 bg-background px-4 py-3 text-sm text-primary outline-none"
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

          <div className="flex items-end gap-3">
            <button type="submit" className={buttonStyles({ variant: "secondary" })}>
              Apply
            </button>
            <button
              type="button"
              className={buttonStyles({ variant: "tertiary" })}
              onClick={handleResetFilters}
            >
              Reset
            </button>
          </div>
        </form>
      </SurfaceCard>

      {isLoading ? (
        <LoadingScreen label="Đang tải yêu cầu trả hàng..." />
      ) : returns.length === 0 ? (
        <EmptyState
          title="Chưa có yêu cầu trả hàng"
          description="Khi bạn tạo yêu cầu từ trang chi tiết đơn hàng, chúng sẽ xuất hiện ở đây cùng timeline và trạng thái hoàn tiền."
          action={
            <Link href="/myorders" className={buttonStyles()}>
              Review your orders
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-on-surface-variant">
            <span>
              Page {meta.page ?? page}/{totalPages} · Showing {visibleRangeStart}-{visibleRangeEnd} of {meta.total ?? 0} returns
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className={buttonStyles({ variant: "tertiary", size: "sm" })}
                disabled={(meta.page ?? page) <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className={buttonStyles({ variant: "tertiary", size: "sm" })}
                disabled={(meta.page ?? page) >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </div>

          <div className="grid gap-5">
            {returns.map((returnRequest) => {
              const latestEvent = returnRequest.events[returnRequest.events.length - 1];

              return (
                <SurfaceCard key={returnRequest.id} className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                        Return request
                      </p>
                      <Link
                        href={`/returns/${returnRequest.id}`}
                        className="mt-3 block font-serif text-3xl font-semibold tracking-[-0.03em] text-primary"
                      >
                        {returnRequest.id}
                      </Link>
                      <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                        Linked to order{" "}
                        <Link href={`/orders/${returnRequest.order_id}`} className="underline">
                          {returnRequest.order_id}
                        </Link>
                      </p>
                    </div>

                    <StatusPill status={returnRequest.status} />
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-4">
                    <MetaBlock label="Created" value={formatDateTime(returnRequest.created_at)} />
                    <MetaBlock label="Items" value={String(returnRequest.items.length)} />
                    <MetaBlock label="Refund" value={buildReturnRefundSummary(returnRequest)} />
                    <MetaBlock
                      label="Latest update"
                      value={latestEvent ? formatStatusLabel(latestEvent.status) : "Requested"}
                    />
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[1.25rem] bg-surface p-4">
                      <p className="font-semibold text-primary">Reason & items</p>
                      <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                        {returnRequest.reason}
                      </p>
                      <div className="mt-4 space-y-3">
                        {returnRequest.items.map((item) => (
                          <div key={item.id} className="rounded-[1rem] bg-surface-container-low p-3">
                            <p className="font-medium text-primary">{item.product_id}</p>
                            <p className="mt-1 text-sm text-on-surface-variant">
                              Order item {item.order_item_id} · Qty {item.quantity}
                            </p>
                            <p className="mt-1 text-sm text-on-surface-variant">
                              {item.reason || "No extra note for this line."}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[1.25rem] bg-surface p-4">
                      <p className="font-semibold text-primary">Timeline</p>
                      <div className="mt-4 space-y-3">
                        {returnRequest.events.map((event) => (
                          <div key={event.id} className="rounded-[1rem] bg-surface-container-low p-3">
                            <p className="font-medium text-primary">{formatStatusLabel(event.status)}</p>
                            <p className="mt-1 text-sm text-on-surface-variant">{event.message}</p>
                            <p className="mt-1 text-sm text-on-surface-variant">
                              {event.actor_role || "system"} · {formatDateTime(event.created_at)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {returnRequest.refund_last_error ? (
                    <div className="mt-6">
                      <InlineAlert tone="info">
                        Lần hoàn tiền gần nhất cần chú ý. {returnRequest.refund_last_error}
                        {returnRequest.refund_next_retry_at
                          ? ` Retry tiếp theo vào ${formatDateTime(returnRequest.refund_next_retry_at)}.`
                          : ""}
                      </InlineAlert>
                    </div>
                  ) : null}

                  <div className="mt-6 flex justify-end">
                    <Link
                      href={`/returns/${returnRequest.id}`}
                      className={buttonStyles({ variant: "tertiary" })}
                    >
                      View details
                    </Link>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>
        </div>
      )}
    </AccountShell>
  );
}

function MetaBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-primary">{value}</p>
    </div>
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
