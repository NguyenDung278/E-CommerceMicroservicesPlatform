import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const orderPaymentMocks = vi.hoisted(() => ({
  useOrderPayments: vi.fn(),
}));

vi.mock("../src/features/auth/hooks/use-auth", () => ({
  useAuth: authMocks.useAuth,
}));

vi.mock("../src/features/account/hooks/use-order-payments", () => ({
  useOrderPayments: orderPaymentMocks.useOrderPayments,
}));

vi.mock("../src/features/cart/hooks/use-cart", () => ({
  useCart: vi.fn(() => ({
    itemCount: 2,
  })),
}));

import { SecurityPage } from "@/pages/account";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<{ unmount: () => void }> = [];

function renderSecurityPage(initialEntry = "/security") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <SecurityPage />
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

  return { container };
}

function fillPasswordInput(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;

  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

afterEach(() => {
  while (mountedRoots.length > 0) {
    mountedRoots.pop()?.unmount();
  }
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("SecurityPage password updates", () => {
  it("changes password inside the authenticated session and keeps the user on-page", async () => {
    const changePassword = vi.fn().mockResolvedValue(undefined);

    authMocks.useAuth.mockReturnValue({
      token: "jwt-token",
      isAuthenticated: true,
      user: {
        email: "demo@example.com",
        email_verified: true,
      },
      resendVerificationEmail: vi.fn(),
      changePassword,
      logout: vi.fn(),
    });

    orderPaymentMocks.useOrderPayments.mockReturnValue({
      orders: [],
      paymentsByOrder: {},
      isLoading: false,
      error: "",
    });

    const { container } = renderSecurityPage();
    const headerLinks = Array.from(
      container.querySelectorAll<HTMLAnchorElement>(
        ".storefront-overlay-link, .storefront-overlay-brand, .storefront-overlay-account-pill"
      )
    );
    const passwordInputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="password"]')
    );
    const form = container.querySelector<HTMLFormElement>(".security-route-form");

    expect(passwordInputs).toHaveLength(3);
    expect(form).toBeTruthy();
    expect(headerLinks.map((link) => link.textContent?.trim())).toEqual(
      expect.arrayContaining(["ND Shop", "All Archive", "Men", "Women", "Footwear", "Accessories"])
    );
    expect(container.textContent).toContain("Account");

    act(() => {
      fillPasswordInput(passwordInputs[0]!, "OldPass123");
      fillPasswordInput(passwordInputs[1]!, "NewPass456");
      fillPasswordInput(passwordInputs[2]!, "NewPass456");
    });

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(changePassword).toHaveBeenCalledWith({
      current_password: "OldPass123",
      new_password: "NewPass456",
    });
    expect(container.textContent).toContain(
      "Password updated successfully. Your current session stays active."
    );
    expect(passwordInputs[0]?.value).toBe("");
    expect(passwordInputs[1]?.value).toBe("");
    expect(passwordInputs[2]?.value).toBe("");
  });
});
