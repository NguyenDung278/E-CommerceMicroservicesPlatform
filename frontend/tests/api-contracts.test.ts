import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../src/shared/api";
import { authApi } from "../src/shared/api/modules/authApi";
import { cartApi } from "../src/shared/api/modules/cartApi";
import { orderApi } from "../src/shared/api/modules/orderApi";
import { paymentApi } from "../src/shared/api/modules/paymentApi";

type MockResponseOptions = {
  data?: unknown;
  ok?: boolean;
  status?: number;
  statusText?: string;
};

function createResponse({
  data = null,
  ok = true,
  status = 200,
  statusText = "OK",
}: MockResponseOptions = {}): Response {
  return {
    ok,
    status,
    statusText,
    text: vi.fn().mockResolvedValue(
      JSON.stringify({
        success: true,
        message: "ok",
        data,
      })
    ),
  } as unknown as Response;
}

describe("frontend api contracts", () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    document.head.innerHTML = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps auth login on POST /api/v1/auth/login", async () => {
    fetchMock.mockResolvedValue(createResponse({ data: { access_token: "token" } }));

    await authApi.login({
      identifier: "demo@example.com",
      password: "secret",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/auth/login");
    expect(init?.method).toBe("POST");
  });

  it("keeps cart add item on POST /api/v1/cart/items with bearer auth", async () => {
    fetchMock.mockResolvedValue(
      createResponse({
        data: {
          user_id: "user-1",
          items: [{ product_id: "sku-1", name: "Sneaker", price: 120000, quantity: 2 }],
        },
      })
    );

    await cartApi.addToCart("jwt-token", {
      product_id: "sku-1",
      quantity: 2,
    });

    const [url, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Headers;
    expect(url).toBe("/api/v1/cart/items");
    expect(init?.method).toBe("POST");
    expect(headers.get("Authorization")).toBe("Bearer jwt-token");
  });

  it("keeps order cancel on PUT /api/v1/orders/:id/cancel", async () => {
    fetchMock.mockResolvedValue(
      createResponse({
        data: {
          id: "order-1",
          user_id: "user-1",
          status: "cancelled",
          subtotal_price: 100000,
          discount_amount: 0,
          shipping_method: "standard",
          shipping_fee: 0,
          total_price: 100000,
          items: [],
        },
      })
    );

    await orderApi.cancelOrder("jwt-token", "order/1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/orders/order%2F1/cancel");
    expect(init?.method).toBe("PUT");
  });

  it("keeps payment history-by-order on GET /api/v1/payments/order/:orderId/history", async () => {
    fetchMock.mockResolvedValue(createResponse({ data: [] }));

    await paymentApi.listPaymentsByOrder("jwt-token", "order/1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/payments/order/order%2F1/history");
    expect(init?.method).toBe("GET");
  });

  it("removes dead compatibility helpers that have no backend contract", () => {
    expect("mergeCart" in api).toBe(false);
    expect("verifyPaymentSignature" in api).toBe(false);
    expect("cancelOrder" in api).toBe(true);
  });
});
