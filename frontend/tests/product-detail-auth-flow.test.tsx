import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const cartMocks = vi.hoisted(() => ({
  useCart: vi.fn(),
}));

const workbookMocks = vi.hoisted(() => ({
  useHomeWorkbook: vi.fn(() => ({
    content: null,
  })),
}));

const pendingActionMocks = vi.hoisted(() => ({
  savePendingProductDetailAction: vi.fn(),
  readPendingProductDetailAction: vi.fn(() => null),
  clearPendingPostLoginAction: vi.fn(),
}));

const logMocks = vi.hoisted(() => ({
  appendAuthFlowLog: vi.fn(),
}));

const apiMocks = vi.hoisted(() => ({
  api: {
    getProductById: vi.fn(),
    listProductReviews: vi.fn(),
    getMyProductReview: vi.fn(),
    listProducts: vi.fn(),
  },
  getErrorMessage: vi.fn((reason: unknown) =>
    reason instanceof Error
      ? reason.message
      : typeof reason === "object" && reason !== null && "detail" in reason
        ? String((reason as { detail?: unknown }).detail ?? "unknown error")
        : String(reason ?? "unknown error")
  ),
  isHttpError: vi.fn(
    (reason: unknown) => typeof reason === "object" && reason !== null && "status" in reason
  ),
}));

vi.mock("../src/features/auth/hooks/use-auth", () => ({
  useAuth: authMocks.useAuth,
}));

vi.mock("../src/features/cart/hooks/use-cart", () => ({
  useCart: cartMocks.useCart,
}));

vi.mock("../src/features/home/use-home-workbook", () => ({
  useHomeWorkbook: workbookMocks.useHomeWorkbook,
}));

vi.mock("../src/features/auth/storage/post-login-action-storage", () => pendingActionMocks);

vi.mock("../src/features/auth/storage/auth-flow-log-storage", () => logMocks);

vi.mock("../src/services/api", () => apiMocks);

import { ProductDetailPage } from "@/pages/storefront/product-detail-page";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const emptyReviewList = {
  summary: {
    average_rating: 0,
    review_count: 0,
    rating_breakdown: {
      one: 0,
      two: 0,
      three: 0,
      four: 0,
      five: 0,
    },
  },
  items: [],
};

const baseProduct = {
  id: "p-1",
  name: "Archive Lantern",
  description: "A field-tested product for auth flow verification.",
  brand: "ND Shop",
  category: "Collectibles",
  tags: ["limited"],
  price: 129,
  stock: 8,
  status: "active",
  sku: "LANTERN-001",
  image_url: "https://example.com/product.jpg",
  image_urls: ["https://example.com/product.jpg"],
  variants: [],
  created_at: "2026-04-07T00:00:00Z",
  updated_at: "2026-04-07T00:00:00Z",
};

const mountedRoots: Array<{ unmount: () => void }> = [];

