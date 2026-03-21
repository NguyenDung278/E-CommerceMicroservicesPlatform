import { useEffect, useState, type FormEvent } from "react";

import { FormField } from "../components/FormField";
import { ProductCard } from "../components/ProductCard";
import { useAuth } from "../hooks/useAuth";
import { api, getErrorMessage } from "../lib/api";
import type { AdminOrderReport, Product, ProductVariant } from "../types/api";
import { sanitizeMultiline, sanitizeText, sanitizeUrl, toPositiveFloat } from "../utils/sanitize";
import { validateProduct } from "../utils/validation";

type VariantFormRow = {
  id: string;
  label: string;
  sku: string;
  price: string;
  stock: string;
};

type ProductFormState = {
  name: string;
  description: string;
  price: string;
  stock: string;
  category: string;
  brand: string;
  status: string;
  sku: string;
  tags: string;
  imageUrl: string;
  variants: VariantFormRow[];
};

const productStatusOptions = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "inactive", label: "Inactive" }
];

const reportWindowOptions = [7, 30, 90];

function createEmptyVariant(): VariantFormRow {
  return {
    id: `variant-${Math.random().toString(36).slice(2, 10)}`,
    label: "",
    sku: "",
    price: "",
    stock: "0"
  };
}

function createDefaultForm(): ProductFormState {
  return {
    name: "",
    description: "",
    price: "",
    stock: "0",
    category: "",
    brand: "",
    status: "active",
    sku: "",
    tags: "",
    imageUrl: "",
    variants: []
  };
}

