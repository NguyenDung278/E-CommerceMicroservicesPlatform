import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/features/home/use-home-workbook", () => ({
  useHomeWorkbook: vi.fn(),
}));

vi.mock("../src/features/auth/hooks/use-auth", () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: false,
  })),
}));

vi.mock("../src/features/cart/hooks/use-cart", () => ({
  useCart: vi.fn(() => ({
    itemCount: 2,
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
import { CatalogPage } from "@/pages/storefront";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<{ unmount: () => void }> = [];

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

describe("CatalogPage category aggregation", () => {
  it("combines product cards from the 4 category pages and filters them by category", async () => {
    vi.mocked(useHomeWorkbook).mockReturnValue({
      content: {
        sourceName: "stitchfix-home.xlsx",
        sourceKind: "xlsx",
        loadedAt: "2026-04-05T10:00:00.000Z",
        footer: {
          brandName: "ND Shop",
          caption: "Crafted for the Discerning",
          note: "Workbook-driven editorial homepage.",
        },
        footerLinks: [],
        navItems: [],
        segments: [],
        categoryPages: [
          {
            slug: "men-atelier",
            navLabel: "Men",
            routeAliases: ["Shop Men", "shop-men", "Men"],
            heroEyebrow: "",
            heroTitle: "Men's Atelier",
            heroDescription: "",
            heroImageUrl: "",
            heroImageAlt: "",
            quoteBody: "",
            quoteAuthor: "",
            storyEyebrow: "",
            storyTitle: "",
            storyBody: "",
            storyImageUrl: "",
            storyImageAlt: "",
            storyCtaLabel: "",
            storyCtaHref: "",
            resultsLabel: "",
            sortLabel: "",
            footerNote: "",
            filters: [],
            products: [
              {
                pageSlug: "men-atelier",
                position: 1,
                productId: "men-001",
                badge: "Tailoring",
                name: "Structured Atelier Jacket",
                material: "100% Merino Wool",
                price: 1250,
                imageUrl: "https://example.com/men.jpg",
                imageAlt: "Men",
                href: "/categories/Shop%20Men",
                filterTags: ["category:outerwear", "size:L", "price:$1000+"],
              },
            ],
          },
          {
            slug: "women-atelier",
            navLabel: "Women",
            routeAliases: ["Shop Women", "shop-women", "Women"],
            heroEyebrow: "",
            heroTitle: "Women's Atelier",
            heroDescription: "",
            heroImageUrl: "",
            heroImageAlt: "",
            quoteBody: "",
            quoteAuthor: "",
            storyEyebrow: "",
            storyTitle: "",
            storyBody: "",
            storyImageUrl: "",
            storyImageAlt: "",
            storyCtaLabel: "",
            storyCtaHref: "",
            resultsLabel: "",
            sortLabel: "",
            footerNote: "",
            filters: [],
            products: [
              {
                pageSlug: "women-atelier",
                position: 1,
                productId: "women-001",
                badge: "Draped",
                name: "Cloud Cashmere Crew",
                material: "Cashmere",
                price: 280,
                imageUrl: "https://example.com/women.jpg",
                imageAlt: "Women",
                href: "/categories/Shop%20Women",
                filterTags: ["category:knitwear", "size:M", "palette:Stone"],
              },
            ],
          },
          {
            slug: "footwear-atelier",
            navLabel: "Footwear",
            routeAliases: ["Footwear", "footwear"],
            heroEyebrow: "",
            heroTitle: "Footwear Atelier",
            heroDescription: "",
            heroImageUrl: "",
            heroImageAlt: "",
            quoteBody: "",
            quoteAuthor: "",
            storyEyebrow: "",
            storyTitle: "",
            storyBody: "",
            storyImageUrl: "",
            storyImageAlt: "",
            storyCtaLabel: "",
            storyCtaHref: "",
            resultsLabel: "",
            sortLabel: "",
            footerNote: "",
            filters: [],
            products: [
              {
                pageSlug: "footwear-atelier",
                position: 1,
                productId: "footwear-001",
                badge: "Workshop Build",
                name: "Moc Toe Service Boot",
                material: "English Bridle Leather",
                price: 560,
                imageUrl: "https://example.com/footwear.jpg",
                imageAlt: "Footwear",
                href: "/categories/Footwear",
                filterTags: ["type:Boots", "size:43", "material:Bridle Leather"],
              },
            ],
          },
          {
            slug: "accessories-atelier",
            navLabel: "Accessories",
            routeAliases: ["Accessories", "accessories"],
            heroEyebrow: "",
            heroTitle: "Accessories Atelier",
            heroDescription: "",
            heroImageUrl: "",
            heroImageAlt: "",
            quoteBody: "",
            quoteAuthor: "",
            storyEyebrow: "",
            storyTitle: "",
            storyBody: "",
            storyImageUrl: "",
            storyImageAlt: "",
            storyCtaLabel: "",
            storyCtaHref: "",
            resultsLabel: "",
            sortLabel: "",
            footerNote: "",
            filters: [],
            products: [
              {
                pageSlug: "accessories-atelier",
                position: 1,
                productId: "accessories-001",
                badge: "Limited Edition",
                name: "Atelier Tote",
                material: "Vegetable Tanned Leather",
                price: 840,
                imageUrl: "https://example.com/accessories.jpg",
                imageAlt: "Accessories",
                href: "/categories/Accessories",
                filterTags: ["category:Bags"],
              },
            ],
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

    const { container } = renderCatalogPage();

    await waitFor(() => {
      expect(container.textContent).toContain("Structured Atelier Jacket");
      expect(container.textContent).toContain("Cloud Cashmere Crew");
      expect(container.textContent).toContain("Moc Toe Service Boot");
      expect(container.textContent).toContain("Atelier Tote");
      expect(container.textContent).toContain("Showing 4 of 4 Products");
    });

    expect(container.textContent).toContain("CATEGORY");
    expect(container.textContent).toContain("SIZE");
    expect(container.textContent).toContain("PRICE RANGE");

    const searchInput = container.querySelector<HTMLInputElement>("#archive-search");
    expect(searchInput?.getAttribute("placeholder")).toContain(
      "All Archive, Men, Women, Footwear and Accessories"
    );

    const navigationLinks = Array.from(
      container.querySelectorAll<HTMLAnchorElement>(
        ".storefront-overlay-link, .storefront-overlay-brand, .storefront-overlay-account-pill"
      )
    );
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

    const archiveLink = container.querySelector<HTMLAnchorElement>(".archive-editorial-card");

    expect(archiveLink?.getAttribute("href")).toBe("/products/men-001");

    expect(apiMocks.getStorefrontCategoryPage).not.toHaveBeenCalled();
    expect(apiMocks.listProducts).not.toHaveBeenCalled();

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
      expect(container.textContent).toContain("Structured Atelier Jacket");
      expect(container.textContent).not.toContain("Cloud Cashmere Crew");
      expect(container.textContent).not.toContain("Moc Toe Service Boot");
      expect(container.textContent).not.toContain("Atelier Tote");
      expect(container.textContent).toContain("Showing 1 of 4 Products");
    });

    const allArchiveButton = collectionButtons.find(
      (button) => button.textContent === "All Archive"
    );

    act(() => {
      allArchiveButton?.click();
    });

    await waitFor(() => {
      expect(container.textContent).toContain("Showing 4 of 4 Products");
    });

    act(() => {
      if (!searchInput) {
        return;
      }

      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(searchInput, "Cashmere");
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      searchInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(container.textContent).not.toContain("Structured Atelier Jacket");
      expect(container.textContent).toContain("Cloud Cashmere Crew");
      expect(container.textContent).not.toContain("Moc Toe Service Boot");
      expect(container.textContent).not.toContain("Atelier Tote");
      expect(container.textContent).toContain("Showing 1 of 4 Products");
    });

    const clearSearchButton = container.querySelector<HTMLButtonElement>(".archive-search-clear");

    act(() => {
      clearSearchButton?.click();
    });

    await waitFor(() => {
      expect(container.textContent).toContain("Showing 4 of 4 Products");
    });

    const sizeButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".archive-size-button")
    );
    const footwearSizeButton = sizeButtons.find((button) => button.textContent === "43");

    expect(sizeButtons.map((button) => button.textContent?.trim())).toEqual(
      expect.arrayContaining(["L", "M", "43"])
    );
    expect(footwearSizeButton).toBeDefined();

    act(() => {
      footwearSizeButton?.click();
    });

    await waitFor(() => {
      expect(container.textContent).not.toContain("Structured Atelier Jacket");
      expect(container.textContent).not.toContain("Cloud Cashmere Crew");
      expect(container.textContent).toContain("Moc Toe Service Boot");
      expect(container.textContent).not.toContain("Atelier Tote");
      expect(container.textContent).toContain("Showing 1 of 4 Products");
    });
  });
});
