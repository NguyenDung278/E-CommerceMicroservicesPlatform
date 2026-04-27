"use client";

import { BarChart3, ClipboardList, Package, Trash2 } from "lucide-react";

import { useAdminConsole } from "@/components/admin/admin-console-context";
import { MetricCard, reportWindows } from "@/components/admin/admin-shared";
import { cn } from "@/lib/utils";
import { formatCurrency, formatStatusLabel } from "@/utils/format";

export function AdminReportsPage() {
  const { report, reportDays, setReportDays } = useAdminConsole();

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {reportWindows.map((days) => (
          <button
            key={days}
            type="button"
            className={cn("commerce-chip", reportDays === days && "commerce-chip-active")}
            onClick={() => setReportDays(days)}
          >
            {days} ngày
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Doanh thu"
          value={formatCurrency(report?.total_revenue ?? 0)}
          description="Tổng doanh thu"
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <MetricCard
          label="Số đơn"
          value={report?.order_count ?? 0}
          description="Tổng số đơn"
          icon={<ClipboardList className="h-4 w-4" />}
        />
        <MetricCard
          label="Đơn hủy"
          value={report?.cancelled_count ?? 0}
          description="Đơn bị hủy"
          icon={<Trash2 className="h-4 w-4" />}
        />
        <MetricCard
          label="AOV"
          value={formatCurrency(report?.average_order_value ?? 0)}
          description="Giá trị trung bình mỗi đơn"
          icon={<Package className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="commerce-section">
          <p className="eyebrow">Trạng thái đơn</p>
          <h2 className="mt-2 text-2xl font-semibold text-on-surface">Breakdown theo trạng thái</h2>

          <div className="mt-5 grid gap-3">
            {(report?.status_breakdown ?? []).map((item) => (
              <div
                key={item.status}
                className="flex items-center justify-between gap-4 rounded-[var(--radius-lg)] bg-surface-container-low px-4 py-3"
              >
                <div>
                  <p className="font-medium text-on-surface">{formatStatusLabel(item.status)}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">{item.orders} đơn</p>
                </div>
                <strong className="text-primary">{formatCurrency(item.revenue)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="commerce-section">
          <p className="eyebrow">Sản phẩm bán chạy</p>
          <h2 className="mt-2 text-2xl font-semibold text-on-surface">Top sản phẩm theo doanh thu</h2>

          <div className="mt-5 grid gap-3">
            {(report?.top_products ?? []).map((item) => (
              <div
                key={item.product_id}
                className="flex items-center justify-between gap-4 rounded-[var(--radius-lg)] bg-surface-container-low px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-on-surface">{item.name}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">{item.quantity} sản phẩm</p>
                </div>
                <strong className="shrink-0 text-primary">{formatCurrency(item.revenue)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
