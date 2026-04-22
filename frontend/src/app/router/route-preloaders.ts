const routeModuleLoaders = {
  login: () => import("@/pages/auth/login-page"),
  register: () => import("@/pages/auth/register-page"),
  forgotPassword: () => import("@/pages/auth/forgot-password-page"),
  resetPassword: () => import("@/pages/auth/reset-password-page"),
  verifyEmail: () => import("@/pages/auth/verify-email-page"),
  authCallback: () => import("@/pages/auth/auth-callback-page"),
  admin: () => import("@/pages/admin/admin-page"),
  forbidden: () => Promise.resolve(),
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
    return preloadRouteModule("login");
  }

  if (pathname === "/login") {
    return preloadRouteModule("login");
  }

  if (pathname === "/register") {
    return preloadRouteModule("register");
  }

  if (pathname === "/forgot-password") {
    return preloadRouteModule("forgotPassword");
  }

  if (pathname === "/reset-password") {
    return preloadRouteModule("resetPassword");
  }

  if (pathname === "/verify-email") {
    return preloadRouteModule("verifyEmail");
  }

  if (pathname === "/auth/callback") {
    return preloadRouteModule("authCallback");
  }

  if (pathname === "/admin") {
    return preloadRouteModule("admin");
  }

  if (pathname === "/forbidden") {
    return preloadRouteModule("forbidden");
  }

  return null;
}
