import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminReturnsSection } from "@/features/admin/components";
import type { ReturnQueueHealth, ReturnRequest } from "@/types/api";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<{ unmount: () => void }> = [];

function buildReturnRequest(overrides: Partial<ReturnRequest> = {}): ReturnRequest {
  return {
    id: "return-1",
    order_id: "order-1",
    user_id: "user-1",
    user_email: "alice@example.com",
    status: "requested",
    reason: "Khách báo sản phẩm bị lỗi hoàn thiện",
    items: [
      {
        id: "item-1",
        return_id: "return-1",
        order_item_id: "order-item-1",
        product_id: "product-1",
        quantity: 1,
        reason: "Bề mặt trầy xước",
        created_at: "2026-04-13T10:00:00Z",
        updated_at: "2026-04-13T10:00:00Z",
      },
    ],
    events: [
      {
        id: "event-1",
        return_id: "return-1",
        status: "requested",
        actor_id: "user-1",
        actor_role: "user",
        message: "return requested",
        created_at: "2026-04-13T10:00:00Z",
      },
    ],
    created_at: "2026-04-13T10:00:00Z",
    updated_at: "2026-04-13T10:00:00Z",
    ...overrides,
  };
}

function renderReturnsSection(
  props: Partial<React.ComponentProps<typeof AdminReturnsSection>> = {}
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const defaultProps: React.ComponentProps<typeof AdminReturnsSection> = {
    busyReturnAction: "",
    busyReturnId: "",
    isLoadingQueueHealth: false,
    isLoadingReturns: false,
    limit: 6,
    page: 1,
    queryDraft: "",
    queueHealth: buildQueueHealth(),
    returns: [buildReturnRequest()],
    selectedStatus: "all",
    total: 8,
    onPageChange: vi.fn(),
    onQueryDraftChange: vi.fn(),
    onQueueRefund: vi.fn(),
    onResetFilters: vi.fn(),
    onSelectStatus: vi.fn(),
    onSubmitFilters: vi.fn((event) => event.preventDefault()),
    onUpdateStatus: vi.fn(),
    ...props,
  };

  act(() => {
    root.render(<AdminReturnsSection {...defaultProps} />);
  });

  mountedRoots.push({
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  });

  return { container, props: defaultProps };
}

function buildQueueHealth(overrides: Partial<ReturnQueueHealth> = {}): ReturnQueueHealth {
  return {
    pending_count: 4,
    ready_now_count: 2,
    in_flight_count: 1,
    retry_scheduled_count: 1,
    failed_attempt_count: 1,
    max_attempt_count: 3,
    oldest_pending_at: "2026-04-13T09:45:00Z",
    next_retry_at: "2026-04-13T10:30:00Z",
    recent_failures: [
      {
        return_id: "return-1",
        order_id: "order-1",
        user_id: "user-1",
        last_error: "gateway timeout",
        attempt_count: 2,
        next_retry_at: "2026-04-13T10:30:00Z",
        updated_at: "2026-04-13T10:10:00Z",
      },
    ],
    ...overrides,
  };
}

function setNativeValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype =
    element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

  descriptor?.set?.call(element, value);
}

afterEach(() => {
  while (mountedRoots.length > 0) {
    mountedRoots.pop()?.unmount();
  }
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("AdminReturnsSection", () => {
  it("renders return details, filters, pagination, and status actions", () => {
    const { container } = renderReturnsSection();

    expect(container.textContent).toContain("Returns timeline");
    expect(container.textContent).toContain("Refund queue health");
    expect(container.textContent).toContain("gateway timeout");
    expect(container.textContent).toContain("return-1");
    expect(container.textContent).toContain("alice@example.com");
    expect(container.textContent).toContain("Khách báo sản phẩm bị lỗi hoàn thiện");
    expect(container.textContent).toContain("return requested");
    expect(container.textContent).toContain("Trang 1/2");

    const buttons = Array.from(container.querySelectorAll("button")).map((button) =>
      button.textContent?.trim()
    );
    expect(buttons).toContain("Chấp nhận");
    expect(buttons).toContain("Từ chối");
    expect(buttons).toContain("Hủy yêu cầu");
  });

  it("wires filter and pagination callbacks", () => {
    const { container, props } = renderReturnsSection();
    const queryInput = container.querySelector<HTMLInputElement>('input[name="admin-return-query"]');
    const statusSelect = container.querySelector<HTMLSelectElement>(
      'select[name="admin-return-status-filter"]'
    );
    const form = container.querySelector("form");
    const previousButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Trang trước")
    );
    const nextButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Trang sau")
    );
    const resetButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Xóa lọc")
    );

    act(() => {
      if (queryInput) {
        setNativeValue(queryInput, "order-9");
        queryInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    act(() => {
      if (statusSelect) {
        setNativeValue(statusSelect, "approved");
        statusSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    act(() => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    act(() => {
      nextButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      resetButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      previousButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(props.onQueryDraftChange).toHaveBeenCalledWith("order-9");
    expect(props.onSelectStatus).toHaveBeenCalledWith("approved");
    expect(props.onSubmitFilters).toHaveBeenCalledTimes(1);
    expect(props.onPageChange).toHaveBeenCalledWith(2);
    expect(props.onResetFilters).toHaveBeenCalledTimes(1);
    expect(previousButton).toHaveProperty("disabled", true);
  });

  it("supports refund retry and status updates for active return cards", () => {
    const refundPendingReturn = buildReturnRequest({
      status: "refund_pending",
      refund_amount: 125,
      refund_attempt_count: 2,
      refund_last_error: "gateway timeout",
      refund_next_retry_at: "2026-04-13T10:30:00Z",
      events: [
        {
          id: "event-1",
          return_id: "return-1",
          status: "approved",
          actor_id: "staff-1",
          actor_role: "staff",
          message: "return approved",
          created_at: "2026-04-13T10:05:00Z",
        },
      ],
    });

    const { container, props } = renderReturnsSection({
      returns: [refundPendingReturn],
      total: 1,
    });
    const retryButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Thử lại hoàn tiền")
    );

    act(() => {
      retryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Lần hoàn tiền gần nhất chưa thành công.");
    expect(container.textContent).toContain("gateway timeout");
    expect(container.textContent).toContain("Refund attempts: 2");
    expect(props.onQueueRefund).toHaveBeenCalledWith(refundPendingReturn);
  });

  it("renders loading state for queue health when requested", () => {
    const { container } = renderReturnsSection({
      isLoadingQueueHealth: true,
      queueHealth: null,
    });

    expect(container.textContent).toContain("Đang tải queue health...");
  });

  it("calls onUpdateStatus with the selected lifecycle transition", () => {
    const { container, props } = renderReturnsSection();
    const approveButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Chấp nhận")
    );

    act(() => {
      approveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(props.onUpdateStatus).toHaveBeenCalledWith(buildReturnRequest(), "approved");
  });
});
