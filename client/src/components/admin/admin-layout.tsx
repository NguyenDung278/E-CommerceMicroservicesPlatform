"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Boxes, ClipboardList, Package, RefreshCw, Warehouse } from "lucide-react";

import { AdminConsoleProvider, useAdminConsole } from "@/components/admin/admin-console-context";
import { MetricCard, formatSyncLabel } from "@/components/admin/admin-shared";
import { ProtectedView } from "@/components/protected-view";
import {
  RecoveredEditorialFooter,
  RecoveredStorefrontHeader,
} from "@/components/storefront-shared/recovered-storefront-chrome";
import { EmptyState, InlineAlert } from "@/components/storefront-shared/storefront-ui";
import { buttonStyles } from "@/lib/button-styles";
import { cn } from "@/lib/utils";
import { formatCurrency, getDisplayName } from "@/utils/format";

const adminNavigation = [
  { href: "/admin/orders", label: "Đơn hàng" },
  { href: "/admin/products", label: "Sản phẩm" },
  { href: "/admin/inventory", label: "Tồn kho" },
  { href: "/admin/reports", label: "Báo cáo" },
];

export function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedView>
      <AdminConsoleProvider>
        <AdminConsoleShell>{children}</AdminConsoleShell>
      </AdminConsoleProvider>
    </ProtectedView>
  );
}

function AdminConsoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    canAccessAdmin,
    isBootstrapping,
    user,
    feedback,
    isLoading,
    isRefreshing,
    lastSyncedAt,
    metrics,
  } = useAdminConsole();

  if (isBootstrapping || isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <RecoveredStorefrontHeader />
        <section className="shell py-10">
          <div className="commerce-section text-center">
            <p className="text-sm font-medium text-on-surface-variant">Đang tải admin console...</p>
          </div>
        </section>
      </main>
    );
  }

  if (!canAccessAdmin) {
    return (
      <main className="min-h-screen bg-background">
        <RecoveredStorefrontHeader />
        <section className="shell py-10">
          <EmptyState
            title="Không có quyền truy cập quản trị"
            description="Khu vực này chỉ dành cho admin hoặc staff vận hành cửa hàng."
            action={
              <Link href="/" className={buttonStyles({ variant: "secondary" })}>
                Về storefront
              </Link>
            }
          />
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <RecoveredStorefrontHeader />

      <section className="commerce-page-head">
        <div className="shell grid gap-5 py-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
          <div>
            <p className="eyebrow">Admin vận hành</p>
            <h1 className="mt-2 text-3xl font-semibold text-on-surface md:text-[2.8rem]">
              Theo dõi catalog, đơn hàng, tồn kho và báo cáo bằng nested routes thật.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-on-surface-variant">
              Console này giữ toàn bộ workflow vận hành ở một layout chung, còn mỗi route con chỉ
              hiển thị domain riêng của nó.
            </p>
          </div>

          <div className="metric-tile">
            <div className="flex items-center justify-between gap-3 text-sm text-on-surface-variant">
              <span>Phiên vận hành</span>
              <RefreshCw className={cn("h-4 w-4 text-primary", isRefreshing && "animate-spin")} />
            </div>
            <strong className="mt-3 block text-lg font-semibold text-on-surface">
              {getDisplayName(user?.first_name, user?.last_name)}
            </strong>
            <p className="mt-2 text-sm text-on-surface-variant">
              Đồng bộ gần nhất: {formatSyncLabel(lastSyncedAt)}
            </p>
          </div>
        </div>
      </section>

      <section className="shell py-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Tổng sản phẩm"
            value={metrics.totalProducts}
            description="Toàn bộ catalog"
            icon={<Boxes className="h-4 w-4" />}
          />
          <MetricCard
            label="Đang bán"
            value={metrics.activeProducts}
            description="Sản phẩm active"
            icon={<Package className="h-4 w-4" />}
          />
          <MetricCard
            label="Sắp hết hàng"
            value={metrics.lowStockProducts}
            description="Tồn kho <= 5"
            icon={<Warehouse className="h-4 w-4" />}
          />
          <MetricCard
            label="Đơn đang mở"
            value={metrics.openOrders}
            description="Có thể tiếp tục xử lý"
            icon={<ClipboardList className="h-4 w-4" />}
          />
          <MetricCard
            label="Doanh thu gần đây"
            value={formatCurrency(metrics.revenue)}
            description="Theo cửa sổ báo cáo hiện tại"
            icon={<BarChart3 className="h-4 w-4" />}
          />
        </div>
      </section>

      <section className="shell pb-4">
        <nav className="flex flex-wrap gap-2" aria-label="Điều hướng quản trị">
          {adminNavigation.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("admin-tab", active && "admin-tab-active")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </section>

      <section className="shell pb-10">
        {feedback ? (
          <div className="mb-4">
            <InlineAlert tone="info">{feedback}</InlineAlert>
          </div>
        ) : null}
        {children}
      </section>

      <RecoveredEditorialFooter />
    </main>
  );
}
