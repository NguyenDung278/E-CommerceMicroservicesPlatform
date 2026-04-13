import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(() => ({
    token: "jwt-token",
    isAuthenticated: true,
  })),
}));

const cartMocks = vi.hoisted(() => ({
  clearCart: vi.fn(),
  useCart: vi.fn(),
}));

const apiMocks = vi.hoisted(() => ({
  api: {
    createOrder: vi.fn(),
    getProductById: vi.fn(),
    listAddresses: vi.fn(),
    processPayment: vi.fn(),
    previewOrder: vi.fn(),
  },
}));

vi.mock("../src/features/auth/hooks/use-auth", () => ({
  useAuth: authMocks.useAuth,
}));

vi.mock("../src/features/cart/hooks/use-cart", () => ({
  useCart: cartMocks.useCart,
}));

vi.mock("../src/features/home/workbook-sync-catalog", () => ({
  canSyncProductToWorkbook: vi.fn(() => false),
}));

vi.mock("../src/features/home/workbook-sync-client", () => ({
  syncWorkbookProductMutations: vi.fn(),
}));

vi.mock("../src/services/api", () => ({
  api: apiMocks.api,
  getErrorMessage: (reason: unknown) => (reason instanceof Error ? reason.message : String(reason)),
}));

import { CheckoutPage } from "@/pages/storefront/checkout-page";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<{ unmount: () => void }> = [];
const baseAddress = {
  id: "address-1",
  user_id: "user-1",
  recipient_name: "Nguyen Van E",
  phone: "0901234567",
  street: "12 Nguyen Hue",
  ward: "Ben Nghe",
  district: "District 1",
  city: "Ho Chi Minh",
  is_default: true,
  created_at: "2026-04-12T00:00:00Z",
  updated_at: "2026-04-12T00:00:00Z",
};

const baseProduct = {
  id: "product-1",
  name: "Archive Coat",
  description: "Technical wool blend.",
  price: 80,
  stock: 8,
  category: "Outerwear",
  brand: "ND Atelier",
  tags: [],
  status: "active",
  sku: "ARCHIVE-COAT-1",
  variants: [],
  image_url: "https://example.com/coat.jpg",
  image_urls: ["https://example.com/coat.jpg"],
  created_at: "2026-04-12T00:00:00Z",
  updated_at: "2026-04-12T00:00:00Z",
};

function buildPreview(shippingMethod: "standard" | "express" | "pickup") {
  const shippingFee =
    shippingMethod === "express" ? 18 : shippingMethod === "pickup" ? 0 : 7;
  const etaLabel =
    shippingMethod === "express"
      ? "Same-day city courier"
      : shippingMethod === "pickup"
        ? "Ready at atelier desk"
        : "4-6 business days";
  const deliveryPromise =
    shippingMethod === "express"
      ? "Priority atelier dispatch."
      : shippingMethod === "pickup"
        ? "We will text as soon as the order is ready to collect."
        : "Tracked economy delivery for everyday orders.";

  return {
    subtotal_price: 80,
    discount_amount: 0,
    shipping_method: shippingMethod,
    shipping_fee: shippingFee,
    eta_label: etaLabel,
    delivery_promise: deliveryPromise,
    supported_shipping_methods: [
      {
        method: "standard",
        label: "Economy courier",
        description: "Tracked service for everyday orders.",
        fee: 7,
        eta_min_days: 4,
        eta_max_days: 6,
        eta_label: "4-6 business days",
        delivery_promise: "Tracked economy delivery for everyday orders.",
      },
      {
        method: "express",
        label: "Courier rush",
        description: "Fastest lane for city deliveries.",
        fee: 18,
        eta_min_days: 0,
        eta_max_days: 1,
        eta_label: "Same-day city courier",
        delivery_promise: "Priority atelier dispatch.",
      },
      {
        method: "pickup",
        label: "Atelier collection",
        description: "Collect directly from the atelier desk.",
        fee: 0,
        eta_min_days: 0,
        eta_max_days: 1,
        eta_label: "Ready at atelier desk",
        delivery_promise: "We will text as soon as the order is ready to collect.",
      },
    ],
    total_price: 80 + shippingFee,
  };
}

