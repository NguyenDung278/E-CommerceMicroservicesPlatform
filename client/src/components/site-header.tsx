"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/storefront-ui";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { buttonStyles } from "@/lib/button-styles";
import { cn } from "@/lib/utils";

const primaryNav = [
  { href: "/", label: "Trang chủ" },
  { href: "/products", label: "Sản phẩm" },
  { href: "/myorders", label: "Đơn hàng" },
  { href: "/profile", label: "Tài khoản" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const { itemCount } = useCart();
  const { wishlistCount } = useWishlist();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-transparent glass-nav">
        <div className="shell flex h-20 items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <Link href="/" className="font-serif text-2xl font-semibold tracking-[-0.04em] text-primary">
              Commerce Platform
            </Link>

            <nav className="hidden items-center gap-7 xl:flex" aria-label="Main navigation">
              {primaryNav.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "pb-1 text-sm font-medium text-secondary transition hover:text-primary",
                      active && "font-serif text-primary underline decoration-primary underline-offset-[10px]",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="hidden items-center gap-3 rounded-full bg-surface-container-high px-4 py-2 text-primary lg:flex">
            <span className="text-xs font-semibold uppercase tracking-[0.2em]">Live backend</span>
            <Badge className="bg-secondary px-2 py-1 text-white">App Router</Badge>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/products"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-low text-primary transition hover:bg-surface-container-high"
              aria-label="Mở catalog"
            >
              <Search className="h-4 w-4" />
            </Link>

            <Link
              href="/products?saved=1"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-low text-primary transition hover:bg-surface-container-high"
              aria-label="Mở danh sách yêu thích"
            >
              <Heart className="h-4 w-4" />
              {wishlistCount ? (
                <span className="absolute right-1.5 top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-tertiary px-1 text-[10px] font-bold text-white">
                  {wishlistCount}
                </span>
              ) : null}
            </Link>

            <Link
              href="/cart"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary transition hover:-translate-y-0.5"
              aria-label="Mở giỏ hàng"
            >
              <ShoppingBag className="h-4 w-4" />
              {itemCount ? (
                <span className="absolute right-1.5 top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-tertiary px-1 text-[10px] font-bold text-white">
                  {itemCount}
                </span>
              ) : null}
            </Link>

            <button
              type="button"
              aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-low text-primary lg:hidden"
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>

            <Link
              href={isAuthenticated ? "/profile" : "/login"}
              className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "hidden md:inline-flex")}
            >
              <UserRound className="h-4 w-4" />
              <span>{isAuthenticated ? "Tài khoản" : "Đăng nhập"}</span>
            </Link>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.24 }}
            className="fixed inset-x-4 top-24 z-50 rounded-[1.75rem] bg-background/95 p-6 shadow-editorial backdrop-blur-2xl lg:hidden"
          >
            <nav className="flex flex-col gap-4">
              {primaryNav.map((item) => (
                <Link
                  key={`mobile-${item.href}`}
                  href={item.href}
                  className="rounded-2xl bg-surface-container-low px-4 py-4 font-serif text-2xl font-semibold tracking-[-0.03em] text-primary"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href={isAuthenticated ? "/profile" : "/login"}
                className="rounded-2xl bg-primary px-4 py-4 text-center text-sm font-semibold uppercase tracking-[0.24em] text-on-primary"
                onClick={() => setMenuOpen(false)}
              >
                {isAuthenticated ? "Vào tài khoản" : "Đăng nhập"}
              </Link>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
