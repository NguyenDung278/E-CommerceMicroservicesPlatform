import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

import { FormField } from "../components/FormField";
import { ProductCard } from "../components/ProductCard";
import { useAuth } from "../hooks/useAuth";
import { api, getErrorMessage } from "../lib/api";
import type { AdminOrderReport, Coupon, Order, Payment, Product, ProductVariant, UserProfile } from "../types/api";
import { formatCurrency, formatDateTime } from "../utils/format";
import { sanitizeMultiline, sanitizeText, sanitizeUrl, toPositiveFloat } from "../utils/sanitize";
import { validateProduct } from "../utils/validation";

type VariantFormRow = {
  id: string;
  label: string;
  sku: string;
  size: string;
  color: string;
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
  imageUrls: string[];
  manualImageUrl: string;
  variants: VariantFormRow[];
};

type CouponFormState = {
  code: string;
  description: string;
  discountType: "fixed" | "percentage";
  discountValue: string;
  minOrderAmount: string;
  usageLimit: string;
  expiresAt: string;
  active: boolean;
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
    size: "",
    color: "",
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
    imageUrls: [],
    manualImageUrl: "",
    variants: []
  };
}

function createDefaultCouponForm(): CouponFormState {
  return {
    code: "",
    description: "",
    discountType: "percentage",
    discountValue: "",
    minOrderAmount: "0",
    usageLimit: "0",
    expiresAt: "",
    active: true
  };
}

