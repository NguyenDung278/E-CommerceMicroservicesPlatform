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

const wishlistMocks = vi.hoisted(() => ({
  useWishlist: vi.fn(() => ({
    wishlist: [],
    wishlistCount: 0,
    toggleWishlist: vi.fn(),
    isSaved: vi.fn(() => false),
    clearWishlist: vi.fn(),
  })),
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

vi.mock("../src/features/wishlist", () => ({
  useWishlist: wishlistMocks.useWishlist,
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

const productWithColorVariants = {
  ...baseProduct,
  id: "p-variant",
  name: "Sculpted Wool Jacket",
  category: "Shop Men",
  variants: [
    {
      sku: "WOOL-BLK-S",
      label: "Small",
      size: "S",
      color: "black",
      price: 149,
      stock: 4,
    },
    {
      sku: "WOOL-BLK-M",
      label: "Medium",
      size: "M",
      color: "black",
      price: 149,
      stock: 0,
    },
    {
      sku: "WOOL-ESP-S",
      label: "Small",
      size: "S",
      color: "espresso",
      price: 159,
      stock: 0,
    },
    {
      sku: "WOOL-ESP-M",
      label: "Medium",
      size: "M",
      color: "espresso",
      price: 159,
      stock: 3,
    },
  ],
};

const workbookContent = {
  sourceName: "stitchfix-home.csv",
  sourceKind: "csv" as const,
  loadedAt: "2026-04-07T00:00:00Z",
  footer: {
    brandName: "ND Shop",
    caption: "Crafted for the Discerning",
    note: "Workbook-driven editorial homepage.",
  },
  footerLinks: [],
  navItems: [],
  categoryPages: [],
  segments: [
    {
      slug: "all-archive",
      label: "All Archive",
      href: "/products",
      isDefault: true,
      hero: {
        segmentSlug: "all-archive",
        collectionKicker: "Archive",
        title: "Archive",
        description: "Workbook content",
        primaryCtaLabel: "Explore",
        primaryCtaHref: "/products",
        secondaryCtaLabel: "Lookbook",
        secondaryCtaHref: "/products",
        backgroundImage: "https://example.com/hero.jpg",
        quoteKicker: "Note",
        quoteBody: "Workbook note",
        accent: "#946246",
        arrivalsKicker: "Arrivals",
        arrivalsTitle: "Archive",
      },
      tiles: [],
      callout: null,
      metrics: [],
      products: [
        {
          segmentSlug: "all-archive",
          position: 1,
          productId: "archive-001",
          eyebrow: "Archive",
          brand: baseProduct.brand,
          name: baseProduct.name,
          price: baseProduct.price,
          sizeTag: "M",
          fitNote: baseProduct.description,
          imageUrl: baseProduct.image_url,
          href: "/products",
        },
      ],
    },
  ],
};

const menWorkbookContent = {
  ...workbookContent,
  categoryPages: [
    {
      slug: "men-atelier",
      navLabel: "Men",
      routeAliases: ["Shop Men", "shop-men", "Men"],
      heroEyebrow: "The Men's",
      heroTitle: "Men's Atelier",
      heroDescription: "Workbook category content",
      heroImageUrl: "https://example.com/hero-men.jpg",
      heroImageAlt: "Men hero",
      quoteBody: "",
      quoteAuthor: "",
      storyEyebrow: "",
      storyTitle: "",
      storyBody: "",
      storyImageUrl: "",
      storyImageAlt: "",
      storyCtaLabel: "",
      storyCtaHref: "/categories/Shop%20Men",
      resultsLabel: "Showing %count% results",
      sortLabel: "Sort by: Relevance",
      footerNote: "",
      filters: [],
      products: [
        {
          pageSlug: "men-atelier",
          position: 1,
          productId: "men-001",
          badge: "New Arrival",
          name: "Sculpted Linen Shirt",
          material: "Italian Linen Blend",
          price: 420,
          imageUrl: "https://example.com/men-shirt.jpg",
          imageAlt: "Men shirt",
          href: "/categories/Shop%20Men",
          filterTags: ["category:shirts", "size:M"],
        },
      ],
    },
  ],
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
          <Route element={<div data-testid="login-route">login</div>} path="/login" />
          <Route element={<div data-testid="cart-route">cart</div>} path="/cart" />
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
  wishlistMocks.useWishlist.mockReturnValue({
    wishlist: [],
    wishlistCount: 0,
    toggleWishlist: vi.fn(),
    isSaved: vi.fn(() => false),
    clearWishlist: vi.fn(),
  });
  document.body.innerHTML = "";
});

describe("ProductDetailPage auth redirect flow", () => {
  it("redirects unauthenticated Add to Cart clicks to login and stores the pending action", async () => {
    const addItem = vi.fn();

    authMocks.useAuth.mockReturnValue({
      token: "",
      isAuthenticated: false,
      isBootstrapping: false,
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
    expect(addItem).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="login-route"]')?.textContent).toBe("login");
  });

  it("redirects unauthenticated Buy now clicks to login and stores the pending action", async () => {
    const addItem = vi.fn();

    authMocks.useAuth.mockReturnValue({
      token: "",
      isAuthenticated: false,
      isBootstrapping: false,
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
    expect(addItem).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="login-route"]')?.textContent).toBe("login");
  });

  it("resumes a pending Add to Cart action after login returns to the product detail page", async () => {
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
    expect(container.querySelector('[data-testid="cart-route"]')?.textContent).toBe("cart");
  });

  it("resumes a pending Buy now action after login returns to the product detail page", async () => {
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

    expect(addItem).toHaveBeenCalledWith({
      product_id: "p-1",
      quantity: 2,
    });
    expect(pendingActionMocks.clearPendingPostLoginAction).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="cart-route"]')?.textContent).toBe("cart");
  });

  it("auto-resolves legacy workbook routes to a live product so Add to Cart stays clickable", async () => {
    const addItem = vi.fn();

    authMocks.useAuth.mockReturnValue({
      token: "",
      isAuthenticated: false,
      isBootstrapping: false,
    });
    cartMocks.useCart.mockReturnValue({
      addItem,
    });
    workbookMocks.useHomeWorkbook.mockReturnValue({
      content: workbookContent,
    });
    apiMocks.api.getProductById.mockRejectedValue(new Error("not found"));
    apiMocks.api.listProductReviews.mockResolvedValue({ data: emptyReviewList });
    apiMocks.api.listProducts.mockImplementation((options?: { search?: string }) => {
      if (options?.search === baseProduct.name) {
        return Promise.resolve({ data: [baseProduct] });
      }

      return Promise.resolve({ data: [] });
    });

    const { container } = renderProductDetail("/products/archive-001");
    await flushAsync();
    await flushAsync();
    await flushAsync();

    const addToCartButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Add to Cart"
    );

    expect(container.textContent).not.toContain("San pham nay hien duoc render tu workbook CSV/XLSX");
    expect(addToCartButton).toBeTruthy();
    expect(addToCartButton?.hasAttribute("disabled")).toBe(false);

    act(() => {
      addToCartButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(pendingActionMocks.savePendingProductDetailAction).toHaveBeenCalledWith({
      intent: "add_to_cart",
      productId: "p-1",
      redirectTo: "/products/archive-001",
      quantity: 1,
    });
    expect(container.querySelector('[data-testid="login-route"]')?.textContent).toBe("login");
  });

  it("resolves workbook product ids like men-001 through category candidates so stock and actions stay enabled", async () => {
    const liveMenProduct = {
      ...baseProduct,
      id: "live-men-001",
      name: "Sculpted Linen Shirt",
      category: "Shop Men",
      sku: "SM-001",
      stock: 12,
    };

    authMocks.useAuth.mockReturnValue({
      token: "",
      isAuthenticated: false,
      isBootstrapping: false,
    });
    cartMocks.useCart.mockReturnValue({
      addItem: vi.fn(),
    });
    workbookMocks.useHomeWorkbook.mockReturnValue({
      content: menWorkbookContent,
    });
    apiMocks.api.getProductById.mockRejectedValue(new Error("not found"));
    apiMocks.api.listProductReviews.mockResolvedValue({ data: emptyReviewList });
    apiMocks.api.listProducts.mockImplementation(
      (options?: { category?: string; search?: string; limit?: number }) => {
        if (
          options?.category === "Shop Men" ||
          options?.category === "shop-men" ||
          options?.category === "Men"
        ) {
          return Promise.resolve({ data: [liveMenProduct] });
        }

        if (typeof options?.limit === "number" && options.limit >= 100) {
          return Promise.resolve({ data: [liveMenProduct] });
        }

        return Promise.resolve({ data: [] });
      }
    );

    const { container } = renderProductDetail("/products/men-001");
    await flushAsync();
    await flushAsync();
    await flushAsync();

    const addToCartButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Add to Cart"
    );
    const buyNowButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Mua ngay"
    );

    expect(container.textContent).toContain("12 còn lại");
    expect(container.textContent).not.toContain("Preview only");
    expect(addToCartButton?.hasAttribute("disabled")).toBe(false);
    expect(buyNowButton?.hasAttribute("disabled")).toBe(false);
  });

  it("switches color swatches and auto-selects the first available size for that finish", async () => {
    authMocks.useAuth.mockReturnValue({
      token: "",
      isAuthenticated: false,
      isBootstrapping: false,
    });
    cartMocks.useCart.mockReturnValue({
      addItem: vi.fn(),
    });
    apiMocks.api.getProductById.mockResolvedValue({ data: productWithColorVariants });
    apiMocks.api.listProductReviews.mockResolvedValue({ data: emptyReviewList });
    apiMocks.api.listProducts.mockResolvedValue({ data: [] });

    const { container } = renderProductDetail("/products/p-variant");
    await flushAsync();

    const blackButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Black")
    );
    const espressoButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Espresso")
    );

    expect(blackButton?.getAttribute("aria-pressed")).toBe("true");
    expect(espressoButton?.getAttribute("aria-pressed")).toBe("false");

    act(() => {
      espressoButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushAsync();

    const sizeButtons = Array.from(container.querySelectorAll(".detail-size-button"));
    const smallButton = sizeButtons.find((button) => button.textContent?.includes("S"));
    const mediumButton = sizeButtons.find((button) => button.textContent?.includes("M"));

    expect(espressoButton?.getAttribute("aria-pressed")).toBe("true");
    expect(smallButton?.hasAttribute("disabled")).toBe(true);
    expect(mediumButton?.hasAttribute("disabled")).toBe(false);
    expect(mediumButton?.getAttribute("class")).toContain("detail-size-button-active");
    expect(container.textContent).toContain("Espresso hiện còn 1 lựa chọn để đặt mua.");
  });

  it("toggles save-for-later from product detail", async () => {
    const toggleWishlist = vi.fn();

    wishlistMocks.useWishlist.mockReturnValue({
      wishlist: [],
      wishlistCount: 0,
      toggleWishlist,
      isSaved: vi.fn(() => false),
      clearWishlist: vi.fn(),
    });
    authMocks.useAuth.mockReturnValue({
      token: "",
      isAuthenticated: false,
      isBootstrapping: false,
    });
    cartMocks.useCart.mockReturnValue({
      addItem: vi.fn(),
    });
    apiMocks.api.getProductById.mockResolvedValue({ data: baseProduct });
    apiMocks.api.listProductReviews.mockResolvedValue({ data: emptyReviewList });
    apiMocks.api.listProducts.mockResolvedValue({ data: [] });

    const { container } = renderProductDetail();
    await flushAsync();

    const saveButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Save for later"
    );

    expect(saveButton).toBeTruthy();

    act(() => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(toggleWishlist).toHaveBeenCalledWith("p-1");
  });
});
