"use client";

import { RefreshCw } from "lucide-react";

import { formatStorefrontSyncLabel } from "@/components/storefront/storefront-shared";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/format";

export function ProductSyncPanel({
  isLoading,
  lastSyncedAt,
  selectedSku,
  updatedAt,
}: {
  isLoading: boolean;
  lastSyncedAt: Date | null;
  selectedSku: string;
  updatedAt: string;
}) {
  return (
    <section className="commerce-section">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-on-surface">Đồng bộ storefront</p>
          <p className="mt-1 text-sm text-on-surface-variant">Dữ liệu được lấy lại mỗi 5 giây.</p>
        </div>
        <RefreshCw className={cn("h-4 w-4 text-primary", isLoading && "animate-spin")} />
      </div>

      <div className="mt-5 grid gap-3 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-on-surface-variant">Lần đồng bộ gần nhất</span>
          <strong>{formatStorefrontSyncLabel(lastSyncedAt)}</strong>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-on-surface-variant">SKU</span>
          <strong>{selectedSku || "Đang cập nhật"}</strong>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-on-surface-variant">Cập nhật catalog</span>
          <strong>{formatDateTime(updatedAt)}</strong>
        </div>
      </div>
    </section>
  );
}
