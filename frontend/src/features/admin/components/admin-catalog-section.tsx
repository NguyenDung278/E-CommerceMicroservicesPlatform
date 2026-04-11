import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from "react";

import { FormField } from "@/components/form/form-field";
import { ProductCard } from "@/components/product/product-card";
import {
  productStatusOptions,
  type ProductFormState,
  type VariantFormRow,
} from "@/features/admin/utils/product-form";
import type { Product } from "@/types/api";

type AdminCatalogSectionProps = {
  editingProductId: string;
  form: ProductFormState;
  isCreating: boolean;
  isSyncingWorkbook: boolean;
  isUploadingImages: boolean;
  products: Product[];
  selectedImageFiles: File[];
  setForm: Dispatch<SetStateAction<ProductFormState>>;
  syncingWorkbookProductId: string;
  uploadInputKey: number;
  busyProductId: string;
  onAddVariantRow: () => void;
  onDeleteProduct: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onHandleImageSelection: (event: ChangeEvent<HTMLInputElement>) => void;
  onHandleManualImageAdd: () => void;
  onRemoveImage: (imageUrl: string) => void;
  onRemoveVariantRow: (id: string) => void;
  onResetForm: () => void;
  onSetPrimaryImage: (imageUrl: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSyncAllProducts: () => void;
  onSyncProduct: (product: Product) => void;
  onUpdateVariantRow: (id: string, field: keyof Omit<VariantFormRow, "id">, value: string) => void;
  onUploadImages: () => void;
};

export function AdminCatalogSection({
  editingProductId,
  form,
  isCreating,
  isSyncingWorkbook,
  isUploadingImages,
  products,
  selectedImageFiles,
  setForm,
  syncingWorkbookProductId,
  uploadInputKey,
  busyProductId,
  onAddVariantRow,
  onDeleteProduct,
  onEditProduct,
  onHandleImageSelection,
  onHandleManualImageAdd,
  onRemoveImage,
  onRemoveVariantRow,
  onResetForm,
  onSetPrimaryImage,
  onSubmit,
  onSyncAllProducts,
  onSyncProduct,
  onUpdateVariantRow,
  onUploadImages,
}: AdminCatalogSectionProps) {
  return (
    <div className="two-column-grid admin-console-workbench" id="admin-product-workbench">
      <form className="card admin-console-panel" onSubmit={onSubmit}>
        <h2>{editingProductId ? "Chỉnh sửa sản phẩm" : "Tạo sản phẩm mới"}</h2>

        <FormField htmlFor="admin-product-name" label="Tên sản phẩm">
          <input
            id="admin-product-name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
        </FormField>

        <FormField htmlFor="admin-product-description" label="Mô tả">
          <textarea
            id="admin-product-description"
            rows={4}
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
          />
        </FormField>

        <div className="inline-grid">
          <FormField htmlFor="admin-product-price" label="Giá">
            <input
              id="admin-product-price"
              min="0"
              step="0.01"
              type="number"
              value={form.price}
              onChange={(event) =>
                setForm((current) => ({ ...current, price: event.target.value }))
              }
            />
          </FormField>
          <FormField
            htmlFor="admin-product-stock"
            hint="Dùng khi sản phẩm không có variants. Nếu có variants, hệ thống sẽ cộng tổng tồn kho từ từng lựa chọn."
            label="Tồn kho gốc"
          >
            <input
              id="admin-product-stock"
              min="0"
              step="1"
              type="number"
              value={form.stock}
              onChange={(event) =>
                setForm((current) => ({ ...current, stock: event.target.value }))
              }
            />
          </FormField>
        </div>

        <div className="inline-grid">
          <FormField htmlFor="admin-product-category" label="Danh mục">
            <input
              id="admin-product-category"
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({ ...current, category: event.target.value }))
              }
            />
          </FormField>
          <FormField htmlFor="admin-product-brand" label="Brand">
            <input
              id="admin-product-brand"
              value={form.brand}
              onChange={(event) =>
                setForm((current) => ({ ...current, brand: event.target.value }))
              }
            />
          </FormField>
        </div>

        <div className="inline-grid">
          <FormField htmlFor="admin-product-status" label="Status">
            <select
              id="admin-product-status"
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value }))
              }
            >
              {productStatusOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField htmlFor="admin-product-sku" label="SKU gốc">
            <input
              id="admin-product-sku"
              value={form.sku}
              onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))}
            />
          </FormField>
        </div>

        <div className="inline-grid">
          <FormField htmlFor="admin-product-tags" label="Tags">
            <input
              id="admin-product-tags"
              placeholder="gaming, ultrabook, office"
              value={form.tags}
              onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
            />
          </FormField>
          <FormField
            htmlFor="admin-product-image-url"
            hint="Thêm link ảnh trực tiếp hoặc tải ảnh lên từ máy của bạn."
            label="Nguồn ảnh"
          >
            <div className="admin-image-input-row">
              <input
                id="admin-product-image-url"
                placeholder="https://..."
                type="url"
                value={form.manualImageUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, manualImageUrl: event.target.value }))
                }
              />
              <button className="ghost-button" type="button" onClick={onHandleManualImageAdd}>
                Thêm URL
              </button>
            </div>
          </FormField>
        </div>

        <div className="admin-image-panel">
          <div className="section-heading">
            <div>
              <h3>Gallery ảnh sản phẩm</h3>
              <p className="history-subtle">
                Ảnh đầu tiên sẽ được dùng làm hình đại diện chính trong catalog và các khối nổi bật.
              </p>
            </div>
          </div>

          <div className="admin-image-upload-row">
            <input
              key={uploadInputKey}
              accept="image/*"
              multiple
              type="file"
              onChange={onHandleImageSelection}
            />
            <button
              className="primary-button"
              disabled={isUploadingImages || selectedImageFiles.length === 0}
              type="button"
              onClick={onUploadImages}
            >
              {isUploadingImages ? "Đang tải ảnh..." : "Upload images"}
            </button>
          </div>

          {selectedImageFiles.length > 0 ? (
            <div className="admin-upload-chip-list">
              {selectedImageFiles.map((file) => (
                <span className="admin-upload-chip" key={`${file.name}-${file.size}`}>
                  {file.name}
                </span>
              ))}
            </div>
          ) : null}

          <div className="admin-image-grid">
            {form.imageUrls.map((imageUrl, index) => (
              <article className="admin-image-card" key={imageUrl}>
                <img alt={`Product image ${index + 1}`} src={imageUrl} />
                <div className="admin-image-card-actions">
                  {index === 0 ? (
                    <span className="status-pill status-pill-success">Ảnh chính</span>
                  ) : (
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => onSetPrimaryImage(imageUrl)}
                    >
                      Đặt làm ảnh chính
                    </button>
                  )}
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => onRemoveImage(imageUrl)}
                  >
                    Gỡ ảnh
                  </button>
                </div>
              </article>
            ))}

            {form.imageUrls.length === 0 ? (
              <p className="history-subtle">
                Chưa có ảnh nào. Hãy thêm URL hoặc tải lên một hay nhiều ảnh để tạo gallery.
              </p>
            ) : null}
          </div>
        </div>

        <div className="admin-variant-panel">
          <div className="section-heading">
            <div>
              <h3>Variants / SKU</h3>
              <p className="history-subtle">
                Quản lý màu, size, giá và tồn kho riêng cho từng lựa chọn của sản phẩm.
              </p>
            </div>
            <button className="ghost-button" type="button" onClick={onAddVariantRow}>
              Thêm biến thể
            </button>
          </div>

          <div className="admin-variant-list">
            {form.variants.map((variant) => (
              <div className="admin-variant-row" key={variant.id}>
                <input
                  placeholder="Tên biến thể"
                  value={variant.label}
                  onChange={(event) => onUpdateVariantRow(variant.id, "label", event.target.value)}
                />
                <input
                  placeholder="SKU"
                  value={variant.sku}
                  onChange={(event) => onUpdateVariantRow(variant.id, "sku", event.target.value)}
                />
                <input
                  placeholder="Size"
                  value={variant.size}
                  onChange={(event) => onUpdateVariantRow(variant.id, "size", event.target.value)}
                />
                <input
                  placeholder="Màu"
                  value={variant.color}
                  onChange={(event) => onUpdateVariantRow(variant.id, "color", event.target.value)}
                />
                <input
                  min="0"
                  placeholder="Giá"
                  step="0.01"
                  type="number"
                  value={variant.price}
                  onChange={(event) => onUpdateVariantRow(variant.id, "price", event.target.value)}
                />
                <input
                  min="0"
                  placeholder="Tồn kho"
                  step="1"
                  type="number"
                  value={variant.stock}
                  onChange={(event) => onUpdateVariantRow(variant.id, "stock", event.target.value)}
                />
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => onRemoveVariantRow(variant.id)}
                >
                  Xóa
                </button>
              </div>
            ))}

            {form.variants.length === 0 ? (
              <p className="history-subtle">
                Chưa có biến thể nào. Sản phẩm sẽ dùng SKU và tồn kho gốc.
              </p>
            ) : null}
          </div>
        </div>

        <button className="primary-button" disabled={isCreating} type="submit">
          {isCreating ? "Đang xử lý..." : editingProductId ? "Lưu cập nhật" : "Tạo sản phẩm"}
        </button>

        {editingProductId ? (
          <button className="ghost-button admin-cancel-button" type="button" onClick={onResetForm}>
            Hủy sửa
          </button>
        ) : null}
      </form>

      <div className="card admin-console-panel">
        <div className="section-heading">
          <div>
            <h2>Danh sách sản phẩm</h2>
            <p className="history-subtle">
              Review catalog items, update details, and refresh collection pages when featured
              products change.
            </p>
          </div>
          <button
            className="ghost-button"
            disabled={isSyncingWorkbook}
            type="button"
            onClick={onSyncAllProducts}
          >
            {isSyncingWorkbook ? "Updating collections..." : "Update collection pages"}
          </button>
        </div>

        <div className="product-grid product-grid-admin">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              adminAction={{
                label: editingProductId === product.id ? "Đang sửa" : "Sửa sản phẩm",
                onClick: onEditProduct,
                busy: false,
              }}
              secondaryAdminAction={{
                label: "Xóa sản phẩm",
                onClick: onDeleteProduct,
                danger: true,
                busy: busyProductId === product.id,
              }}
              tertiaryAdminAction={{
                label: "Update collection",
                onClick: onSyncProduct,
                busy: syncingWorkbookProductId === product.id,
              }}
              product={product}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