function buildPreviewWithOverrides(
  shippingMethod: "standard" | "express" | "pickup",
  overrides: Partial<ReturnType<typeof buildPreview>>
) {
  const basePreview = buildPreview(shippingMethod);
  const shippingFee = overrides.shipping_fee ?? basePreview.shipping_fee;
  const etaLabel = overrides.eta_label ?? basePreview.eta_label;
  const deliveryPromise = overrides.delivery_promise ?? basePreview.delivery_promise;

  return {
    ...basePreview,
    ...overrides,
    shipping_fee: shippingFee,
    eta_label: etaLabel,
    delivery_promise: deliveryPromise,
    supported_shipping_methods:
      overrides.supported_shipping_methods ??
      basePreview.supported_shipping_methods.map((option) =>
        option.method === shippingMethod
          ? {
              ...option,
              fee: shippingFee,
              eta_label: etaLabel,
              delivery_promise: deliveryPromise,
            }
          : option
      ),
  };
}

function renderCheckoutPage() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={["/checkout"]}>
        <Routes>
          <Route element={<CheckoutPage />} path="/checkout" />
          <Route element={<div data-testid="login-route">login</div>} path="/login" />
          <Route element={<div data-testid="order-route">order detail</div>} path="/orders/:orderId" />
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

async function waitFor(assertion: () => void, timeoutMs = 3000) {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  throw lastError;
}

function mockCheckoutFixtures() {
  cartMocks.useCart.mockReturnValue({
    cart: {
      items: [
        {
          product_id: "product-1",
          name: "Archive Coat",
          price: 80,
          quantity: 1,
        },
      ],
      total: 80,
    },
    clearCart: cartMocks.clearCart,
  });
  apiMocks.api.listAddresses.mockResolvedValue({
    data: [baseAddress],
  });
  apiMocks.api.getProductById.mockResolvedValue({
    data: baseProduct,
  });
  apiMocks.api.previewOrder.mockImplementation(
    (_token: string, body: { shipping_method?: "standard" | "express" | "pickup" }) =>
      Promise.resolve({ data: buildPreview(body.shipping_method ?? "standard") })
  );
}

function findButtonByText(container: HTMLElement, label: string) {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === label
  );
}

