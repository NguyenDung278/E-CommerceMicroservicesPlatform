import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/features/home/use-home-workbook", () => ({
  useHomeWorkbook: vi.fn(),
}));

vi.mock("../src/features/cart/hooks/use-cart", () => ({
  useCart: vi.fn(() => ({
    itemCount: 2,
    addItem: vi.fn(),
  })),
}));

vi.mock("../src/features/auth/hooks/use-auth", () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: false,
  })),
}));

const apiMocks = vi.hoisted(() => ({
  getStorefrontCategoryPage: vi.fn(),
  listProducts: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  api: {
    getStorefrontCategoryPage: apiMocks.getStorefrontCategoryPage,
    listProducts: apiMocks.listProducts,
  },
  getErrorMessage: (reason: unknown) => (reason instanceof Error ? reason.message : String(reason)),
  isHttpError: () => false,
}));

import { useHomeWorkbook } from "../src/features/home/use-home-workbook";
import { CategoryPage } from "@/pages/storefront";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<{ unmount: () => void }> = [];

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderCategoryPage(initialEntry = "/categories/Shop%20Men") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route element={<CategoryPage />} path="/categories/:categoryName" />
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

afterEach(() => {
  while (mountedRoots.length > 0) {
    mountedRoots.pop()?.unmount();
  }
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("CategoryPage workbook mode", () => {
  it(
    "renders workbook-driven atelier content and filters products client-side",
    async () => {
    apiMocks.listProducts.mockImplementation((options?: { category?: string }) => {
      if (
        options?.category === "Shop Men" ||
        options?.category === "shop-men" ||
        options?.category === "Men"
      ) {
        return Promise.resolve({
          data: [
            {
              id: "live-men-001",
              name: "Sculpted Linen Shirt",
              description: "Live stock for workbook card.",
              price: 420,
              stock: 12,
              category: "Shop Men",
              brand: "ND Atelier",
              tags: ["new"],
              status: "active",
              sku: "SM-001",
              variants: [],
              image_url: "https://example.com/shirt.jpg",
              image_urls: ["https://example.com/shirt.jpg"],
              created_at: "",
              updated_at: "",
            },
            {
              id: "live-men-002",
              name: "Structured Atelier Jacket",
              description: "Low stock live product.",
              price: 1250,
              stock: 4,
              category: "Shop Men",
              brand: "ND Atelier",
              tags: ["limited"],
              status: "active",
              sku: "SM-002",
              variants: [],
              image_url: "https://example.com/jacket.jpg",
              image_urls: ["https://example.com/jacket.jpg"],
              created_at: "",
              updated_at: "",
            },
          ],
        });
      }

      return Promise.resolve({ data: [] });
    });

    vi.mocked(useHomeWorkbook).mockReturnValue({
      content: {
        sourceName: "stitchfix-home.xlsx",
        sourceKind: "xlsx",
        loadedAt: "2026-04-04T02:20:00.000Z",
        footer: {
          brandName: "ND Shop",
          caption: "Crafted for the Discerning",
          note: "Workbook-driven editorial homepage.",
        },
        footerLinks: [
          {
            position: 1,
            label: "Journal",
            href: "/products",
          },
        ],
        navItems: [],
        segments: [],
        categoryPages: [
          {
            slug: "men-atelier",
            navLabel: "Men",
            routeAliases: ["Shop Men", "shop-men", "Men"],
            heroEyebrow: "The Men's",
            heroTitle: "Men's Atelier",
            heroDescription: "Workbook-driven men's category page.",
            heroImageUrl: "https://example.com/hero-men.jpg",
            heroImageAlt: "Men's hero image",
            quoteBody: "Structure, restraint, and material depth.",
            quoteAuthor: "ND Atelier",
            storyEyebrow: "Material Study",
            storyTitle: "The Obsidian Overcoat",
            storyBody: "Story body from workbook.",
            storyImageUrl: "https://example.com/story-men.jpg",
            storyImageAlt: "Story image",
            storyCtaLabel: "View Outerwear",
            storyCtaHref: "/categories/Shop%20Men",
            resultsLabel: "Showing %count% results",
            sortLabel: "Sort by: Relevance",
            footerNote: "Workbook-driven category page.",
            filters: [
              {
                pageSlug: "men-atelier",
                position: 1,
                filterKey: "category",
                label: "Category",
                options: ["Shirts", "Outerwear", "Trousers"],
                defaultValue: "",
              },
              {
                pageSlug: "men-atelier",
                position: 2,
                filterKey: "size",
                label: "Size",
                options: ["S", "M", "L"],
                defaultValue: "",
              },
            ],
            products: [
              {
                pageSlug: "men-atelier",
                position: 1,
                productId: "men-001",
                badge: "New Arrival",
                name: "Sculpted Linen Shirt",
                material: "Italian Linen Blend",
                price: 420,
                imageUrl: "https://example.com/shirt.jpg",
                imageAlt: "Shirt",
                href: "/categories/Shop%20Men",
                filterTags: ["category:shirts", "size:M"],
              },
              {
                pageSlug: "men-atelier",
                position: 2,
                productId: "men-002",
                badge: "Limited Edition",
                name: "Structured Atelier Jacket",
                material: "100% Merino Wool",
                price: 1250,
                imageUrl: "https://example.com/jacket.jpg",
                imageAlt: "Jacket",
                href: "/categories/Shop%20Men",
                filterTags: ["category:outerwear", "size:L"],
              },
            ],
          },
          {
            slug: "women-atelier",
            navLabel: "Women",
            routeAliases: ["Shop Women", "shop-women", "Women"],
            heroEyebrow: "The Women's",
            heroTitle: "Women's Atelier",
            heroDescription: "Workbook-driven women's category page.",
            heroImageUrl: "https://example.com/hero-women.jpg",
            heroImageAlt: "Women's hero image",
            quoteBody: "",
            quoteAuthor: "",
            storyEyebrow: "",
            storyTitle: "",
            storyBody: "",
            storyImageUrl: "",
            storyImageAlt: "",
            storyCtaLabel: "",
            storyCtaHref: "",
            resultsLabel: "Showing %count% pieces",
            sortLabel: "Sort by: Relevance",
            footerNote: "",
            filters: [],
            products: [],
          },
        ],
      },
      status: "ready",
      error: "",
      isUsingLocalFile: false,
      uploadFile: vi.fn(),
      resetToLiveSource: vi.fn(),
      reloadLiveSource: vi.fn(),
    });

    const { container } = renderCategoryPage();
    await flushAsync();
    await flushAsync();

    expect(container.textContent).toContain("Men's Atelier");
    expect(container.textContent).toContain("Structure, restraint, and material depth.");
    expect(container.textContent).toContain("Sculpted Linen Shirt");
    expect(container.textContent).toContain("Structured Atelier Jacket");
    expect(container.textContent).toContain("The Obsidian Overcoat");
    expect(container.textContent).toContain("Journal");
    expect(container.textContent).toContain("All Archive");
    expect(container.textContent).toContain("Women");
    expect(container.textContent).toContain("Footwear");
    expect(container.textContent).toContain("Accessories");
    expect(container.textContent).toContain("CATEGORY");
    expect(container.textContent).toContain("SIZE");
    expect(apiMocks.getStorefrontCategoryPage).not.toHaveBeenCalled();
    expect(apiMocks.listProducts).toHaveBeenCalled();
    expect(container.textContent).toContain("12 còn lại");
    expect(container.textContent).toContain("4 còn lại");

    const searchInput = container.querySelector<HTMLInputElement>("#category-search-men-atelier");

    expect(searchInput?.getAttribute("placeholder")).toContain("Men");

    const categoryLinks = Array.from(
      container.querySelectorAll<HTMLAnchorElement>(
        ".storefront-overlay-link, .storefront-overlay-brand, .storefront-overlay-account-pill"
      )
    );
    const bagLink = container.querySelector<HTMLAnchorElement>(".storefront-overlay-bag-link");
    const hrefByLabel = Object.fromEntries(
      categoryLinks.map((link) => [link.textContent?.trim() || "", link.getAttribute("href")])
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

    const productLink = container.querySelector<HTMLAnchorElement>(".atelier-category-product-card");

    expect(productLink?.getAttribute("href")).toBe("/products/live-men-001");

    act(() => {
      if (!searchInput) {
        return;
      }

      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(searchInput, "Merino");
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      searchInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).not.toContain("Sculpted Linen Shirt");
    expect(container.textContent).toContain("Structured Atelier Jacket");
    expect(container.textContent).toContain("Showing 1 results");

    const clearButton = container.querySelector<HTMLButtonElement>(
      ".atelier-category-search-clear"
    );

    act(() => {
      clearButton?.click();
    });

    expect(container.textContent).toContain("Sculpted Linen Shirt");
    expect(container.textContent).toContain("Structured Atelier Jacket");

    const outerwearButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Outerwear");

    expect(outerwearButton).toBeDefined();

    act(() => {
      outerwearButton?.click();
    });

    expect(container.textContent).not.toContain("Sculpted Linen Shirt");
    expect(container.textContent).toContain("Structured Atelier Jacket");
    expect(container.textContent).toContain("Showing 1 results");
    },
    10000
  );
});
