import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/services/api";
import { adminApi } from "@/services/api/modules/admin-api";
import { authApi } from "@/services/api/modules/auth-api";
import { cartApi } from "@/services/api/modules/cart-api";
import { orderApi } from "@/services/api/modules/order-api";
import { paymentApi } from "@/services/api/modules/payment-api";

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

  it("keeps password change on PUT /api/v1/users/password with bearer auth", async () => {
    fetchMock.mockResolvedValue(createResponse());

    await authApi.changePassword("jwt-token", {
      current_password: "oldPass123",
      new_password: "newPass456",
    });

    const [url, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Headers;
    expect(url).toBe("/api/v1/users/password");
    expect(init?.method).toBe("PUT");
    expect(headers.get("Authorization")).toBe("Bearer jwt-token");
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

  it("keeps admin returns listing on GET /api/v1/admin/returns with filters", async () => {
    fetchMock.mockResolvedValue(createResponse({ data: [] }));

    await adminApi.listReturns("jwt-token", {
      page: 2,
      limit: 6,
      query: "order/1",
      status: "refund_pending",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "/api/v1/admin/returns?page=2&limit=6&query=order%2F1&status=refund_pending"
    );
    expect(init?.method).toBe("GET");
  });

  it("keeps admin return refund queue on POST /api/v1/admin/returns/:id/refund", async () => {
    fetchMock.mockResolvedValue(
      createResponse({
        data: {
          id: "return-1",
          order_id: "order-1",
          user_id: "user-1",
          status: "refund_pending",
          reason: "Damaged item",
          items: [],
          events: [],
          created_at: "2026-04-13T10:00:00Z",
          updated_at: "2026-04-13T10:00:00Z",
        },
      })
    );

    await adminApi.requestReturnRefund("jwt-token", "return/1", {
      message: "Retry refund",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/admin/returns/return%2F1/refund");
    expect(init?.method).toBe("POST");
  });

  it("keeps customer returns listing on GET /api/v1/returns with filters", async () => {
    fetchMock.mockResolvedValue(createResponse({ data: [] }));

    await orderApi.listReturns("jwt-token", {
      page: 2,
      limit: 6,
      query: "order/1",
      status: "refund_pending",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/returns?page=2&limit=6&query=order%2F1&status=refund_pending");
    expect(init?.method).toBe("GET");
  });

  it("keeps order return creation on POST /api/v1/orders/:id/returns", async () => {
    fetchMock.mockResolvedValue(
      createResponse({
        data: {
          id: "return-1",
          order_id: "order-1",
          user_id: "user-1",
          status: "requested",
          reason: "Wrong size",
          items: [],
          events: [],
          created_at: "2026-04-13T10:00:00Z",
          updated_at: "2026-04-13T10:00:00Z",
        },
      })
    );

    await orderApi.createReturn("jwt-token", "order/1", {
      reason: "Wrong size",
      items: [
        {
          order_item_id: "item-1",
          quantity: 1,
        },
      ],
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/orders/order%2F1/returns");
    expect(init?.method).toBe("POST");
  });

  it("keeps admin return queue health on GET /api/v1/admin/returns/health", async () => {
    fetchMock.mockResolvedValue(
      createResponse({
        data: {
          pending_count: 1,
          ready_now_count: 1,
          in_flight_count: 0,
          retry_scheduled_count: 0,
          failed_attempt_count: 0,
          max_attempt_count: 1,
          recent_failures: [],
        },
      })
    );

    await adminApi.getReturnQueueHealth("jwt-token");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/admin/returns/health");
    expect(init?.method).toBe("GET");
  });

  it("removes dead compatibility helpers that have no backend contract", () => {
    expect("mergeCart" in api).toBe(false);
    expect("verifyPaymentSignature" in api).toBe(false);
    expect("cancelOrder" in api).toBe(true);
  });
});
