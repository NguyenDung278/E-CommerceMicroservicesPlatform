import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock("../src/features/auth/hooks/useAuth", () => ({
  useAuth: authMocks.useAuth,
}));

vi.mock("../src/features/auth/storage/rememberedLoginStorage", () => ({
  clearRememberedLogin: vi.fn(),
  readRememberedLogin: vi.fn(() => null),
  saveRememberedLogin: vi.fn(),
}));

vi.mock("../src/features/cart/hooks/useCart", () => ({
  useCart: vi.fn(() => ({
    itemCount: 2,
  })),
}));

import { LoginPage } from "../src/routes/LoginPage";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<{ unmount: () => void }> = [];

function renderLoginPage(initialEntry = "/login") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <LoginPage />
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

afterEach(() => {
  while (mountedRoots.length > 0) {
    mountedRoots.pop()?.unmount();
  }
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("LoginPage storefront header", () => {
  it("renders the shared storefront navigation and login action", () => {
    authMocks.useAuth.mockReturnValue({
      isAuthenticated: false,
      login: vi.fn(),
      beginOAuthLogin: vi.fn(),
      error: "",
      clearError: vi.fn(),
    });

    const { container } = renderLoginPage();
    const navigationLinks = Array.from(
      container.querySelectorAll<HTMLAnchorElement>(
        ".storefront-overlay-link, .storefront-overlay-brand, .storefront-overlay-account-pill"
      )
    );
    const bagLink = container.querySelector<HTMLAnchorElement>(".storefront-overlay-bag-link");
    const hrefByLabel = Object.fromEntries(
      navigationLinks.map((link) => [link.textContent?.trim() || "", link.getAttribute("href")])
    );

    expect(hrefByLabel["ND Shop"]).toBe("/");
    expect(hrefByLabel["All Archive"]).toBe("/products");
    expect(hrefByLabel["Men"]).toBe("/categories/Shop%20Men");
    expect(hrefByLabel["Women"]).toBe("/categories/Shop%20Women");
    expect(hrefByLabel["Footwear"]).toBe("/categories/Footwear");
    expect(hrefByLabel["Accessories"]).toBe("/categories/Accessories");
    expect(hrefByLabel["Login"]).toBe("/login");
    expect(bagLink?.getAttribute("href")).toBe("/login");
    expect(bagLink?.textContent).toContain("2");
  });

  it("switches the right-side action to account when the user is authenticated", () => {
    authMocks.useAuth.mockReturnValue({
      isAuthenticated: true,
      login: vi.fn(),
      beginOAuthLogin: vi.fn(),
      error: "",
      clearError: vi.fn(),
    });

    const { container } = renderLoginPage();
    const accountLink = Array.from(
      container.querySelectorAll<HTMLAnchorElement>(".storefront-overlay-account-pill")
    ).find((link) => link.textContent?.trim() === "Account");
    const bagLink = container.querySelector<HTMLAnchorElement>(".storefront-overlay-bag-link");

    expect(accountLink?.getAttribute("href")).toBe("/profile");
    expect(bagLink?.getAttribute("href")).toBe("/cart");
  });
});
