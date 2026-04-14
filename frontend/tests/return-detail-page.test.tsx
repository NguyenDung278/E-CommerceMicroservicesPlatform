import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReturnDetailPage } from "@/pages/account/return-detail-page";

const getReturnByIdMock = vi.fn();
const uploadReturnEvidenceMock = vi.fn();

vi.mock("@/features/account/components/account-page-layout", () => ({
  AccountPageLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ token: "jwt-token" }),
}));

vi.mock("@/services/api", () => ({
  api: {
    getReturnById: (...args: unknown[]) => getReturnByIdMock(...args),
    uploadReturnEvidence: (...args: unknown[]) => uploadReturnEvidenceMock(...args),
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
    status: "requested",
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
    evidence: [
      {
        id: "evidence-1",
        return_id: "return-1",
        file_name: "damage-front.png",
        content_type: "image/png",
        size_bytes: 2048,
        url: "https://cdn.example.com/returns/damage-front.png",
        created_at: "2026-04-13T10:05:00Z",
      },
    ],
    refund_amount: 125,
    created_at: "2026-04-13T10:00:00Z",
    updated_at: "2026-04-13T10:10:00Z",
  };
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
  });
}

function renderPage() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={["/returns/return-1"]}>
        <Routes>
          <Route element={<ReturnDetailPage />} path="/returns/:returnId" />
        </Routes>
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
  getReturnByIdMock.mockReset();
  uploadReturnEvidenceMock.mockReset();
  getReturnByIdMock.mockResolvedValue({
    success: true,
    message: "ok",
    data: buildReturn(),
  });
  uploadReturnEvidenceMock.mockResolvedValue({
    success: true,
    message: "ok",
    data: {
      ...buildReturn(),
      evidence: [
        ...buildReturn().evidence,
        {
          id: "evidence-2",
          return_id: "return-1",
          file_name: "damage-back.png",
          content_type: "image/png",
          size_bytes: 3072,
          url: "https://cdn.example.com/returns/damage-back.png",
          created_at: "2026-04-13T10:15:00Z",
        },
      ],
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

describe("ReturnDetailPage", () => {
  it("loads and renders return detail route", async () => {
    const container = renderPage();
    await flushPromises();

    expect(getReturnByIdMock).toHaveBeenCalledWith("jwt-token", "return-1");
    expect(container.textContent).toContain("return-1");
    expect(container.textContent).toContain("Evidence gallery");
    expect(container.textContent).toContain("damage-front.png");
  });

  it("uploads selected evidence files", async () => {
    const container = renderPage();
    await flushPromises();

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const uploadButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Upload evidence")
    );
    const file = new File(["proof"], "damage-back.png", { type: "image/png" });

    act(() => {
      if (input) {
        Object.defineProperty(input, "files", {
          configurable: true,
          value: [file],
        });
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    act(() => {
      uploadButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushPromises();

    expect(uploadReturnEvidenceMock).toHaveBeenCalledWith("jwt-token", "return-1", [file]);
    expect(container.textContent).toContain("Đã tải lên 2 bằng chứng");
  });
});
