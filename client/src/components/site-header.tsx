"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Heart,
  Menu,
  Search,
  ShoppingBag,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { primaryNav } from "@/data/storefront";
import { buttonStyles } from "@/lib/button-styles";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/storefront-ui";
import { useStorefront } from "@/store/storefront-provider";

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { cartCount, wishlistCount } = useStorefront();
  const isHome = pathname === "/";

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 border-b border-transparent",
          isHome
            ? "glass-nav"
            : "bg-background/90 shadow-[0_1px_0_rgba(115,121,115,0.08)] backdrop-blur-xl",
        )}
      >
        <div className="shell flex h-20 items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="font-serif text-2xl font-semibold tracking-[-0.04em] text-primary"
            >
              ND Shop
            </Link>

            <nav className="hidden xl:flex items-center gap-7">
              {primaryNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "pb-1 text-sm font-medium text-secondary transition hover:text-primary",
                    pathname === item.href &&
                      "font-serif text-primary underline decoration-primary underline-offset-[10px]",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden lg:flex items-center gap-3 rounded-full bg-surface-container-high px-4 py-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">
              Atelier circle
            </span>
            <Badge className="bg-secondary px-2 py-1">Dev only</Badge>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/catalog"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-low text-primary transition hover:bg-surface-container-high"
              aria-label="Open catalog search"
            >
              <Search className="h-4 w-4" />
            </Link>

            <Link
              href="/cart#saved"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-low text-primary transition hover:bg-surface-container-high"
              aria-label="Open saved items"
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
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary transition hover:translate-y-[-1px]"
              aria-label="Open shopping bag"
            >
              <ShoppingBag className="h-4 w-4" />
              {cartCount ? (
                <span className="absolute right-1.5 top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-tertiary px-1 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              ) : null}
            </Link>

            <button
              type="button"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-low text-primary lg:hidden"
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>

            <Link
              href="/checkout"
              className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "hidden md:inline-flex")}
            >
              <UserRound className="h-4 w-4" />
              Account
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
            className="fixed inset-x-4 top-24 z-50 rounded-[1.75rem] border border-outline-variant/40 bg-background/95 p-6 shadow-editorial backdrop-blur-2xl lg:hidden"
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
                href="/cart"
                className="rounded-2xl bg-primary px-4 py-4 text-center text-sm font-semibold uppercase tracking-[0.24em] text-on-primary"
                onClick={() => setMenuOpen(false)}
              >
                View bag
              </Link>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
