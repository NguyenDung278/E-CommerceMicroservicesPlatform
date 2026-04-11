const routeModuleLoaders = {
  home: () => import("@/pages/storefront/home-page"),
  catalog: () => import("@/pages/storefront/catalog-page"),
  product: () => import("@/pages/storefront/product-detail-page"),
  category: () => import("@/pages/storefront/category-page"),
  cart: () => import("@/pages/storefront/cart-page"),
  checkout: () => import("@/pages/storefront/checkout-page"),
  login: () => import("@/pages/auth/login-page"),
  profile: () => import("@/pages/account/profile-page"),
  orders: () => import("@/pages/account/orders-page"),
  orderDetail: () => import("@/pages/account/order-detail-page"),
  addresses: () => import("@/pages/account/addresses-page"),
  payments: () => import("@/pages/account/payment-history-page"),
  security: () => import("@/pages/account/security-page"),
  notifications: () => import("@/pages/account/notifications-page"),
  admin: () => import("@/pages/admin/admin-page"),
} as const;

type RouteModuleKey = keyof typeof routeModuleLoaders;

const preloadedRouteModules = new Map<RouteModuleKey, Promise<unknown>>();

function normalizePathname(href: string) {
  try {
    const url = new URL(href, window.location.origin);
    return url.pathname;
  } catch {
    return href.split("?")[0]?.split("#")[0] ?? href;
  }
}

export function preloadRouteModule(key: RouteModuleKey) {
  if (!preloadedRouteModules.has(key)) {
    preloadedRouteModules.set(key, routeModuleLoaders[key]());
  }

  return preloadedRouteModules.get(key)!;
}

export function preloadRouteByPath(href: string) {
  const pathname = normalizePathname(href);

  if (pathname === "/") {
    return preloadRouteModule("home");
  }

  if (pathname === "/products") {
    return preloadRouteModule("catalog");
  }

  if (pathname.startsWith("/products/")) {
    return preloadRouteModule("product");
  }

  if (pathname.startsWith("/categories/")) {
    return preloadRouteModule("category");
  }

  if (pathname === "/cart") {
    return preloadRouteModule("cart");
  }

  if (pathname === "/checkout") {
    return preloadRouteModule("checkout");
  }

  if (pathname === "/login") {
    return preloadRouteModule("login");
  }

  if (pathname === "/profile") {
    return preloadRouteModule("profile");
  }

  if (pathname === "/myorders" || pathname === "/orders") {
    return preloadRouteModule("orders");
  }

  if (pathname.startsWith("/orders/")) {
    return preloadRouteModule("orderDetail");
  }

  if (pathname === "/addresses") {
    return preloadRouteModule("addresses");
  }

  if (pathname === "/payments") {
    return preloadRouteModule("payments");
  }

  if (pathname === "/security") {
    return preloadRouteModule("security");
  }

  if (pathname === "/notifications") {
    return preloadRouteModule("notifications");
  }

  if (pathname === "/admin") {
    return preloadRouteModule("admin");
  }

  return null;
}

export function warmCommonStorefrontRoutes(isAuthenticated: boolean) {
  const commonRoutes: RouteModuleKey[] = ["home", "catalog", "category", "cart"];
  const accountRoutes: RouteModuleKey[] = isAuthenticated
    ? ["profile", "orders", "addresses", "payments", "security", "notifications"]
    : ["login"];

  [...commonRoutes, ...accountRoutes].forEach((routeKey) => {
    void preloadRouteModule(routeKey);
  });
}