function setInputValue(input: HTMLInputElement | null, value: string) {
  expect(input).toBeTruthy();

  act(() => {
    if (!input) {
      return;
    }

    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

afterEach(() => {
  while (mountedRoots.length > 0) {
    mountedRoots.pop()?.unmount();
  }

  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("CheckoutPage shipping selector", () => {
  it("renders shipping methods from preview API and re-requests pricing when the user switches methods", async () => {
    mockCheckoutFixtures();

    const { container } = renderCheckoutPage();

    await waitFor(() => {
      expect(container.textContent).toContain("Economy courier");
      expect(container.textContent).toContain("Courier rush");
      expect(container.textContent).toContain("Atelier collection");
      expect(container.textContent).toContain("Tracked economy delivery for everyday orders.");
    });

    const expressInput = container.querySelector<HTMLInputElement>('input[name="shipping-method"][value="express"]');
    expect(expressInput).toBeTruthy();

    act(() => {
      expressInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => {
      const lastPreviewCall = apiMocks.api.previewOrder.mock.calls.at(-1);
      expect(lastPreviewCall?.[1]?.shipping_method).toBe("express");
      expect(container.textContent).toContain("Priority atelier dispatch.");
      expect(container.textContent).toContain("Same-day city courier");
    });
  });

  it("submits pickup checkout without shipping_address and completes create order flow", async () => {
    mockCheckoutFixtures();
    apiMocks.api.createOrder.mockResolvedValue({
      data: {
        id: "order-1",
      },
    });
    apiMocks.api.processPayment.mockResolvedValue({
      data: {
        id: "payment-1",
      },
    });

    const { container } = renderCheckoutPage();

    await waitFor(() => {
      expect(container.textContent).toContain("Checkout");
      expect(container.textContent).toContain("Economy courier");
    });

    const pickupInput = container.querySelector<HTMLInputElement>(
      'input[name="shipping-method"][value="pickup"]'
    );
    expect(pickupInput).toBeTruthy();

    act(() => {
      pickupInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => {
      const lastPreviewCall = apiMocks.api.previewOrder.mock.calls.at(-1);
      expect(lastPreviewCall?.[1]?.shipping_method).toBe("pickup");
      expect(container.textContent).toContain(
        "We will text as soon as the order is ready to collect."
      );
    });

    const submitButton = findButtonByText(container, "Place Order");
    expect(submitButton).toBeTruthy();

    act(() => {
      submitButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => {
      expect(apiMocks.api.createOrder).toHaveBeenCalledWith(
        "jwt-token",
        expect.objectContaining({
          items: [{ product_id: "product-1", quantity: 1 }],
          shipping_method: "pickup",
          shipping_address: undefined,
        })
      );
      expect(apiMocks.api.processPayment).toHaveBeenCalledWith(
        "jwt-token",
        expect.objectContaining({
          order_id: "order-1",
          payment_method: "manual",
        })
      );
      expect(cartMocks.clearCart).toHaveBeenCalled();
      expect(container.querySelector('[data-testid="order-route"]')?.textContent).toBe(
        "order detail"
      );
    });
  });

  it("submits express checkout with shipping_address from the form", async () => {
    mockCheckoutFixtures();
    apiMocks.api.createOrder.mockResolvedValue({
      data: {
        id: "order-express-1",
      },
    });
    apiMocks.api.processPayment.mockResolvedValue({
      data: {
        id: "payment-express-1",
      },
    });

    const { container } = renderCheckoutPage();

    await waitFor(() => {
      const fullNameInput = container.querySelector<HTMLInputElement>('input[placeholder="Julian Thorne"]');
      expect(fullNameInput?.value).toBe("Nguyen Van E");
    });

    const expressInput = container.querySelector<HTMLInputElement>(
      'input[name="shipping-method"][value="express"]'
    );
    expect(expressInput).toBeTruthy();

    act(() => {
      expressInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => {
      const lastPreviewCall = apiMocks.api.previewOrder.mock.calls.at(-1);
      expect(lastPreviewCall?.[1]?.shipping_method).toBe("express");
    });

    const submitButton = findButtonByText(container, "Place Order");
    expect(submitButton).toBeTruthy();

    act(() => {
      submitButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => {
      expect(apiMocks.api.createOrder).toHaveBeenCalledWith(
        "jwt-token",
        expect.objectContaining({
          items: [{ product_id: "product-1", quantity: 1 }],
          shipping_method: "express",
          shipping_address: expect.objectContaining({
            recipient_name: "Nguyen Van E",
            phone: "0901234567",
          }),
        })
      );
      expect(apiMocks.api.processPayment).toHaveBeenCalledWith(
        "jwt-token",
        expect.objectContaining({
          order_id: "order-express-1",
          payment_method: "manual",
        })
      );
      expect(cartMocks.clearCart).toHaveBeenCalled();
      expect(container.querySelector('[data-testid="order-route"]')?.textContent).toBe(
        "order detail"
      );
    });
  });

  it("shows feedback and skips payment when createOrder fails", async () => {
    mockCheckoutFixtures();
    apiMocks.api.createOrder.mockRejectedValue(new Error("Create order failed."));

    const { container } = renderCheckoutPage();

    await waitFor(() => {
      expect(container.textContent).toContain("Checkout");
    });

    const pickupInput = container.querySelector<HTMLInputElement>(
      'input[name="shipping-method"][value="pickup"]'
    );
    expect(pickupInput).toBeTruthy();

    act(() => {
      pickupInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const submitButton = findButtonByText(container, "Place Order");
    expect(submitButton).toBeTruthy();

    act(() => {
      submitButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => {
      expect(apiMocks.api.createOrder).toHaveBeenCalledWith(
        "jwt-token",
        expect.objectContaining({
          shipping_method: "pickup",
          shipping_address: undefined,
        })
      );
      expect(apiMocks.api.processPayment).not.toHaveBeenCalled();
      expect(cartMocks.clearCart).not.toHaveBeenCalled();
      expect(container.textContent).toContain("Create order failed.");
      expect(container.querySelector('[data-testid="order-route"]')).toBeNull();
    });
  });

  it("shows feedback and keeps the cart when processPayment fails", async () => {
    mockCheckoutFixtures();
    apiMocks.api.createOrder.mockResolvedValue({
      data: {
        id: "order-payment-error-1",
      },
    });
    apiMocks.api.processPayment.mockRejectedValue(new Error("Payment step failed."));

    const { container } = renderCheckoutPage();

    await waitFor(() => {
      expect(container.textContent).toContain("Checkout");
    });

    const pickupInput = container.querySelector<HTMLInputElement>(
      'input[name="shipping-method"][value="pickup"]'
    );
    expect(pickupInput).toBeTruthy();

    act(() => {
      pickupInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const submitButton = findButtonByText(container, "Place Order");
    expect(submitButton).toBeTruthy();

    act(() => {
      submitButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => {
      expect(apiMocks.api.createOrder).toHaveBeenCalledWith(
        "jwt-token",
        expect.objectContaining({
          shipping_method: "pickup",
          shipping_address: undefined,
        })
      );
      expect(apiMocks.api.processPayment).toHaveBeenCalledWith(
        "jwt-token",
        expect.objectContaining({
          order_id: "order-payment-error-1",
          payment_method: "manual",
        })
      );
      expect(cartMocks.clearCart).not.toHaveBeenCalled();
      expect(container.textContent).toContain("Payment step failed.");
      expect(container.querySelector('[data-testid="order-route"]')).toBeNull();
    });
  });

  it("applies a voucher to express delivery and refreshes shipping totals from the preview API", async () => {
    mockCheckoutFixtures();
    apiMocks.api.previewOrder.mockImplementation(
      (_token: string, body: { coupon_code?: string; shipping_method?: "standard" | "express" | "pickup" }) => {
        if (body.coupon_code === "ND2026" && body.shipping_method === "express") {
          return Promise.resolve({
            data: buildPreviewWithOverrides("express", {
              coupon_code: "ND2026",
              discount_amount: 34,
              shipping_fee: 9,
              total_price: 55,
              eta_label: "Delivered by tonight",
              delivery_promise: "Priority atelier dispatch with voucher-adjusted rush delivery.",
            }),
          });
        }

        return Promise.resolve({ data: buildPreview(body.shipping_method ?? "standard") });
      }
    );

    const { container } = renderCheckoutPage();

    await waitFor(() => {
      expect(container.textContent).toContain("Economy courier");
    });

    const expressInput = container.querySelector<HTMLInputElement>(
      'input[name="shipping-method"][value="express"]'
    );
    expect(expressInput).toBeTruthy();

    act(() => {
      expressInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => {
      const lastPreviewCall = apiMocks.api.previewOrder.mock.calls.at(-1);
      expect(lastPreviewCall?.[1]?.shipping_method).toBe("express");
    });

    const voucherInput = container.querySelector<HTMLInputElement>("#checkout-voucher-code");
    setInputValue(voucherInput, "nd2026");

    const applyVoucherButton = findButtonByText(container, "Áp dụng voucher");
    expect(applyVoucherButton).toBeTruthy();

    act(() => {
      applyVoucherButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => {
      const lastPreviewCall = apiMocks.api.previewOrder.mock.calls.at(-1);
      expect(lastPreviewCall?.[1]).toMatchObject({
        coupon_code: "ND2026",
        shipping_method: "express",
        shipping_address: {
          recipient_name: "Nguyen Van E",
          phone: "0901234567",
        },
      });
      expect(container.textContent).toContain("Voucher ND2026 đã được áp dụng.");
      expect(container.textContent).toContain("Delivered by tonight");
      expect(container.textContent).toContain(
        "Priority atelier dispatch with voucher-adjusted rush delivery."
      );
      expect(container.textContent).toContain("$9.00");
      expect(container.textContent).toContain("-$34.00");
      expect(container.textContent).toContain("$55.00");
    });
  });

  it("applies a voucher to pickup delivery and keeps the pickup pricing in sync with the preview API", async () => {
    mockCheckoutFixtures();
    apiMocks.api.previewOrder.mockImplementation(
      (_token: string, body: { coupon_code?: string; shipping_method?: "standard" | "express" | "pickup" }) => {
        if (body.coupon_code === "ND2026" && body.shipping_method === "pickup") {
          return Promise.resolve({
            data: buildPreviewWithOverrides("pickup", {
              coupon_code: "ND2026",
              discount_amount: 32,
              total_price: 48,
              eta_label: "Ready in 30 minutes",
              delivery_promise: "Voucher confirmed. Pickup slot is reserved at the atelier desk.",
            }),
          });
        }

        return Promise.resolve({ data: buildPreview(body.shipping_method ?? "standard") });
      }
    );

    const { container } = renderCheckoutPage();

    await waitFor(() => {
      expect(container.textContent).toContain("Checkout");
    });

    const pickupInput = container.querySelector<HTMLInputElement>(
      'input[name="shipping-method"][value="pickup"]'
    );
    expect(pickupInput).toBeTruthy();

    act(() => {
      pickupInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => {
      const lastPreviewCall = apiMocks.api.previewOrder.mock.calls.at(-1);
      expect(lastPreviewCall?.[1]?.shipping_method).toBe("pickup");
    });

    const applyVoucherButton = findButtonByText(container, "Áp dụng voucher");
    expect(applyVoucherButton).toBeTruthy();

    act(() => {
      applyVoucherButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => {
      const lastPreviewCall = apiMocks.api.previewOrder.mock.calls.at(-1);
      expect(lastPreviewCall?.[1]).toMatchObject({
        coupon_code: "ND2026",
        shipping_method: "pickup",
        shipping_address: undefined,
      });
      expect(container.textContent).toContain("Ready in 30 minutes");
      expect(container.textContent).toContain(
        "Voucher confirmed. Pickup slot is reserved at the atelier desk."
      );
      expect(container.textContent).toContain("Free");
      expect(container.textContent).toContain("-$32.00");
      expect(container.textContent).toContain("$48.00");
    });
  });
});