export function AdminPage() {
  const { token, isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [paymentsByOrder, setPaymentsByOrder] = useState<Record<string, Payment[]>>({});
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [report, setReport] = useState<AdminOrderReport | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busyProductId, setBusyProductId] = useState("");
  const [busyOrderId, setBusyOrderId] = useState("");
  const [busyRefundId, setBusyRefundId] = useState("");
  const [busyUserId, setBusyUserId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isCreatingCoupon, setIsCreatingCoupon] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [editingProductId, setEditingProductId] = useState("");
  const [reportDays, setReportDays] = useState(30);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);
  const [form, setForm] = useState<ProductFormState>(createDefaultForm);
  const [couponForm, setCouponForm] = useState<CouponFormState>(createDefaultCouponForm);

  useEffect(() => {
    void loadProducts();
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadReport(reportDays);
    void loadCoupons();
    void loadAdminOrders();
    if (isAdmin) {
      void loadUsers();
    }
  }, [token, reportDays, isAdmin]);

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

  async function loadCoupons() {
    if (!token) {
      return;
    }

    try {
      const response = await api.listCoupons(token);
      setCoupons(response.data);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    }
  }

  async function loadUsers() {
    if (!token || !isAdmin) {
      return;
    }

    try {
      setIsLoadingUsers(true);
      const response = await api.listUsers(token);
      setUsers(response.data);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsLoadingUsers(false);
    }
  }

  async function loadAdminOrders() {
    if (!token) {
      return;
    }

    try {
      setIsLoadingOrders(true);
      const response = await api.listAdminOrders(token, { limit: 8 });
      setOrders(response.data);

      const paymentEntries = await Promise.all(
        response.data.map(async (order) => {
          try {
            const paymentResponse = await api.listAdminPaymentsByOrder(token, order.id);
            return [order.id, paymentResponse.data] as const;
          } catch {
            return [order.id, []] as const;
          }
        })
      );

      setPaymentsByOrder(Object.fromEntries(paymentEntries));
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsLoadingOrders(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setFeedback("Bạn cần JWT staff/admin để thao tác catalog.");
      return;
    }

    const parsedVariants = parseVariantRows(form.variants);
    const tags = parseTags(form.tags);
    const imageUrls = normalizeProductImageUrls(form.imageUrls);
    const primaryImageUrl = imageUrls[0] ?? "";
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
      image_url: primaryImageUrl,
      image_urls: imageUrls
    };

    const errors = validateProduct({
      name: payload.name,
      description: payload.description,
      price: form.price,
      stock: parsedVariants.variants.length > 0 ? String(stockValue) : form.stock,
      imageUrl: primaryImageUrl
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

  async function handleCreateCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setFeedback("Bạn cần JWT staff/admin để quản trị coupon.");
      return;
    }

    const code = sanitizeText(couponForm.code).toUpperCase();
    const description = sanitizeText(couponForm.description);
    const discountValue = toPositiveFloat(couponForm.discountValue);
    const minOrderAmount = Math.max(0, toPositiveFloat(couponForm.minOrderAmount));
    const usageLimit = Math.max(0, Number.parseInt(couponForm.usageLimit, 10) || 0);
    const expiresAt = toOptionalIsoDateTime(couponForm.expiresAt);
    const errors: string[] = [];

    if (!code) {
      errors.push("Mã coupon không được để trống.");
    }
    if (discountValue <= 0) {
      errors.push("Giá trị giảm phải lớn hơn 0.");
    }
    if (couponForm.discountType === "percentage" && discountValue > 100) {
      errors.push("Coupon theo phần trăm không được vượt quá 100%.");
    }
    if (couponForm.expiresAt && !expiresAt) {
      errors.push("Thời gian hết hạn chưa hợp lệ.");
    }

    if (errors.length > 0) {
      setFeedback(errors.join(" "));
      return;
    }

    try {
      setIsCreatingCoupon(true);
      const response = await api.createCoupon(token, {
        code,
        description: description || undefined,
        discount_type: couponForm.discountType,
        discount_value: discountValue,
        min_order_amount: minOrderAmount,
        usage_limit: usageLimit,
        expires_at: expiresAt,
        active: couponForm.active
      });
      setCoupons((current) => [response.data, ...current]);
      setCouponForm(createDefaultCouponForm());
      setFeedback(`Đã tạo coupon ${response.data.code}.`);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsCreatingCoupon(false);
    }
  }

  async function handleRoleChange(userId: string, role: string) {
    if (!token) {
      setFeedback("Bạn cần JWT admin để đổi role.");
      return;
    }

    try {
      setBusyUserId(userId);
      const response = await api.updateUserRole(token, userId, { role });
      setUsers((current) => current.map((user) => (user.id === userId ? response.data : user)));
      setFeedback(`Đã cập nhật quyền cho ${response.data.email} thành ${response.data.role}.`);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusyUserId("");
    }
  }

  function handleEdit(product: Product) {
    const imageUrls = product.image_urls.length > 0
      ? product.image_urls
      : product.image_url
        ? [product.image_url]
        : [];

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
      imageUrls,
      manualImageUrl: "",
      variants: product.variants.map((variant) => toVariantFormRow(variant))
    });
    setSelectedImageFiles([]);
    setUploadInputKey((current) => current + 1);
    setFeedback(`Đang sửa sản phẩm ${product.name}.`);
  }

  async function handleDelete(product: Product) {
    if (!token) {
      setFeedback("Bạn cần JWT staff/admin để xóa sản phẩm.");
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

  async function handleManualCancel(order: Order) {
    if (!token) {
      setFeedback("Bạn cần JWT staff/admin để hủy đơn.");
      return;
    }

    try {
      setBusyOrderId(order.id);
      const response = await api.cancelAdminOrder(token, order.id, {
        message: "Order cancelled manually from admin dashboard."
      });
      setOrders((current) => current.map((item) => (item.id === order.id ? response.data : item)));
      setFeedback(`Đã hủy thủ công đơn ${order.id}.`);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusyOrderId("");
    }
  }

  async function handleRefund(payment: Payment) {
    if (!token) {
      setFeedback("Bạn cần JWT staff/admin để hoàn tiền.");
      return;
    }

    try {
      setBusyRefundId(payment.id);
      await api.refundPayment(token, payment.id);
      await loadAdminOrders();
      setFeedback(`Đã tạo refund cho giao dịch ${payment.id}.`);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusyRefundId("");
    }
  }

  function resetForm() {
    setForm(createDefaultForm());
    setEditingProductId("");
    setSelectedImageFiles([]);
    setUploadInputKey((current) => current + 1);
  }

  function handleManualImageAdd() {
    const imageUrl = sanitizeUrl(form.manualImageUrl);
    if (!imageUrl) {
      setFeedback("Ảnh URL phải bắt đầu bằng http:// hoặc https://.");
      return;
    }

    setForm((current) => ({
      ...current,
      imageUrls: mergeImageUrls(current.imageUrls, [imageUrl]),
      manualImageUrl: ""
    }));
  }

  function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    setSelectedImageFiles(Array.from(event.target.files ?? []));
  }

  async function handleUploadImages() {
    if (!token) {
      setFeedback("Bạn cần JWT staff/admin để upload ảnh.");
      return;
    }
    if (selectedImageFiles.length === 0) {
      setFeedback("Hãy chọn ít nhất một ảnh trước khi upload.");
      return;
    }

    try {
      setIsUploadingImages(true);
      const response = await api.uploadProductImages(token, selectedImageFiles);
      setForm((current) => ({
        ...current,
        imageUrls: mergeImageUrls(current.imageUrls, response.data.urls)
      }));
      setSelectedImageFiles([]);
      setUploadInputKey((current) => current + 1);
      setFeedback(`Đã upload ${response.data.urls.length} ảnh lên object storage.`);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsUploadingImages(false);
    }
  }

  function handleRemoveImage(imageUrl: string) {
    setForm((current) => ({
      ...current,
      imageUrls: current.imageUrls.filter((item) => item !== imageUrl)
    }));
  }

  function handleSetPrimaryImage(imageUrl: string) {
    setForm((current) => ({
      ...current,
      imageUrls: [imageUrl, ...current.imageUrls.filter((item) => item !== imageUrl)]
    }));
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

        <div className="card admin-report-subcard">
          <div className="section-heading">
            <div>
              <h2>Đơn gần đây</h2>
              <p className="history-subtle">
                Staff/Admin có thể hủy thủ công đơn `pending` / `paid` và refund full cho các giao dịch charge đã completed.
              </p>
            </div>
          </div>

          {isLoadingOrders ? <div className="page-state">Đang tải đơn gần đây...</div> : null}

          <div className="order-list">
            {orders.map((order) => {
              const payments = paymentsByOrder[order.id] ?? [];
              return (
                <article className="coupon-admin-card" key={order.id}>
                  <div className="coupon-admin-head">
                    <div>
                      <strong>{order.id}</strong>
                      <p className="history-subtle">
                        User: {order.user_id} • {formatDateTime(order.created_at)}
                      </p>
                    </div>
                    <span className="status-pill status-pill-neutral">{order.status}</span>
                  </div>

                  <div className="coupon-admin-grid">
                    <div>
                      <span>Tổng tiền</span>
                      <strong>{formatCurrency(order.total_price)}</strong>
                    </div>
                    <div>
                      <span>Vận chuyển</span>
                      <strong>{order.shipping_method}</strong>
                    </div>
                  </div>

                  {(order.status === "pending" || order.status === "paid") ? (
                    <div className="history-actions">
                      <button
                        className="ghost-button"
                        disabled={busyOrderId === order.id}
                        type="button"
                        onClick={() => void handleManualCancel(order)}
                      >
                        {busyOrderId === order.id ? "Đang hủy..." : "Hủy thủ công"}
                      </button>
                    </div>
                  ) : null}

                  <div className="order-list">
                    {payments.map((payment) => (
                      <div className="coupon-preview-card" key={payment.id}>
                        <strong>{payment.id}</strong>
                        <span>
                          {payment.payment_method} • {payment.transaction_type} • {payment.status}
                        </span>
                        <span>{formatCurrency(payment.amount)}</span>
                        {payment.transaction_type === "charge" && payment.status === "completed" ? (
                          <button
                            className="ghost-button"
                            disabled={busyRefundId === payment.id}
                            type="button"
                            onClick={() => void handleRefund(payment)}
                          >
                            {busyRefundId === payment.id ? "Đang refund..." : "Refund full"}
                          </button>
                        ) : null}
                      </div>
                    ))}

                    {payments.length === 0 ? (
                      <p className="history-empty">Chưa có payment nào cho đơn này.</p>
                    ) : null}
                  </div>
                </article>
              );
            })}

            {!isLoadingOrders && orders.length === 0 ? (
              <p className="history-empty">Chưa có đơn hàng nào để vận hành.</p>
            ) : null}
          </div>
        </div>

        {isAdmin ? (
          <div className="card admin-user-card">
            <div className="section-heading">
              <div>
                <h2>Phân quyền người dùng</h2>
                <p className="history-subtle">
                  Admin có thể gán `user`, `staff` hoặc `admin`. Staff sẽ vào được khu quản trị vận hành nhưng không đổi role người khác.
                </p>
              </div>
            </div>

            {isLoadingUsers ? <div className="page-state">Đang tải danh sách người dùng...</div> : null}

            <div className="order-list">
              {users.map((adminUser) => (
                <article className="coupon-admin-card" key={adminUser.id}>
                  <div className="coupon-admin-head">
                    <div>
                      <strong>{adminUser.email}</strong>
                      <p className="history-subtle">
                        {adminUser.first_name} {adminUser.last_name}
                        {adminUser.phone ? ` • ${adminUser.phone}` : ""}
                      </p>
                    </div>
                    <span
                      className={
                        adminUser.email_verified
                          ? "status-pill status-pill-success"
                          : "status-pill status-pill-neutral"
                      }
                    >
                      {adminUser.email_verified ? "Email đã xác minh" : "Email chưa xác minh"}
                    </span>
                  </div>

                  <div className="coupon-admin-grid">
                    <div>
                      <span>Vai trò hiện tại</span>
                      <strong>{adminUser.role}</strong>
                    </div>
                    <div>
                      <span>Cập nhật quyền</span>
                      <select
                        disabled={busyUserId === adminUser.id}
                        value={adminUser.role}
                        onChange={(event) => void handleRoleChange(adminUser.id, event.target.value)}
                      >
                        <option value="user">user</option>
                        <option value="staff">staff</option>
                        <option value="admin">admin</option>
                      </select>
                    </div>
                  </div>
                </article>
              ))}

              {!isLoadingUsers && users.length === 0 ? (
                <p className="history-empty">Chưa có người dùng nào để phân quyền.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="two-column-grid">
          <form className="card" onSubmit={handleCreateCoupon}>
            <h2>Tạo coupon mới</h2>

            <div className="inline-grid">
              <FormField htmlFor="admin-coupon-code" label="Mã coupon" required>
                <input
                  id="admin-coupon-code"
                  placeholder="SAVE10"
                  value={couponForm.code}
                  onChange={(event) =>
                    setCouponForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))
                  }
                />
              </FormField>
              <FormField htmlFor="admin-coupon-type" label="Kiểu giảm giá">
                <select
                  id="admin-coupon-type"
                  value={couponForm.discountType}
                  onChange={(event) =>
                    setCouponForm((current) => ({
                      ...current,
                      discountType: event.target.value as CouponFormState["discountType"]
                    }))
                  }
                >
                  <option value="percentage">Theo phần trăm</option>
                  <option value="fixed">Số tiền cố định</option>
                </select>
              </FormField>
            </div>

            <FormField
              htmlFor="admin-coupon-description"
              hint="Mô tả ngắn sẽ hiển thị trong checkout preview nếu coupon hợp lệ."
              label="Mô tả"
            >
              <input
                id="admin-coupon-description"
                placeholder="Giảm 10% cho đơn từ $50"
                value={couponForm.description}
                onChange={(event) =>
                  setCouponForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </FormField>

            <div className="inline-grid">
              <FormField htmlFor="admin-coupon-discount" label="Giá trị giảm" required>
                <input
                  id="admin-coupon-discount"
                  min="0"
                  step="0.01"
                  type="number"
                  value={couponForm.discountValue}
                  onChange={(event) =>
                    setCouponForm((current) => ({ ...current, discountValue: event.target.value }))
                  }
                />
              </FormField>
              <FormField htmlFor="admin-coupon-min-order" label="Đơn tối thiểu">
                <input
                  id="admin-coupon-min-order"
                  min="0"
                  step="0.01"
                  type="number"
                  value={couponForm.minOrderAmount}
                  onChange={(event) =>
                    setCouponForm((current) => ({ ...current, minOrderAmount: event.target.value }))
                  }
                />
              </FormField>
            </div>

            <div className="inline-grid">
              <FormField htmlFor="admin-coupon-usage-limit" label="Giới hạn sử dụng">
                <input
                  id="admin-coupon-usage-limit"
                  min="0"
                  step="1"
                  type="number"
                  value={couponForm.usageLimit}
                  onChange={(event) =>
                    setCouponForm((current) => ({ ...current, usageLimit: event.target.value }))
                  }
                />
              </FormField>
              <FormField htmlFor="admin-coupon-expiry" label="Hết hạn">
                <input
                  id="admin-coupon-expiry"
                  type="datetime-local"
                  value={couponForm.expiresAt}
                  onChange={(event) =>
                    setCouponForm((current) => ({ ...current, expiresAt: event.target.value }))
                  }
                />
              </FormField>
            </div>

            <label className="checkbox-field" htmlFor="admin-coupon-active">
              <input
                checked={couponForm.active}
                id="admin-coupon-active"
                type="checkbox"
                onChange={(event) =>
                  setCouponForm((current) => ({ ...current, active: event.target.checked }))
                }
              />
              <span>Kích hoạt coupon ngay sau khi tạo</span>
            </label>

            <button className="primary-button" disabled={isCreatingCoupon} type="submit">
              {isCreatingCoupon ? "Đang tạo coupon..." : "Tạo coupon"}
            </button>
          </form>

          <div className="card">
            <div className="section-heading">
              <div>
                <h2>Danh sách coupon</h2>
                <p className="history-subtle">Quản trị nhanh ưu đãi đang hoạt động và mức độ sử dụng.</p>
              </div>
            </div>

            <div className="order-list">
              {coupons.map((coupon) => (
                <article className="coupon-admin-card" key={coupon.id}>
                  <div className="coupon-admin-head">
                    <div>
                      <strong>{coupon.code}</strong>
                      <p className="history-subtle">
                        {coupon.description || "Chưa có mô tả. Coupon vẫn áp dụng theo rule hiện tại."}
                      </p>
                    </div>
                    <span className={coupon.active ? "status-pill status-pill-success" : "status-pill status-pill-neutral"}>
                      {coupon.active ? "Đang bật" : "Tạm tắt"}
                    </span>
                  </div>

                  <div className="coupon-admin-grid">
                    <div>
                      <span>Ưu đãi</span>
                      <strong>
                        {coupon.discount_type === "percentage"
                          ? `${coupon.discount_value}%`
                          : formatCurrency(coupon.discount_value)}
                      </strong>
                    </div>
                    <div>
                      <span>Đơn tối thiểu</span>
                      <strong>{formatCurrency(coupon.min_order_amount)}</strong>
                    </div>
                    <div>
                      <span>Đã dùng</span>
                      <strong>
                        {coupon.used_count}
                        {coupon.usage_limit > 0 ? ` / ${coupon.usage_limit}` : " / không giới hạn"}
                      </strong>
                    </div>
                    <div>
                      <span>Hết hạn</span>
                      <strong>{coupon.expires_at ? formatDateTime(coupon.expires_at) : "Không giới hạn"}</strong>
                    </div>
                  </div>
                </article>
              ))}

              {coupons.length === 0 ? (
                <p className="history-empty">Chưa có coupon nào. Bạn có thể tạo coupon đầu tiên ở khung bên trái.</p>
              ) : null}
            </div>
          </div>
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
              <FormField
                htmlFor="admin-product-image-url"
                hint="Bạn có thể thêm URL thủ công hoặc upload file lên MinIO/S3-compatible storage."
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
                  <button className="ghost-button" type="button" onClick={handleManualImageAdd}>
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
                    Ảnh đầu tiên sẽ được dùng làm thumbnail chính ngoài catalog và checkout.
                  </p>
                </div>
              </div>

              <div className="admin-image-upload-row">
                <input
                  key={uploadInputKey}
                  accept="image/*"
                  multiple
                  type="file"
                  onChange={handleImageSelection}
                />
                <button
                  className="primary-button"
                  disabled={isUploadingImages || selectedImageFiles.length === 0}
                  type="button"
                  onClick={() => void handleUploadImages()}
                >
                  {isUploadingImages ? "Đang upload..." : "Upload lên object storage"}
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
                          onClick={() => handleSetPrimaryImage(imageUrl)}
                        >
                          Đặt làm ảnh chính
                        </button>
                      )}
                      <button
                        className="danger-button"
                        type="button"
                        onClick={() => handleRemoveImage(imageUrl)}
                      >
                        Gỡ ảnh
                      </button>
                    </div>
                  </article>
                ))}

                {form.imageUrls.length === 0 ? (
                  <p className="history-subtle">
                    Chưa có ảnh nào. Hãy thêm URL hoặc upload một hay nhiều ảnh để tạo gallery.
                  </p>
                ) : null}
              </div>
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
                      placeholder="Size"
                      value={variant.size}
                      onChange={(event) => updateVariantRow(variant.id, "size", event.target.value)}
                    />
                    <input
                      placeholder="Màu"
                      value={variant.color}
                      onChange={(event) => updateVariantRow(variant.id, "color", event.target.value)}
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
        size: sanitizeText(row.size),
        color: sanitizeText(row.color),
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
    size: variant.size ?? "",
    color: variant.color ?? "",
    price: String(variant.price),
    stock: String(variant.stock)
  };
}

function toOptionalIsoDateTime(value: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function normalizeProductImageUrls(urls: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  urls.forEach((imageUrl) => {
    const sanitized = sanitizeUrl(imageUrl);
    if (!sanitized || seen.has(sanitized)) {
      return;
    }

    seen.add(sanitized);
    normalized.push(sanitized);
  });

  return normalized;
}

function mergeImageUrls(current: string[], incoming: string[]) {
  return normalizeProductImageUrls([...current, ...incoming]);
}
