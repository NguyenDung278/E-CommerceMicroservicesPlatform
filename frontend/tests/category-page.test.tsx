import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/features/home/useHomeWorkbook", () => ({
  useHomeWorkbook: vi.fn(),
}));

vi.mock("../src/features/cart/hooks/useCart", () => ({
  useCart: vi.fn(() => ({
    addItem: vi.fn(),
  })),
}));

const apiMocks = vi.hoisted(() => ({
  getStorefrontCategoryPage: vi.fn(),
  listProducts: vi.fn(),
}));

vi.mock("../src/shared/api", () => ({
  api: {
    getStorefrontCategoryPage: apiMocks.getStorefrontCategoryPage,
    listProducts: apiMocks.listProducts,
  },
  getErrorMessage: (reason: unknown) =>
    reason instanceof Error ? reason.message : String(reason),
  isHttpError: () => false,
}));

import { useHomeWorkbook } from "../src/features/home/useHomeWorkbook";
import { CategoryPage } from "../src/routes/CategoryPage";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<{ unmount: () => void }> = [];

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
  it("renders workbook-driven atelier content and filters products client-side", async () => {
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
            ],
            products: [
              {
                pageSlug: "men-atelier",
                position: 1,
                badge: "New Arrival",
                name: "Sculpted Linen Shirt",
                material: "Italian Linen Blend",
                price: 420,
                imageUrl: "https://example.com/shirt.jpg",
                imageAlt: "Shirt",
                href: "/categories/Shop%20Men",
                filterTags: ["category:shirts"],
              },
              {
                pageSlug: "men-atelier",
                position: 2,
                badge: "Limited Edition",
                name: "Structured Atelier Jacket",
                material: "100% Merino Wool",
                price: 1250,
                imageUrl: "https://example.com/jacket.jpg",
                imageAlt: "Jacket",
                href: "/categories/Shop%20Men",
                filterTags: ["category:outerwear"],
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

    expect(container.textContent).toContain("Men's Atelier");
    expect(container.textContent).toContain("Structure, restraint, and material depth.");
    expect(container.textContent).toContain("Sculpted Linen Shirt");
    expect(container.textContent).toContain("Structured Atelier Jacket");
    expect(container.textContent).toContain("The Obsidian Overcoat");
    expect(container.textContent).toContain("Journal");
    expect(apiMocks.getStorefrontCategoryPage).not.toHaveBeenCalled();
    expect(apiMocks.listProducts).not.toHaveBeenCalled();

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
  });
});
