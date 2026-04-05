import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/features/home/useHomeWorkbook", () => ({
  useHomeWorkbook: vi.fn(),
}));

vi.mock("../src/features/auth/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: false,
  })),
}));

vi.mock("../src/features/cart/hooks/useCart", () => ({
  useCart: vi.fn(() => ({
    itemCount: 2,
  })),
}));

import { useHomeWorkbook } from "../src/features/home/useHomeWorkbook";
import { HomePage } from "../src/routes/HomePage";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<{ unmount: () => void }> = [];

function createSegment(
  slug: string,
  label: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    slug,
    label,
    href: "/products",
    isDefault: slug === "all-archive",
    hero: {
      segmentSlug: slug,
      collectionKicker: "Winter 2024 Collection",
      title: slug === "all-archive" ? "Forest & Hearth" : "Soft Structure, Warm Finish",
      description: "Workbook-driven hero copy.",
      primaryCtaLabel: "Explore Collection",
      primaryCtaHref: "/products",
      secondaryCtaLabel: "View Lookbook",
      secondaryCtaHref: "/products",
      backgroundImage: "https://example.com/hero.jpg",
      quoteKicker: "Technical Edge",
      quoteBody: "Hero quote from workbook.",
      accent: "#946246",
      arrivalsKicker: "New Arrivals",
      arrivalsTitle:
        slug === "all-archive" ? "Seasonal Essentials" : "Draped Staples and Quiet Color",
    },
    tiles: [
      {
        segmentSlug: slug,
        position: 1,
        eyebrow: label,
        title: slug === "all-archive" ? "Shop Men" : "Fluid Dresses",
        subtitle: "Tile subtitle from workbook.",
        imageUrl: "https://example.com/tile.jpg",
        ctaLabel: "Explore",
        ctaHref: "/products",
      },
    ],
    callout: {
      segmentSlug: slug,
      eyebrow: "Technical Editorial",
      title:
        slug === "all-archive"
          ? "Digital Precision, Analogue Soul."
          : "Soft drape, clear line, grounded warmth.",
      body: "Callout body from workbook.",
      imageUrl: "https://example.com/callout.jpg",
    },
    metrics: [
      {
        segmentSlug: slug,
        position: 1,
        value: slug === "all-archive" ? "0.4s" : "18",
        label: slug === "all-archive" ? "Inventory Latency" : "Women's Looks",
      },
    ],
    products: [
      {
        segmentSlug: slug,
        position: 1,
        productId: `${slug}-001`,
        eyebrow: label,
        brand: "Atelier",
        name: slug === "all-archive" ? "Merino Field Overshirt" : "Rose Drape Blazer",
        price: 2490000,
        sizeTag: "M",
        fitNote: "Product note from workbook.",
        imageUrl: "https://example.com/product.jpg",
        href: "/products",
      },
    ],
    ...overrides,
  };
}

function renderHomePage() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter>
        <HomePage />
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

describe("HomePage workbook mode", () => {
  it("renders workbook-driven hero, bento tiles, callout, arrivals, and footer links", async () => {
    vi.mocked(useHomeWorkbook).mockReturnValue({
      content: {
        sourceName: "stitchfix-home.xlsx",
        sourceKind: "xlsx",
        loadedAt: "2026-04-04T01:35:00.000Z",
        footer: {
          brandName: "ND Shop",
          caption: "Crafted for the Discerning",
          note: "Workbook-driven editorial homepage.",
        },
        footerLinks: [
          {
            position: 1,
            label: "Sustainability",
            href: "/products",
          },
        ],
        categoryPages: [],
        navItems: [
          {
            position: 1,
            slug: "all-archive",
            label: "All Archive",
            href: "/products",
            isDefault: true,
          },
          {
            position: 2,
            slug: "nu",
            label: "Nữ",
            href: "/categories/Shop%20Women",
            isDefault: false,
          },
        ],
        segments: [createSegment("all-archive", "All Archive"), createSegment("nu", "Nữ")],
      },
      status: "ready",
      error: "",
      isUsingLocalFile: false,
      uploadFile: vi.fn(),
      resetToLiveSource: vi.fn(),
      reloadLiveSource: vi.fn(),
    });

    const { container } = renderHomePage();

    await waitFor(() => {
      expect(container.textContent).toContain("Forest & Hearth");
      expect(container.textContent).toContain("Shop Men");
      expect(container.textContent).toContain("Digital Precision, Analogue Soul.");
      expect(container.textContent).toContain("Merino Field Overshirt");
      expect(container.textContent).toContain("Sustainability");
    });
  });

  it("renders unified storefront navigation links with the required routes", async () => {
    vi.mocked(useHomeWorkbook).mockReturnValue({
      content: {
        sourceName: "stitchfix-home.xlsx",
        sourceKind: "xlsx",
        loadedAt: "2026-04-04T01:35:00.000Z",
        footer: {
          brandName: "ND Shop",
          caption: "Crafted for the Discerning",
          note: "Workbook-driven editorial homepage.",
        },
        footerLinks: [],
        categoryPages: [],
        navItems: [
          {
            position: 1,
            slug: "all-archive",
            label: "All Archive",
            href: "/products",
            isDefault: true,
          },
          {
            position: 2,
            slug: "nu",
            label: "Women",
            href: "/categories/Shop%20Women",
            isDefault: false,
          },
        ],
        segments: [createSegment("all-archive", "All Archive"), createSegment("nu", "Women")],
      },
      status: "ready",
      error: "",
      isUsingLocalFile: false,
      uploadFile: vi.fn(),
      resetToLiveSource: vi.fn(),
      reloadLiveSource: vi.fn(),
    });

    const { container } = renderHomePage();

    await waitFor(() => {
      expect(container.textContent).toContain("Forest & Hearth");
    });

    const navigationLinks = Array.from(
      container.querySelectorAll<HTMLAnchorElement>(
        ".storefront-overlay-link, .storefront-overlay-brand, .storefront-overlay-account-pill"
      )
    );
    const bagLink = container.querySelector<HTMLAnchorElement>(".storefront-overlay-bag-link");

    const hrefByLabel = Object.fromEntries(
      navigationLinks.map((link) => [link.textContent?.trim() || "", link.getAttribute("href")])
    );

    await waitFor(() => {
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
  });
});
