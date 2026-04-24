"use client";

import Link from "next/link";
import { Heart, ShoppingBag } from "lucide-react";
import { usePathname } from "next/navigation";

import { useAuthState } from "@/hooks/useAuth";
import { useCartState } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { cn } from "@/lib/utils";
import { getDisplayName } from "@/utils/format";

type StorefrontNavigationItem = {
  href: string;
  label: string;
  matchers: string[];
};

type RecoveredStorefrontHeaderProps = {
  navigation?: "core" | "fallback";
  tone?: "dark" | "light";
};

export type RecoveredEditorialFooterLink = {
  label: string;
  href: string;
};

const storefrontSwitcherItems: StorefrontNavigationItem[] = [
  { href: "/", label: "ND Shop", matchers: ["/"] },
  { href: "/products", label: "All Archive", matchers: ["/products", "/catalog"] },
  {
    href: "/categories/Shop%20Men",
    label: "Men",
    matchers: ["/categories/Shop Men", "/editorial/Shop Men"],
  },
  {
    href: "/categories/Shop%20Women",
    label: "Women",
    matchers: ["/categories/Shop Women", "/editorial/Shop Women"],
  },
  {
    href: "/categories/Footwear",
    label: "Footwear",
    matchers: ["/categories/Footwear", "/editorial/Footwear"],
  },
  {
    href: "/categories/Accessories",
    label: "Accessories",
    matchers: ["/categories/Accessories", "/editorial/Accessories"],
  },
];

const defaultFooterLinks: RecoveredEditorialFooterLink[] = [
  { label: "All Archive", href: "/products" },
  { label: "Yêu thích", href: "/wishlist" },
  { label: "Thanh toán", href: "/checkout" },
  { label: "Tài khoản", href: "/profile" },
];

