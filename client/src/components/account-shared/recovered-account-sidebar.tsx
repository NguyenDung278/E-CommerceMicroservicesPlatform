"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { useAuthActions, useAuthState } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { getDisplayName, getInitials } from "@/utils/format";
import { accountNavigationItems } from "@/components/account-shared/account-navigation";

export function RecoveredAccountSidebar() {
  const pathname = usePathname();
  const { user } = useAuthState();
  const { logout } = useAuthActions();
  const displayName = getDisplayName(user?.first_name, user?.last_name);

  return (
    <aside className="account-sidebar xl:sticky xl:top-8 xl:h-fit">
      <div className="account-sidebar-panel rounded-[2rem] border border-[#d7d0c7] bg-white/78 p-6 shadow-[0_28px_48px_-30px_rgba(27,28,25,0.2)] backdrop-blur">
        <div className="account-sidebar-head border-b border-[#e7e0d7] pb-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary">
              {getInitials(displayName)}
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-serif text-2xl font-semibold tracking-[-0.04em] text-primary">
                My Account
              </h2>
              <p className="mt-1 truncate text-sm text-on-surface-variant">
                {user?.email || "Manage your preferences"}
              </p>
            </div>
          </div>
        </div>

        <nav className="account-sidebar-nav mt-5 grid gap-2" aria-label="Recovered account navigation">
          {accountNavigationItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "account-sidebar-link flex items-center gap-3 rounded-[1.25rem] px-4 py-3 text-sm transition",
                  active
                    ? "account-sidebar-link-active bg-[#0c1f14] text-white"
                    : "text-on-surface-variant hover:bg-[#f7f3ed] hover:text-primary",
                )}
              >
                <span className="account-sidebar-icon" aria-hidden="true">
                  <Icon className="h-4 w-4" />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 rounded-[1.5rem] bg-[#f6f1ea] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
            Signed in as
          </p>
          <p className="mt-2 font-medium text-primary">{displayName}</p>
          <p className="mt-1 text-sm text-on-surface-variant">{user?.role || "user"}</p>
        </div>

        <button
          type="button"
          className="account-sidebar-logout mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#d7d0c7] px-4 py-3 text-sm font-medium text-primary transition hover:border-primary/25 hover:bg-[#f7f3ed]"
          onClick={logout}
        >
          <span className="account-sidebar-icon" aria-hidden="true">
            <LogOut className="h-4 w-4" />
          </span>
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
}
