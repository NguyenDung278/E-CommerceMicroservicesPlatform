"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CreditCard,
  MapPin,
  Package,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ProtectedView } from "@/components/protected-view";
import { Badge, SurfaceCard } from "@/components/storefront-ui";
import { useAuth } from "@/hooks/useAuth";
import { buttonStyles } from "@/lib/button-styles";
import { cn } from "@/lib/utils";
import { getDisplayName, getInitials } from "@/utils/format";

const accountLinks = [
  { href: "/profile", label: "Tài khoản", icon: UserRound },
  { href: "/myorders", label: "Đơn hàng", icon: Package },
  { href: "/addresses", label: "Địa chỉ", icon: MapPin },
  { href: "/payments", label: "Thanh toán", icon: CreditCard },
  { href: "/security", label: "Bảo mật", icon: ShieldCheck },
  { href: "/notifications", label: "Thông báo", icon: Bell },
];

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
  const { user, logout } = useAuth();

  return (
    <ProtectedView>
      <SiteHeader />
      <main className="shell section-spacing space-y-8">
        <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <SurfaceCard className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-lg font-semibold text-on-primary">
                  {getInitials(getDisplayName(user?.first_name, user?.last_name))}
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-tertiary">
                    Tài khoản khách hàng
                  </p>
                  <h2 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                    {getDisplayName(user?.first_name, user?.last_name)}
                  </h2>
                  <p className="text-sm text-on-surface-variant">{user?.email}</p>
                </div>
              </div>
              <div className="mt-5 flex items-center gap-3">
                <Badge>{user?.email_verified ? "Email đã xác minh" : "Cần xác minh email"}</Badge>
                <span className="text-xs uppercase tracking-[0.24em] text-outline">{user?.role}</span>
              </div>
              <button
                type="button"
                className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "mt-5 w-full")}
                onClick={logout}
              >
                Đăng xuất
              </button>
            </SurfaceCard>

            <nav className="space-y-2 rounded-[1.75rem] bg-surface-container-low p-3" aria-label="Điều hướng tài khoản">
              {accountLinks.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-[1.25rem] px-4 py-3 text-sm font-medium transition",
                      active
                        ? "bg-primary text-on-primary shadow-editorial"
                        : "text-on-surface-variant hover:bg-surface hover:text-primary",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div className="space-y-6">
            <header className="rounded-[2rem] bg-surface-container-low px-6 py-8 md:px-8">
              <p className="eyebrow">Trung tâm tài khoản</p>
              <h1 className="mt-4 font-serif text-4xl font-semibold tracking-[-0.04em] text-primary md:text-5xl">
                {title}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-on-surface-variant md:text-lg">
                {description}
              </p>
            </header>

            {children}
          </div>
        </section>
      </main>
      <SiteFooter />
    </ProtectedView>
  );
}
