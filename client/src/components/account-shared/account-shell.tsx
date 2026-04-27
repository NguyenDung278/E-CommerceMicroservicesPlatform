"use client";

import { usePathname } from "next/navigation";

import { ProtectedView } from "@/components/protected-view";
import { RecoveredAccountSidebar } from "@/components/account-shared/recovered-account-sidebar";
import {
  RecoveredEditorialFooter,
  RecoveredStorefrontHeader,
} from "@/components/storefront-shared/recovered-storefront-chrome";

export function AccountShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const navigation =
    pathname === "/profile" || pathname === "/myorders" || pathname === "/returns"
      ? "fallback"
      : "core";

  return (
    <ProtectedView>
      <main className="page-stack account-page min-h-screen">
        <section className="account-shell shell pt-6 md:pt-8">
          <RecoveredStorefrontHeader navigation={navigation} tone="light" />
        </section>

        <section className="account-shell shell py-10 md:py-14">
          <div className="account-layout grid gap-8 xl:grid-cols-[320px_minmax(0,1fr)] xl:gap-10">
            <RecoveredAccountSidebar />

            <div className="account-content space-y-8">
              <header className="recovered-account-hero rounded-[2rem] border border-[#ddd5cc] bg-white/74 px-6 py-7 shadow-[0_28px_48px_-30px_rgba(27,28,25,0.16)] backdrop-blur md:px-8">
                <p className="eyebrow">Tài khoản</p>
                <h1 className="mt-4 font-serif text-4xl font-semibold tracking-[-0.04em] text-primary md:text-5xl">
                  {title}
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-on-surface-variant md:text-lg">
                  {description}
                </p>
              </header>

              {children}
            </div>
          </div>
        </section>

        <section className="account-shell shell pb-12">
          <RecoveredEditorialFooter variant="layout" />
        </section>
      </main>
    </ProtectedView>
  );
}
