import Link from "next/link";

import { buttonStyles } from "@/lib/button-styles";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="shell flex min-h-[70svh] items-center justify-center py-16">
        <div className="max-w-2xl rounded-[2rem] bg-white/55 px-8 py-14 text-center shadow-[0_24px_48px_-24px_rgba(27,28,25,0.25)]">
          <p className="eyebrow">404</p>
          <h1 className="mt-4 font-serif text-5xl font-semibold tracking-[-0.04em] text-primary">
            The page slipped out of the archive
          </h1>
          <p className="mt-5 text-base leading-8 text-on-surface-variant">
            This route is missing, but the storefront shell is intact. Jump back
            to the home page or continue exploring the product archive.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/" className={buttonStyles({ size: "lg" })}>
              Back home
            </Link>
            <Link
              href="/catalog"
              className={buttonStyles({ variant: "secondary", size: "lg" })}
            >
              Open catalog
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
