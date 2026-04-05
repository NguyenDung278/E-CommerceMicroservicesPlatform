import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/features/auth/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: false,
  })),
}));

vi.mock("../src/features/cart/hooks/useCart", () => ({
  useCart: vi.fn(() => ({
    itemCount: 0,
    addItem: vi.fn(),
  })),
}));

const apiMocks = vi.hoisted(() => ({
  getProductPopularity: vi.fn(),
  listProducts: vi.fn(),
}));

vi.mock("../src/shared/api", () => ({
  api: {
    getProductPopularity: apiMocks.getProductPopularity,
    listProducts: apiMocks.listProducts,
  },
  getErrorMessage: (reason: unknown) =>
    reason instanceof Error ? reason.message : String(reason),
}));

import { CatalogPage } from "../src/routes/CatalogPage";
import type { Product } from "../src/shared/types/api";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<{ unmount: () => void }> = [];

function createProduct(
  id: string,
  name: string,
  category: string,
  price: number,
  overrides: Partial<Product> = {}
): Product {
  return {
    id,
    name,
    description: `${name} description`,
    price,
    stock: 8,
    category,
    brand: "ND Atelier",
    tags: ["atelier"],
    status: "active",
    sku: `${id}-sku`,
    variants: [
      {
        sku: `${id}-variant`,
        label: "Default",
        size: "M",
        color: "Forest",
        price,
        stock: 8,
      },
    ],
    image_url: "https://example.com/product.jpg",
    image_urls: ["https://example.com/product.jpg"],
    created_at: "2026-04-05T10:00:00.000Z",
    updated_at: "2026-04-05T10:00:00.000Z",
    ...overrides,
  };
}

function renderCatalogPage(initialEntry = "/products") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route element={<CatalogPage />} path="/products" />
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

async function waitFor(assertion: () => void, timeoutMs = 2000) {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await act(async () => {
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

afterEach(() => {
  while (mountedRoots.length > 0) {
    mountedRoots.pop()?.unmount();
  }
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("CatalogPage storefront archive", () => {
  it("loads every storefront product across cursor pages and keeps only archive categories", async () => {
    apiMocks.listProducts
      .mockResolvedValueOnce({
        success: true,
        message: "ok",
        data: [
          createProduct("men-1", "Men Field Coat", "Shop Men", 480),
          createProduct("women-1", "Women Drape Dress", "Shop Women", 520, {
            created_at: "2026-04-05T09:00:00.000Z",
          }),
        ],
        meta: {
          has_next: true,
          next_cursor: "page-2",
        },
      })
      .mockResolvedValueOnce({
        success: true,
        message: "ok",
        data: [
          createProduct("footwear-1", "Archive Derby", "Footwear", 390, {
            created_at: "2026-04-05T08:00:00.000Z",
          }),
          createProduct("accessories-1", "Vault Scarf", "Accessories", 190, {
            created_at: "2026-04-05T07:00:00.000Z",
          }),
          createProduct("other-1", "Lifestyle Candle", "Homeware", 90, {
            created_at: "2026-04-05T06:00:00.000Z",
          }),
        ],
        meta: {
          has_next: false,
        },
      });

    const { container } = renderCatalogPage();

    await waitFor(() => {
      expect(container.textContent).toContain("Men Field Coat");
      expect(container.textContent).toContain("Women Drape Dress");
      expect(container.textContent).toContain("Archive Derby");
      expect(container.textContent).toContain("Vault Scarf");
      expect(container.textContent).not.toContain("Lifestyle Candle");
      expect(container.textContent).toContain("Showing 4 of 4 Objects");
    });

    expect(apiMocks.listProducts).toHaveBeenCalledTimes(2);
    expect(apiMocks.listProducts).toHaveBeenNthCalledWith(1, {
      status: "active",
      limit: 100,
      cursor: undefined,
    });
    expect(apiMocks.listProducts).toHaveBeenNthCalledWith(2, {
      status: "active",
      limit: 100,
      cursor: "page-2",
    });

    const collectionButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".archive-collection-link")
    );
    const menButton = collectionButtons.find((button) => button.textContent === "Men");

    expect(collectionButtons.map((button) => button.textContent?.trim())).toEqual([
      "All Archive",
      "Men",
      "Women",
      "Footwear",
      "Accessories",
    ]);
    expect(menButton).toBeDefined();

    act(() => {
      menButton?.click();
    });

    await waitFor(() => {
      expect(container.textContent).toContain("Men Field Coat");
      expect(container.textContent).not.toContain("Women Drape Dress");
      expect(container.textContent).not.toContain("Archive Derby");
      expect(container.textContent).not.toContain("Vault Scarf");
      expect(container.textContent).toContain("Showing 1 of 4 Objects");
    });
  });
});