function renderProductDetail(initialEntry = "/products/p-1") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route element={<ProductDetailPage />} path="/products/:productId" />
          <Route element={<div data-testid="checkout-route">checkout</div>} path="/checkout" />
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

  return { container };
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  while (mountedRoots.length > 0) {
    mountedRoots.pop()?.unmount();
  }

  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("ProductDetailPage auth redirect flow", () => {
  it("redirects unauthenticated Add to Cart clicks straight into Google OAuth and stores the pending action", async () => {
    const beginOAuthLogin = vi.fn();
    const addItem = vi.fn();

    authMocks.useAuth.mockReturnValue({
      token: "",
      isAuthenticated: false,
      isBootstrapping: false,
      beginOAuthLogin,
    });
    cartMocks.useCart.mockReturnValue({
      addItem,
    });
    apiMocks.api.getProductById.mockResolvedValue({ data: baseProduct });
    apiMocks.api.listProductReviews.mockResolvedValue({ data: emptyReviewList });
    apiMocks.api.listProducts.mockResolvedValue({ data: [] });

    const { container } = renderProductDetail();
    await flushAsync();

    const addToCartButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Add to Cart"
    );

    expect(addToCartButton).toBeTruthy();

    act(() => {
      addToCartButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(pendingActionMocks.savePendingProductDetailAction).toHaveBeenCalledWith({
      intent: "add_to_cart",
      productId: "p-1",
      redirectTo: "/products/p-1",
      quantity: 1,
    });
    expect(beginOAuthLogin).toHaveBeenCalledWith("google", {
      redirectTo: "/products/p-1",
      remember: false,
    });
    expect(addItem).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      "Đang chuyển bạn tới Google để đăng nhập trước khi thêm sản phẩm vào giỏ hàng."
    );
  });

  it("redirects unauthenticated Buy now clicks straight into Google OAuth and stores the pending action", async () => {
    const beginOAuthLogin = vi.fn();
    const addItem = vi.fn();

    authMocks.useAuth.mockReturnValue({
      token: "",
      isAuthenticated: false,
      isBootstrapping: false,
      beginOAuthLogin,
    });
    cartMocks.useCart.mockReturnValue({
      addItem,
    });
    apiMocks.api.getProductById.mockResolvedValue({ data: baseProduct });
    apiMocks.api.listProductReviews.mockResolvedValue({ data: emptyReviewList });
    apiMocks.api.listProducts.mockResolvedValue({ data: [] });

    const { container } = renderProductDetail();
    await flushAsync();

    const buyNowButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Mua ngay"
    );

    expect(buyNowButton).toBeTruthy();

    act(() => {
      buyNowButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(pendingActionMocks.savePendingProductDetailAction).toHaveBeenCalledWith({
      intent: "buy_now",
      productId: "p-1",
      redirectTo: "/products/p-1",
      quantity: 1,
    });
    expect(beginOAuthLogin).toHaveBeenCalledWith("google", {
      redirectTo: "/products/p-1",
      remember: false,
    });
    expect(addItem).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      "Đang chuyển bạn tới Google để đăng nhập trước khi mua ngay."
    );
  });

  it("resumes a pending Add to Cart action after OAuth callback returns to the product detail page", async () => {
    const addItem = vi.fn().mockResolvedValue({
      items: [
        {
          product_id: "p-1",
          quantity: 2,
        },
      ],
      total: 258,
    });

    authMocks.useAuth.mockReturnValue({
      token: "jwt-token",
      isAuthenticated: true,
      isBootstrapping: false,
      beginOAuthLogin: vi.fn(),
    });
    cartMocks.useCart.mockReturnValue({
      addItem,
    });
    pendingActionMocks.readPendingProductDetailAction.mockReturnValue({
      scope: "product_detail",
      intent: "add_to_cart",
      productId: "p-1",
      redirectTo: "/products/p-1",
      quantity: 2,
      createdAt: 1,
    });
    apiMocks.api.getProductById.mockResolvedValue({ data: baseProduct });
    apiMocks.api.listProductReviews.mockResolvedValue({ data: emptyReviewList });
    apiMocks.api.getMyProductReview.mockRejectedValue({ status: 404, detail: "not found" });
    apiMocks.api.listProducts.mockResolvedValue({ data: [] });

    const { container } = renderProductDetail();
    await flushAsync();
    await flushAsync();

    expect(addItem).toHaveBeenCalledWith({
      product_id: "p-1",
      quantity: 2,
    });
    expect(pendingActionMocks.clearPendingPostLoginAction).toHaveBeenCalled();
    expect(container.textContent).toContain(
      "Đăng nhập Google thành công. Sản phẩm đã được thêm vào giỏ hàng."
    );
  });

  it("resumes a pending Buy now action after OAuth callback returns to the product detail page", async () => {
    const addItem = vi.fn();

    authMocks.useAuth.mockReturnValue({
      token: "jwt-token",
      isAuthenticated: true,
      isBootstrapping: false,
      beginOAuthLogin: vi.fn(),
    });
    cartMocks.useCart.mockReturnValue({
      addItem,
    });
    pendingActionMocks.readPendingProductDetailAction.mockReturnValue({
      scope: "product_detail",
      intent: "buy_now",
      productId: "p-1",
      redirectTo: "/products/p-1",
      quantity: 2,
      createdAt: 1,
    });
    apiMocks.api.getProductById.mockResolvedValue({ data: baseProduct });
    apiMocks.api.listProductReviews.mockResolvedValue({ data: emptyReviewList });
    apiMocks.api.getMyProductReview.mockRejectedValue({ status: 404, detail: "not found" });
    apiMocks.api.listProducts.mockResolvedValue({ data: [] });

    const { container } = renderProductDetail();
    await flushAsync();
    await flushAsync();

    expect(addItem).not.toHaveBeenCalled();
    expect(pendingActionMocks.clearPendingPostLoginAction).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="checkout-route"]')?.textContent).toBe("checkout");
  });
});
