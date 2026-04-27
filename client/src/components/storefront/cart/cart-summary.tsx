"use client";

import Link from "next/link";

import { buttonStyles } from "@/lib/button-styles";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";

export function CartSummary({
  itemCount,
  totalUnits,
  liveTotal,
  onClearCart,
}: {
  itemCount: number;
  totalUnits: number;
  liveTotal: number;
  onClearCart: () => Promise<void>;
}) {
  return (
    <aside className="grid h-fit gap-4 lg:sticky lg:top-24">
      <section className="commerce-section">
        <h2 className="text-lg font-semibold text-on-surface">Tóm tắt đơn hàng</h2>
        <div className="mt-5 grid gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-on-surface-variant">Dòng sản phẩm</span>
            <strong>{itemCount}</strong>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-on-surface-variant">Tổng số lượng</span>
            <strong>{totalUnits}</strong>
          </div>
          <div className="flex justify-between gap-4 border-t border-outline-variant pt-3">
            <span className="text-on-surface-variant">Tạm tính realtime</span>
            <strong className="text-xl text-primary">{formatCurrency(liveTotal)}</strong>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          <Link
            href="/checkout"
            className={cn(buttonStyles({ size: "lg" }), itemCount === 0 && "pointer-events-none opacity-50")}
          >
            Đi tới thanh toán
          </Link>
          <button
            type="button"
            className={buttonStyles({ variant: "secondary", size: "lg" })}
            disabled={itemCount === 0}
            onClick={() => void onClearCart()}
          >
            Xóa toàn bộ giỏ hàng
          </button>
        </div>
      </section>

      <section className="commerce-section">
        <p className="text-sm font-medium text-on-surface">Nguyên tắc hiển thị</p>
        <ul className="mt-4 grid gap-2 text-sm text-on-surface-variant">
          <li>Chỉ hiện tên sản phẩm, danh mục, giá, tồn kho và thao tác số lượng.</li>
          <li>Không chèn nội dung marketing ngoài flow mua hàng.</li>
          <li>Giá đang tính theo dữ liệu sản phẩm mới nhất từ admin.</li>
        </ul>
      </section>
    </aside>
  );
}