function formatCompactCount(value: number) {
  if (value > 99) {
    return "99+";
  }

  return String(value);
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
  navigation = "fallback",
  tone = "dark",
}: RecoveredStorefrontHeaderProps) {
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuthState();
  const { itemCount } = useCartState();
  const { wishlistCount } = useWishlist();
  const navigationItems = storefrontSwitcherItems;
  const accountHref = isAuthenticated ? "/profile" : "/login";
  const accountLabel = isAuthenticated
    ? getDisplayName(user?.first_name, user?.last_name)
    : "Đăng nhập";
  const toneClassName =
    tone === "light"
      ? {
          header:
            "border-[#d7d0c7] bg-white/78 text-primary shadow-[0_24px_48px_-28px_rgba(27,28,25,0.18)] backdrop-blur-xl",
          link: "text-on-surface-variant hover:text-primary",
          linkActive: "border-primary/70 text-primary",
          badge: "bg-primary text-on-primary",
          iconButton:
            "border border-[#d9d3ca] bg-[#fbf7f1] text-primary hover:border-primary/25 hover:bg-white",
          account:
            "border border-[#d7d0c7] bg-[#fbf7f1] text-primary hover:border-primary/25 hover:bg-white",
          switcherShell: "border-[#d7d0c7] bg-[#f7f2eb]/92",
          switcherLink:
            "border border-transparent bg-transparent text-on-surface-variant hover:border-[#d7d0c7] hover:bg-white hover:text-primary",
          switcherActive:
            "border-[#d4cdc2] bg-white text-primary shadow-[0_18px_30px_-24px_rgba(27,28,25,0.34)]",
        }
      : {
          header:
            "border-white/16 bg-black/10 text-white shadow-[0_24px_48px_-28px_rgba(0,0,0,0.35)] backdrop-blur-2xl",
          link: "text-white/72 hover:text-white",
          linkActive: "border-white/70 text-white",
          badge: "bg-white text-primary",
          iconButton:
            "border border-white/14 bg-white/10 text-white hover:border-white/30 hover:bg-white/16",
          account:
            "border border-white/14 bg-white/10 text-white hover:border-white/30 hover:bg-white/16",
          switcherShell: "border-white/12 bg-white/8",
          switcherLink:
            "border border-transparent bg-transparent text-white/72 hover:border-white/14 hover:bg-white/10 hover:text-white",
          switcherActive: "border-white/18 bg-white text-primary shadow-[0_22px_36px_-26px_rgba(0,0,0,0.46)]",
        };

  return (
    <header
      className={cn(
        "storefront-overlay-header flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border px-5 py-4 md:px-7 md:py-5",
        tone === "light" && "storefront-overlay-header-light",
        toneClassName.header,
      )}
    >
      <div className="storefront-overlay-brand-block flex items-center gap-6">
        <Link
          href="/"
          className="storefront-overlay-brand font-serif text-[1.7rem] font-semibold tracking-[-0.05em]"
        >
          ND Shop
        </Link>
        <p className="storefront-overlay-caption hidden text-sm leading-6 text-on-surface-variant xl:block">
          Một thanh chuyển hướng theo nhịp storefront lớn: vào thẳng home, all archive hoặc lane danh mục chỉ với một lần chạm.
        </p>
      </div>

      <div className="storefront-overlay-actions flex items-center gap-2 md:gap-3">
        <Link
          href="/wishlist"
          aria-label={
            wishlistCount > 0
              ? `Yêu thích với ${wishlistCount} sản phẩm đã lưu`
              : "Yêu thích"
          }
          className={cn(
            "storefront-overlay-wishlist-link relative inline-flex h-11 w-11 items-center justify-center rounded-full transition",
            toneClassName.iconButton,
          )}
        >
          <Heart className="h-4 w-4" />
          {wishlistCount > 0 ? (
            <span
              className={cn(
                "storefront-overlay-wishlist-count absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                toneClassName.badge,
              )}
            >
              {formatCompactCount(wishlistCount)}
            </span>
          ) : null}
        </Link>

        <Link
          href="/cart"
          aria-label="Giỏ hàng"
          className={cn(
            "storefront-overlay-bag-link relative inline-flex h-11 w-11 items-center justify-center rounded-full transition",
            toneClassName.iconButton,
          )}
        >
          <ShoppingBag className="h-4 w-4" />
          <span
            className={cn(
              "storefront-overlay-bag-count absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              toneClassName.badge,
            )}
          >
            {formatCompactCount(itemCount)}
          </span>
        </Link>

        <Link
          href={accountHref}
          className={cn(
            "storefront-overlay-account-pill inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm transition",
            toneClassName.account,
          )}
        >
          {isAuthenticated ? (
            <span className="storefront-overlay-account-copy flex flex-col leading-tight">
              <span className="storefront-overlay-account-name max-w-32 truncate font-medium md:max-w-40">
                {accountLabel}
              </span>
              <span className="storefront-overlay-account-role text-[10px] uppercase tracking-[0.22em] opacity-70">
                Tài khoản
              </span>
            </span>
          ) : (
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em]">
              Đăng nhập
            </span>
          )}
        </Link>
      </div>

      <div className="storefront-switcher-shell col-span-full">
        <nav
          className={cn(
            "storefront-switcher-nav",
            navigation === "core" && "storefront-switcher-nav-core",
            toneClassName.switcherShell,
          )}
          aria-label="Lối vào mua sắm"
        >
          {navigationItems.map((item) => {
            const isActive = isActiveNavigation(pathname, item);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "storefront-switcher-link",
                  toneClassName.switcherLink,
                  isActive && cn("storefront-switcher-link-active", toneClassName.switcherActive),
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export function RecoveredEditorialFooter({
  variant = "page",
  brandName = "ND Shop",
  caption = "Mua sắm chọn lọc",
  note = "Khám phá sản phẩm, lưu món yêu thích và đi thẳng tới thanh toán hoặc đổi trả trong một nhịp mua sắm gọn gàng.",
  links = defaultFooterLinks,
}: {
  variant?: "page" | "layout";
  brandName?: string;
  caption?: string;
  note?: string;
  links?: RecoveredEditorialFooterLink[];
}) {
  return (
    <footer
      className={cn(
        "editorial-signature-footer grid gap-6 rounded-[2rem] border px-6 py-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:px-8",
        variant === "layout"
          ? "editorial-signature-footer-layout"
          : "editorial-signature-footer-page",
        variant === "layout"
          ? "border-[#d9d2c9] bg-white/74 backdrop-blur"
          : "border-[#d9d2c9] bg-[#f5f0e8]",
      )}
    >
      <div className="editorial-signature-footer-brand grid gap-4">
        <div>
          <strong className="font-serif text-2xl font-semibold tracking-[-0.04em] text-primary">
            {brandName}
          </strong>
          <p className="mt-2 text-[12px] font-medium uppercase tracking-[0.28em] text-on-surface-variant">
            {caption}
          </p>
        </div>
        <p className="editorial-signature-footer-note max-w-2xl text-sm leading-7 text-on-surface-variant">
          {note}
        </p>
      </div>

      <nav
        aria-label="Liên kết cuối trang"
        className="editorial-signature-footer-links flex flex-wrap items-center gap-3 md:justify-end"
      >
        {links.map((link) => {
          const isExternal = /^https?:\/\//.test(link.href);

          if (isExternal) {
            return (
              <a
                key={`${link.href}-${link.label}`}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="editorial-signature-footer-link rounded-full border border-[#d8d0c7] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary transition hover:border-primary/25 hover:bg-white"
              >
                {link.label}
              </a>
            );
          }

          return (
            <Link
              key={`${link.href}-${link.label}`}
              href={link.href}
              className="editorial-signature-footer-link rounded-full border border-[#d8d0c7] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary transition hover:border-primary/25 hover:bg-white"
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </footer>
  );
}