export function AdminPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [report, setReport] = useState<AdminOrderReport | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busyProductId, setBusyProductId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [editingProductId, setEditingProductId] = useState("");
  const [reportDays, setReportDays] = useState(30);
  const [form, setForm] = useState<ProductFormState>(createDefaultForm);

  useEffect(() => {
    void loadProducts();
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadReport(reportDays);
  }, [token, reportDays]);

  async function loadProducts() {
    try {
      const response = await api.listProducts({ limit: 100 });
      setProducts(response.data);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    }
  }

  async function loadReport(days: number) {
    if (!token) {
      return;
    }

    try {
      setIsLoadingReport(true);
      const response = await api.getAdminOrderReport(token, days);
      setReport(response.data);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsLoadingReport(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setFeedback("Bạn cần JWT admin để thao tác catalog.");
      return;
    }

    const parsedVariants = parseVariantRows(form.variants);
    const tags = parseTags(form.tags);
    const stockValue = parsedVariants.variants.length > 0
      ? parsedVariants.variants.reduce((total, item) => total + item.stock, 0)
      : Number.parseInt(form.stock, 10);

    const payload = {
      name: sanitizeText(form.name),
      description: sanitizeMultiline(form.description),
      price: toPositiveFloat(form.price),
      stock: stockValue,
      category: sanitizeText(form.category),
      brand: sanitizeText(form.brand),
      status: sanitizeText(form.status).toLowerCase(),
      sku: sanitizeText(form.sku),
      tags,
      variants: parsedVariants.variants,
      image_url: sanitizeUrl(form.imageUrl)
    };

    const errors = validateProduct({
      name: payload.name,
      description: payload.description,
      price: form.price,
      stock: parsedVariants.variants.length > 0 ? String(stockValue) : form.stock,
      imageUrl: form.imageUrl
    });

    if (!payload.brand) {
      errors.push("Brand không được để trống.");
    }
    if (!payload.status || !productStatusOptions.some((item) => item.value === payload.status)) {
      errors.push("Status phải là draft, active hoặc inactive.");
    }
    if (!payload.sku) {
      errors.push("SKU gốc không được để trống.");
    }
    if (parsedVariants.errors.length > 0) {
      errors.push(...parsedVariants.errors);
    }

    if (errors.length > 0) {
      setFeedback(errors.join(" "));
      return;
    }

    try {
      setIsCreating(true);
      if (editingProductId) {
        const response = await api.updateProduct(token, editingProductId, payload);
        setProducts((current) =>
          current.map((product) => (product.id === editingProductId ? response.data : product))
        );
        setFeedback(`Đã cập nhật sản phẩm ${response.data.name}.`);
      } else {
        const response = await api.createProduct(token, payload);
        setProducts((current) => [response.data, ...current]);
        setFeedback(`Đã tạo sản phẩm ${response.data.name}.`);
      }

      resetForm();
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsCreating(false);
    }
  }

  function handleEdit(product: Product) {
    setEditingProductId(product.id);
    setForm({
      name: product.name,
      description: product.description,
      price: String(product.price),
      stock: String(product.stock),
      category: product.category,
      brand: product.brand,
      status: product.status || "active",
      sku: product.sku,
      tags: product.tags.join(", "),
      imageUrl: product.image_url,
      variants: product.variants.map((variant) => toVariantFormRow(variant))
    });
    setFeedback(`Đang sửa sản phẩm ${product.name}.`);
  }

  async function handleDelete(product: Product) {
    if (!token) {
      setFeedback("Bạn cần JWT admin để xóa sản phẩm.");
      return;
    }

    try {
      setBusyProductId(product.id);
      await api.deleteProduct(token, product.id);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      setFeedback(`Đã xóa sản phẩm ${product.name}.`);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusyProductId("");
    }
  }

  function resetForm() {
    setForm(createDefaultForm());
    setEditingProductId("");
  }

  function updateVariantRow(id: string, field: keyof Omit<VariantFormRow, "id">, value: string) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant) =>
        variant.id === id ? { ...variant, [field]: value } : variant
      )
    }));
  }

  function addVariantRow() {
    setForm((current) => ({
      ...current,
      variants: [...current.variants, createEmptyVariant()]
    }));
  }

  function removeVariantRow(id: string) {
    setForm((current) => ({
      ...current,
      variants: current.variants.filter((variant) => variant.id !== id)
    }));
  }

  const reportCards = report
    ? [
        { label: "Doanh thu", value: `$${report.total_revenue.toFixed(2)}` },
        { label: "Đơn hàng", value: String(report.order_count) },
        { label: "Đơn hủy", value: String(report.cancelled_count) },
        { label: "AOV", value: `$${report.average_order_value.toFixed(2)}` }
      ]
    : [];

  return (
    <div className="page-stack">
      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Admin</span>
            <h1>Quản lý catalog và báo cáo sprint 5-6</h1>
          </div>
        </div>

        {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}

        <div className="admin-report-card">
          <div className="section-heading">
            <div>
              <h2>Báo cáo kinh doanh</h2>
              <p className="history-subtle">
                Snapshot doanh thu, đơn hàng và top sản phẩm cho cửa sổ gần nhất.
              </p>
            </div>
            <div className="category-filter-row">
              {reportWindowOptions.map((days) => (
                <button
                  className={reportDays === days ? "filter-chip filter-chip-active" : "filter-chip"}
                  key={days}
                  type="button"
                  onClick={() => setReportDays(days)}
                >
                  {days} ngày
                </button>
              ))}
            </div>
          </div>

          {isLoadingReport ? <div className="page-state">Đang tải báo cáo...</div> : null}

          {report ? (
            <>
              <div className="admin-report-grid">
                {reportCards.map((card) => (
                  <div className="summary-card" key={card.label}>
                    <strong>{card.value}</strong>
                    <span>{card.label}</span>
                  </div>
                ))}
              </div>

              <div className="two-column-grid">
                <div className="card admin-report-subcard">
                  <h3>Top sản phẩm bán chạy</h3>
                  <div className="order-list">
                    {report.top_products.map((item) => (
                      <div className="order-card" key={item.product_id}>
                        <strong>{item.name}</strong>
                        <span>So luong: {item.quantity}</span>
                        <span>Doanh thu: ${item.revenue.toFixed(2)}</span>
                      </div>
                    ))}
                    {report.top_products.length === 0 ? (
                      <p className="history-empty">Chưa có dữ liệu top sản phẩm trong cửa sổ này.</p>
                    ) : null}
                  </div>
                </div>

                <div className="card admin-report-subcard">
                  <h3>Phân bổ trạng thái đơn</h3>
                  <div className="order-list">
                    {report.status_breakdown.map((item) => (
                      <div className="order-card" key={item.status}>
                        <strong>{item.status}</strong>
                        <span>Đơn: {item.orders}</span>
                        <span>Giá trị: ${item.revenue.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="two-column-grid">
          <form className="card" onSubmit={handleCreate}>
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
                  onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                />
              </FormField>
              <FormField
                htmlFor="admin-product-stock"
                hint="Dùng khi sản phẩm không có variants. Nếu có variants, hệ thống sẽ lấy tổng stock từ variants."
                label="Tồn kho gốc"
              >
                <input
                  id="admin-product-stock"
                  min="0"
                  step="1"
                  type="number"
                  value={form.stock}
                  onChange={(event) => setForm((current) => ({ ...current, stock: event.target.value }))}
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
                  onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))}
                />
              </FormField>
            </div>

            <div className="inline-grid">
              <FormField htmlFor="admin-product-status" label="Status">
                <select
                  id="admin-product-status"
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
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
              <FormField htmlFor="admin-product-image-url" label="Ảnh URL">
                <input
                  id="admin-product-image-url"
                  type="url"
                  value={form.imageUrl}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, imageUrl: event.target.value }))
                  }
                />
              </FormField>
            </div>

            <div className="admin-variant-panel">
              <div className="section-heading">
                <div>
                  <h3>Variants / SKU</h3>
                  <p className="history-subtle">
                    Mỗi biến thể có SKU, giá và tồn kho riêng để chuẩn bị cho sprint scale catalog.
                  </p>
                </div>
                <button className="ghost-button" type="button" onClick={addVariantRow}>
                  Thêm biến thể
                </button>
              </div>

              <div className="admin-variant-list">
                {form.variants.map((variant) => (
                  <div className="admin-variant-row" key={variant.id}>
                    <input
                      placeholder="Tên biến thể"
                      value={variant.label}
                      onChange={(event) => updateVariantRow(variant.id, "label", event.target.value)}
                    />
                    <input
                      placeholder="SKU"
                      value={variant.sku}
                      onChange={(event) => updateVariantRow(variant.id, "sku", event.target.value)}
                    />
                    <input
                      min="0"
                      placeholder="Giá"
                      step="0.01"
                      type="number"
                      value={variant.price}
                      onChange={(event) => updateVariantRow(variant.id, "price", event.target.value)}
                    />
                    <input
                      min="0"
                      placeholder="Tồn kho"
                      step="1"
                      type="number"
                      value={variant.stock}
                      onChange={(event) => updateVariantRow(variant.id, "stock", event.target.value)}
                    />
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => removeVariantRow(variant.id)}
                    >
                      Xóa
                    </button>
                  </div>
                ))}

                {form.variants.length === 0 ? (
                  <p className="history-subtle">Chưa có biến thể nào. Sản phẩm sẽ dùng SKU và stock gốc.</p>
                ) : null}
              </div>
            </div>

            <button className="primary-button" disabled={isCreating} type="submit">
              {isCreating ? "Đang xử lý..." : editingProductId ? "Lưu cập nhật" : "Tạo sản phẩm"}
            </button>

            {editingProductId ? (
              <button className="ghost-button admin-cancel-button" onClick={resetForm} type="button">
                Hủy sửa
              </button>
            ) : null}
          </form>

          <div className="card">
            <h2>Danh sách sản phẩm</h2>
            <div className="product-grid product-grid-admin">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  adminAction={{
                    label: editingProductId === product.id ? "Đang sửa" : "Sửa sản phẩm",
                    onClick: handleEdit,
                    busy: false
                  }}
                  secondaryAdminAction={{
                    label: "Xóa sản phẩm",
                    onClick: handleDelete,
                    danger: true,
                    busy: busyProductId === product.id
                  }}
                  product={product}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => sanitizeText(tag).toLowerCase())
    .filter(Boolean);
}

function parseVariantRows(rows: VariantFormRow[]) {
  const errors: string[] = [];

  const variants = rows
    .filter((row) => row.label || row.sku || row.price || row.stock)
    .map((row, index) => {
      const price = toPositiveFloat(row.price);
      const stock = Number.parseInt(row.stock, 10);
      const label = sanitizeText(row.label);
      const sku = sanitizeText(row.sku);

      if (!label || !sku || price <= 0 || stock < 0 || Number.isNaN(stock)) {
        errors.push(`Biến thể #${index + 1} cần đủ tên, SKU, giá > 0 và tồn kho >= 0.`);
      }

      return {
        label,
        sku,
        price,
        stock: Number.isNaN(stock) ? 0 : stock
      } satisfies ProductVariant;
    });

  return { variants, errors };
}

function toVariantFormRow(variant: ProductVariant): VariantFormRow {
  return {
    id: `variant-${variant.sku}`,
    label: variant.label,
    sku: variant.sku,
    price: String(variant.price),
    stock: String(variant.stock)
  };
}
