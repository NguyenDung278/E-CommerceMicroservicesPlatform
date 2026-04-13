import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReturnsPage } from "@/pages/account/returns-page";

const listReturnsMock = vi.fn();

vi.mock("@/features/account/components/account-page-layout", () => ({
  AccountPageLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ token: "jwt-token" }),
}));

vi.mock("@/services/api", () => ({
  api: {
    listReturns: (...args: unknown[]) => listReturnsMock(...args),
  },
  getErrorMessage: (reason: unknown) => String(reason),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<{ unmount: () => void }> = [];

function buildReturn() {
  return {
    id: "return-1",
    order_id: "order-1",
    user_id: "user-1",
    user_email: "alice@example.com",
    status: "refund_pending",
    reason: "Khách muốn đổi size sau khi nhận hàng",
    items: [
      {
        id: "item-1",
        return_id: "return-1",
        order_item_id: "order-item-1",
        product_id: "product-1",
        quantity: 1,
        reason: "Cần size nhỏ hơn",
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
    refund_amount: 125,
    refund_last_error: "gateway timeout",
    refund_attempt_count: 2,
    refund_next_retry_at: "2026-04-13T10:30:00Z",
    created_at: "2026-04-13T10:00:00Z",
    updated_at: "2026-04-13T10:10:00Z",
  };
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
  });
}

function setNativeValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype =
    element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

  descriptor?.set?.call(element, value);
}

function renderPage() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter>
        <ReturnsPage />
      </MemoryRouter>
    );
  });

  mountedRoots.push({
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  });

  return container;
}

beforeEach(() => {
  listReturnsMock.mockReset();
  listReturnsMock.mockResolvedValue({
    success: true,
    message: "ok",
    data: [buildReturn()],
    meta: {
      page: 1,
      limit: 6,
      total: 1,
    },
  });
});

afterEach(() => {
  while (mountedRoots.length > 0) {
    mountedRoots.pop()?.unmount();
  }
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("ReturnsPage", () => {
  it("loads and renders the customer returns portal", async () => {
    const container = renderPage();
    await flushPromises();

    expect(listReturnsMock).toHaveBeenCalledWith("jwt-token", {
      page: 1,
      limit: 6,
      query: undefined,
      status: undefined,
    });
    expect(container.textContent).toContain("Returns & Refunds");
    expect(container.textContent).toContain("return-1");
    expect(container.textContent).toContain("gateway timeout");
    expect(container.textContent).toContain("Page 1/1");
  });

  it("submits filters and reloads with scoped query params", async () => {
    const container = renderPage();
    await flushPromises();

    const queryInput = container.querySelector<HTMLInputElement>('input[name="return-query"]');
    const statusSelect = container.querySelector<HTMLSelectElement>("select");
    const form = container.querySelector("form");

    act(() => {
      if (queryInput) {
        setNativeValue(queryInput, "order-9");
        queryInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (statusSelect) {
        setNativeValue(statusSelect, "refund_pending");
        statusSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    act(() => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushPromises();

    expect(listReturnsMock).toHaveBeenLastCalledWith("jwt-token", {
      page: 1,
      limit: 6,
      query: "order-9",
      status: "refund_pending",
    });
  });
});
