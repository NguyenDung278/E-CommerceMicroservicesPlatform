"use client";

import { useAdminConsole } from "@/components/admin/admin-console-context";
import { inputClassName, labelClassName, StatusPill } from "@/components/admin/admin-shared";
import { buttonStyles } from "@/lib/button-styles";

export function AdminInventoryPage() {
  const {
    inventoryProducts,
    inventoryDrafts,
    busyProductId,
    setInventoryDraftValue,
    saveInventory,
  } = useAdminConsole();

  return (
    <div className="grid gap-4">
      <div className="rounded-[var(--radius-2xl)] border border-outline-variant bg-surface p-4 shadow-[var(--shadow-card)]">
        <p className="eyebrow">Tồn kho</p>
        <h2 className="mt-2 text-2xl font-semibold text-on-surface">
          Ưu tiên sản phẩm sắp hết trước để thao tác nhanh
        </h2>
      </div>

      <div className="grid gap-3">
        {inventoryProducts.map((product) => (
          <article
            key={product.id}
            className="commerce-card grid gap-4 p-4 lg:grid-cols-[minmax(0,1.2fr)_140px_160px_220px]"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={product.status} />
                <span className="text-sm text-on-surface-variant">{product.category || "Chưa có danh mục"}</span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-on-surface">{product.name}</h3>
              <p className="mt-1 text-sm text-on-surface-variant">SKU: {product.sku || "Chưa có"}</p>
            </div>

            <div>
              <p className="text-sm text-on-surface-variant">Tồn kho hiện tại</p>
              <strong className="mt-2 block text-2xl font-semibold text-on-surface">
                {product.stock}
              </strong>
            </div>

            <label className={labelClassName}>
              Tồn kho mới
              <input
                className={inputClassName}
                inputMode="numeric"
                value={inventoryDrafts[product.id] ?? String(product.stock)}
                onChange={(event) => setInventoryDraftValue(product.id, event.target.value)}
              />
            </label>

            <div className="flex flex-wrap items-end gap-2">
              <button
                type="button"
                className={buttonStyles({ variant: "secondary", size: "sm" })}
                onClick={() =>
                  setInventoryDraftValue(product.id, String(Math.max(0, product.stock - 5)))
                }
              >
                -5
              </button>
              <button
                type="button"
                className={buttonStyles({ variant: "secondary", size: "sm" })}
                onClick={() => setInventoryDraftValue(product.id, String(product.stock + 5))}
              >
                +5
              </button>
              <button
                type="button"
                className={buttonStyles({ size: "sm" })}
                disabled={busyProductId === product.id}
                onClick={() => void saveInventory(product)}
              >
                Lưu tồn kho
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
