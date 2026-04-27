"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogIn, ShoppingCart, Store, UserRound } from "lucide-react";

import { useAuthState } from "@/hooks/useAuth";
import { useCartState } from "@/hooks/useCart";
import { cn } from "@/lib/utils";
import { getDisplayName } from "@/utils/format";

type StorefrontNavigationItem = {
  href: string;
  label: string;
  matchers: string[];
  adminOnly?: boolean;
};

type RecoveredStorefrontHeaderProps = {
  navigation?: "core" | "fallback";
  tone?: "dark" | "light";
};

export type RecoveredEditorialFooterLink = {
  label: string;
  href: string;
};

const navigationItems: StorefrontNavigationItem[] = [
  { href: "/", label: "Cửa hàng", matchers: ["/"] },
  { href: "/products", label: "Sản phẩm", matchers: ["/products", "/catalog", "/categories"] },
  { href: "/cart", label: "Giỏ hàng", matchers: ["/cart"] },
  { href: "/checkout", label: "Thanh toán", matchers: ["/checkout"] },
  { href: "/admin", label: "Quản trị", matchers: ["/admin"], adminOnly: true },
];

const footerLinks: RecoveredEditorialFooterLink[] = [
  { label: "Sản phẩm", href: "/products" },
  { label: "Giỏ hàng", href: "/cart" },
  { label: "Thanh toán", href: "/checkout" },
];

function formatCompactCount(value: number) {
  return value > 99 ? "99+" : String(value);
}

function isActiveNavigation(pathname: string, item: StorefrontNavigationItem) {
  const normalizedPathname = decodeURIComponent(pathname);

  return item.matchers.some((matcher) => {
    const normalizedMatcher = decodeURIComponent(matcher);

    if (normalizedMatcher === "/") {
      return normalizedPathname === "/";
    }

    return (
      normalizedPathname === normalizedMatcher ||
      normalizedPathname.startsWith(`${normalizedMatcher}/`)
    );
  });
}

export function RecoveredStorefrontHeader({
  tone = "light",
}: RecoveredStorefrontHeaderProps) {
  const pathname = usePathname();
  const { canAccessAdmin, isAuthenticated, user } = useAuthState();
  const { itemCount } = useCartState();
  const visibleItems = navigationItems.filter((item) => !item.adminOnly || canAccessAdmin);
  const accountHref = isAuthenticated ? "/profile" : "/login";
  const accountLabel = isAuthenticated
    ? getDisplayName(user?.first_name, user?.last_name)
    : "Đăng nhập";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-outline-variant bg-surface/94 backdrop-blur-xl",
        tone === "dark" && "bg-surface/96 text-on-surface",
      )}
    >
      <div className="border-b border-outline-variant bg-surface-container-low/90">
        <div className="shell flex min-h-10 flex-wrap items-center justify-between gap-2 py-2 text-xs text-on-surface-variant">
          <p>Giá, tồn kho và danh mục được đồng bộ tự động từ admin.</p>
          {canAccessAdmin ? (
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 font-semibold text-primary transition hover:text-primary-container"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Mở quản trị
            </Link>
          ) : null}
        </div>
      </div>

      <div className="shell flex min-h-[74px] flex-wrap items-center justify-between gap-3 py-3">
        <Link href="/" className="flex items-center gap-3 text-on-surface">
          <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-xl)] bg-primary text-on-primary shadow-[0_16px_28px_-18px_rgba(238,77,45,0.88)]">
            <Store className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Bán hàng tự động
            </p>
            <span className="text-lg font-semibold leading-none">ND Shop</span>
          </div>
        </Link>

        <nav
          className="order-3 flex w-full gap-1 overflow-x-auto rounded-[var(--radius-xl)] border border-outline-variant bg-surface-container-low p-1 md:order-2 md:w-auto"
          aria-label="Điều hướng mua hàng"
        >
          {visibleItems.map((item) => {
            const active = isActiveNavigation(pathname, item);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-[var(--radius-lg)] px-3.5 py-2 text-sm font-semibold text-on-surface-variant transition hover:bg-surface hover:text-on-surface",
                  active && "bg-surface text-on-surface shadow-[0_10px_20px_-16px_rgba(17,24,39,0.3)]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="order-2 flex items-center gap-2 md:order-3">
          <Link
            href="/cart"
            aria-label={`Giỏ hàng có ${itemCount} sản phẩm`}
            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-lg)] border border-outline-variant bg-surface px-3 text-sm font-semibold text-on-surface shadow-[0_8px_20px_-18px_rgba(17,24,39,0.36)] transition hover:border-primary/35 hover:text-primary"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Giỏ hàng</span>
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-on-primary">
              {formatCompactCount(itemCount)}
            </span>
          </Link>

          <Link
            href={accountHref}
            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-lg)] border border-outline-variant bg-surface px-3 text-sm font-semibold text-on-surface shadow-[0_8px_20px_-18px_rgba(17,24,39,0.36)] transition hover:border-primary/35 hover:text-primary"
          >
            {isAuthenticated ? <UserRound className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            <span className="max-w-28 truncate">{accountLabel}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function RecoveredEditorialFooter({
  links = footerLinks,
}: {
  variant?: "page" | "layout";
  brandName?: string;
  caption?: string;
  note?: string;
  links?: RecoveredEditorialFooterLink[];
}) {
  const { canAccessAdmin } = useAuthState();
  const visibleLinks = canAccessAdmin
    ? [...links, { label: "Quản trị", href: "/admin" }]
    : links;

  return (
    <footer className="border-t border-outline-variant bg-surface">
      <div className="shell flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-on-surface">ND Shop</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            Storefront tập trung vào sản phẩm, giá, giỏ hàng và thanh toán.
          </p>
        </div>

        <nav className="flex flex-wrap gap-2" aria-label="Liên kết mua hàng">
          {visibleLinks.map((link) => (
            <Link
              key={`${link.href}-${link.label}`}
              href={link.href}
              className="rounded-[var(--radius-lg)] px-3 py-2 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
