"use client";

import Link from "next/link";
import { Edit3, Trash2 } from "lucide-react";
import { type FormEvent } from "react";

import { useAdminConsole } from "@/components/admin/admin-console-context";
import {
  getProductImage,
  inputClassName,
  labelClassName,
  productStatuses,
  StatusPill,
  type ProductStatus,
} from "@/components/admin/admin-shared";
import { StorefrontImage } from "@/components/storefront-shared/storefront-image";
import { buttonStyles } from "@/lib/button-styles";
import { cn } from "@/lib/utils";
import { formatCurrency, formatStatusLabel } from "@/utils/format";

export function AdminProductsPage() {
  const {
    products,
    form,
    setForm,
    editingProductId,
    isSaving,
    busyProductId,
    resetProductForm,
    startEditingProduct,
    saveProductForm,
    deleteProduct,
    patchProduct,
    refreshAdminData,
  } = useAdminConsole();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveProductForm();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <section className="commerce-section">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Biểu mẫu</p>
            <h2 className="mt-2 text-2xl font-semibold text-on-surface">
              {editingProductId ? "Cập nhật sản phẩm" : "Tạo sản phẩm mới"}
            </h2>
          </div>
          {editingProductId ? (
            <button
              type="button"
              className={buttonStyles({ variant: "secondary", size: "sm" })}
              onClick={resetProductForm}
            >
              Hủy sửa
            </button>
          ) : null}
        </div>

        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <label className={labelClassName}>
            Tên sản phẩm
            <input
              className={inputClassName}
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>

          <label className={labelClassName}>
            Danh mục
            <input
              className={inputClassName}
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClassName}>
              Giá
              <input
                className={inputClassName}
                inputMode="decimal"
                value={form.price}
                onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
              />
            </label>

            <label className={labelClassName}>
              Tồn kho
              <input
                className={inputClassName}
                inputMode="numeric"
                value={form.stock}
                onChange={(event) => setForm((current) => ({ ...current, stock: event.target.value }))}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClassName}>
              SKU
              <input
                className={inputClassName}
                value={form.sku}
                onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))}
              />
            </label>

            <label className={labelClassName}>
              Trạng thái
              <select
                className={inputClassName}
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as ProductStatus,
                  }))
                }
              >
                {productStatuses.map((status) => (
                  <option key={status} value={status}>
                    {formatStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className={labelClassName}>
            Ảnh đại diện
            <input
              className={inputClassName}
              value={form.imageUrl}
              onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))}
            />
          </label>

          <label className={labelClassName}>
            Mô tả ngắn
            <textarea
              className={cn(inputClassName, "min-h-28")}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </label>

          <button type="submit" className={buttonStyles({ size: "lg" })} disabled={isSaving}>
            {isSaving ? "Đang lưu..." : editingProductId ? "Lưu cập nhật" : "Tạo sản phẩm"}
          </button>
        </form>
      </section>

      <section className="grid gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Catalog</p>
            <h2 className="mt-2 text-2xl font-semibold text-on-surface">Danh sách sản phẩm</h2>
          </div>
          <button
            type="button"
            className={buttonStyles({ variant: "secondary", size: "sm" })}
            onClick={() => void refreshAdminData(false)}
          >
            Làm mới
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {products.map((product) => (
            <article key={product.id} className="commerce-card grid gap-4 p-4 sm:grid-cols-[96px_minmax(0,1fr)]">
              <div className="relative aspect-square overflow-hidden rounded-[var(--radius-lg)] bg-surface-container-low">
                <StorefrontImage
                  alt={product.name}
                  src={getProductImage(product)}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={product.status} />
                  <span className="text-xs text-on-surface-variant">{product.category || "Chưa có danh mục"}</span>
                </div>
                <h3 className="mt-3 line-clamp-2 text-base font-semibold text-on-surface">
                  {product.name}
                </h3>
                <div className="mt-3 grid gap-2 text-sm text-on-surface-variant">
                  <div className="flex justify-between gap-4">
                    <span>Giá</span>
                    <strong className="text-on-surface">{formatCurrency(product.price)}</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Tồn kho</span>
                    <strong className="text-on-surface">{product.stock}</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>SKU</span>
                    <strong className="text-on-surface">{product.sku || "Chưa có"}</strong>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={buttonStyles({ variant: "secondary", size: "sm" })}
                    onClick={() => startEditingProduct(product)}
                  >
                    <Edit3 className="h-4 w-4" />
                    Sửa
                  </button>
                  <button
                    type="button"
                    className={buttonStyles({ variant: "secondary", size: "sm" })}
                    disabled={busyProductId === product.id}
                    onClick={() =>
                      void patchProduct(product, {
                        status: product.status === "active" ? "inactive" : "active",
                      })
                    }
                  >
                    {product.status === "active" ? "Ẩn khỏi storefront" : "Mở bán lại"}
                  </button>
                  <button
                    type="button"
                    className={buttonStyles({ variant: "secondary", size: "sm" })}
                    disabled={busyProductId === product.id}
                    onClick={() => void deleteProduct(product)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Xóa
                  </button>
                  <Link
                    href={`/products/${product.id}`}
                    className={buttonStyles({ variant: "ghost", size: "sm" })}
                  >
                    Xem storefront
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
