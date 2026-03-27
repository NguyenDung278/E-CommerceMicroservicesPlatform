import Link from "next/link";
import { Globe, HandCoins } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-surface-container-low">
      <div className="shell flex flex-col gap-10 border-t border-outline-variant/20 py-12 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/" className="font-serif text-xl font-semibold tracking-[-0.03em] text-primary">
            ND Shop
          </Link>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary">
            Crafted for the discerning
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">
          <Link href="/catalog" className="transition hover:text-primary">
            Collection
          </Link>
          <Link href="/cart" className="transition hover:text-primary">
            Bag
          </Link>
          <Link href="/checkout" className="transition hover:text-primary">
            Checkout
          </Link>
          <a href="#system" className="transition hover:text-primary">
            System
          </a>
        </div>

        <div className="flex items-center gap-4 text-primary">
          <Globe className="h-4 w-4" />
          <HandCoins className="h-4 w-4" />
        </div>
      </div>
    </footer>
  );
}
