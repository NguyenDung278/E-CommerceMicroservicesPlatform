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
import { useAuthActions, useAuthState } from "@/hooks/useAuth";
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
  const { user } = useAuthState();
  const { logout } = useAuthActions();

  return (
    <ProtectedView>
      <SiteHeader />
      <main className="shell section-spacing">
        <section className="grid gap-10 lg:grid-cols-[272px_minmax(0,1fr)] xl:gap-14">
          <aside className="space-y-8 lg:sticky lg:top-28 lg:h-fit">
            <div className="px-2">
              <p className="eyebrow">My account</p>
              <h2 className="mt-4 font-serif text-[2rem] font-semibold tracking-[-0.04em] text-primary">
                Quản lý tài khoản
              </h2>
              <p className="mt-3 max-w-[18rem] text-sm leading-7 text-on-surface-variant">
                Cập nhật thông tin, theo dõi đơn hàng và kiểm soát các thiết lập bảo mật trong cùng một không gian.
              </p>
            </div>

            <nav className="space-y-1" aria-label="Điều hướng tài khoản">
              {accountLinks.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-r-full px-5 py-3 text-sm font-medium transition duration-300",
                      active
                        ? "translate-x-1 bg-surface-container-low text-primary"
                        : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <SurfaceCard className="p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-base font-semibold text-on-primary">
                  {getInitials(getDisplayName(user?.first_name, user?.last_name))}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-primary">
                    {getDisplayName(user?.first_name, user?.last_name)}
                  </p>
                  <p className="truncate text-sm text-on-surface-variant">{user?.email}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge>{user?.email_verified ? "Email đã xác minh" : "Cần xác minh"}</Badge>
                <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-outline">
                  {user?.role}
                </span>
              </div>

              <button
                type="button"
                className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "mt-5 w-full")}
                onClick={logout}
              >
                Đăng xuất
              </button>
            </SurfaceCard>
          </aside>

          <div className="space-y-8">
            <header className="border-b border-outline-variant/30 pb-8">
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
