import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";

import {
  AdminCatalogSection,
  AdminConsoleSidebar,
  AdminCouponsSection,
  AdminOrdersSection,
  AdminOverviewSection,
  AdminReportSection,
  AdminUsersSection,
} from "@/features/admin/components";
import {
  createEmptyVariant,
  createDefaultCouponForm,
  createDefaultProductForm,
  mergeImageUrls,
  normalizeProductImageUrls,
  parseTags,
  parseVariantRows,
  productStatusOptions,
  reportWindowOptions,
  toOptionalIsoDateTime,
  toVariantFormRow,
  type CouponFormState,
  type ProductFormState,
  type VariantFormRow,
  validateSelectedImageFiles,
} from "@/features/admin/utils/product-form";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { canSyncProductToWorkbook } from "@/features/home/workbook-sync-catalog";
import {
  syncWorkbookProductMutation,
  syncWorkbookProductMutations,
} from "@/features/home/workbook-sync-client";
import { api, getErrorMessage } from "@/services/api";
import type { AdminOrderReport, Coupon, Order, Payment, Product, UserProfile } from "@/types/api";
import { formatRoleLabel, isDevelopmentAccount } from "@/utils/dev-accounts";
import { formatCurrency } from "@/utils/format";
import { sanitizeMultiline, sanitizeText, sanitizeUrl, toPositiveFloat } from "@/utils/sanitize";
import { validateProduct } from "@/utils/validation";
import "@/styles/pages/admin/admin-page.css";

export function AdminPage() {
  const { token, isAdmin, user } = useAuth();
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
  const [isSyncingWorkbook, setIsSyncingWorkbook] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [editingProductId, setEditingProductId] = useState("");
  const [syncingWorkbookProductId, setSyncingWorkbookProductId] = useState("");
  const [reportDays, setReportDays] = useState(30);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);
  const [form, setForm] = useState<ProductFormState>(createDefaultProductForm);
  const [couponForm, setCouponForm] = useState<CouponFormState>(createDefaultCouponForm);
  const isDevelopmentOperator = isDevelopmentAccount(user);
  const currentRoleLabel = formatRoleLabel(user?.role);

  async function syncWorkbookFeedback(
    operation: "upsert" | "delete",
    product: Product,
    baseMessage: string
  ) {
    try {
      const result = await syncWorkbookProductMutation(operation, product);
      setFeedback(`${baseMessage} ${result.message}`);
    } catch (reason) {
      setFeedback(
        `${baseMessage} Tuy nhien bo suu tap noi bat chua cap nhat duoc: ${getErrorMessage(reason)}`
      );
    }
  }

  async function syncProductsToWorkbook(
    nextProducts: Product[],
    baseMessage: string,
    emptyMessage: string
  ) {
    const syncableProducts = nextProducts.filter(canSyncProductToWorkbook);
    if (syncableProducts.length === 0) {
      setFeedback(emptyMessage);
      return;
    }

    const skippedCount = nextProducts.length - syncableProducts.length;

    try {
      setIsSyncingWorkbook(true);
      const result = await syncWorkbookProductMutations(
        syncableProducts.map((product) => ({
          operation: "upsert",
          product,
        }))
      );
      setFeedback(
        skippedCount > 0
          ? `${baseMessage} ${result.message} Bo qua ${skippedCount} san pham chua nam trong 4 bo suu tap chinh.`
          : `${baseMessage} ${result.message}`
      );
    } catch (reason) {
      setFeedback(
        `${baseMessage} Tuy nhien bo suu tap noi bat chua cap nhat duoc: ${getErrorMessage(reason)}`
      );
    } finally {
      setIsSyncingWorkbook(false);
    }
  }

  const loadProducts = useCallback(async () => {
    try {
      const response = await api.listProducts({ limit: 100 });
      setProducts(response.data);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    }
  }, []);

  const loadReport = useCallback(
    async (days: number) => {
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
    },
    [token]
  );

  const loadCoupons = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const response = await api.listCoupons(token);
      setCoupons(response.data);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    }
  }, [token]);

  const loadUsers = useCallback(async () => {
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
  }, [isAdmin, token]);

  const loadAdminOrders = useCallback(async () => {
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
  }, [token]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

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
  }, [isAdmin, loadAdminOrders, loadCoupons, loadReport, loadUsers, reportDays, token]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setFeedback("Bạn cần tài khoản staff/admin để thao tác catalog.");
      return;
    }

    const parsedVariants = parseVariantRows(form.variants);
    const tags = parseTags(form.tags);
    const imageUrls = normalizeProductImageUrls(form.imageUrls);
    const primaryImageUrl = imageUrls[0] ?? "";
    const stockValue =
      parsedVariants.variants.length > 0
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
      image_urls: imageUrls,
    };

    const errors = validateProduct({
      name: payload.name,
      description: payload.description,
      price: form.price,
      stock: parsedVariants.variants.length > 0 ? String(stockValue) : form.stock,
      imageUrl: primaryImageUrl,
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
        await syncWorkbookFeedback(
          "upsert",
          response.data,
          `Đã cập nhật sản phẩm ${response.data.name}.`
        );
      } else {
        const response = await api.createProduct(token, payload);
        setProducts((current) => [response.data, ...current]);
        await syncWorkbookFeedback(
          "upsert",
          response.data,
          `Đã tạo sản phẩm ${response.data.name}.`
        );
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
      setFeedback("Bạn cần tài khoản staff/admin để quản trị coupon.");
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
        active: couponForm.active,
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
      setFeedback("Bạn cần tài khoản admin để đổi vai trò.");
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
    const imageUrls =
      product.image_urls.length > 0
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
      variants: product.variants.map((variant) => toVariantFormRow(variant)),
    });
    setSelectedImageFiles([]);
    setUploadInputKey((current) => current + 1);
    setFeedback(`Đang sửa sản phẩm ${product.name}.`);
  }

  async function handleDelete(product: Product) {
    if (!token) {
      setFeedback("Bạn cần tài khoản staff/admin để xóa sản phẩm.");
      return;
    }

    try {
      setBusyProductId(product.id);
      await api.deleteProduct(token, product.id);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      await syncWorkbookFeedback("delete", product, `Đã xóa sản phẩm ${product.name}.`);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusyProductId("");
    }
  }

  async function handleSyncProduct(product: Product) {
    if (!canSyncProductToWorkbook(product)) {
      setFeedback(
        `San pham ${product.name} hien chua nam trong 4 bo suu tap chinh. Hay chuyen ve Men, Women, Footwear hoac Accessories truoc khi cap nhat.`
      );
      return;
    }

    try {
      setSyncingWorkbookProductId(product.id);
      await syncWorkbookFeedback(
        "upsert",
        product,
        `Da cap nhat ${product.name} len bo suu tap noi bat.`
      );
    } finally {
      setSyncingWorkbookProductId("");
    }
  }

  async function handleSyncAllProductsToWorkbook() {
    await syncProductsToWorkbook(
      products,
      "Da cap nhat bo suu tap tu catalog hien tai.",
      "Chua co san pham nao nam trong 4 bo suu tap chinh."
    );
  }

  async function handleManualCancel(order: Order) {
    if (!token) {
      setFeedback("Bạn cần tài khoản staff/admin để hủy đơn.");
      return;
    }

    try {
      setBusyOrderId(order.id);
      const response = await api.cancelAdminOrder(token, order.id, {
        message: "Order cancelled manually from admin dashboard.",
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
      setFeedback("Bạn cần tài khoản staff/admin để hoàn tiền.");
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
    setForm(createDefaultProductForm());
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
      manualImageUrl: "",
    }));
  }

  function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []);
    const result = validateSelectedImageFiles(nextFiles);

    setSelectedImageFiles(result.files);
    if (result.errors.length > 0) {
      setFeedback(result.errors.join(" "));
    }
  }

  async function handleUploadImages() {
    if (!token) {
      setFeedback("Bạn cần tài khoản staff/admin để tải ảnh lên.");
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
        imageUrls: mergeImageUrls(current.imageUrls, response.data.urls),
      }));
      setSelectedImageFiles([]);
      setUploadInputKey((current) => current + 1);
      setFeedback(`Da tai len ${response.data.urls.length} anh moi cho gallery san pham.`);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsUploadingImages(false);
    }
  }

  function handleRemoveImage(imageUrl: string) {
    setForm((current) => ({
      ...current,
      imageUrls: current.imageUrls.filter((item) => item !== imageUrl),
    }));
  }

  function handleSetPrimaryImage(imageUrl: string) {
    setForm((current) => ({
      ...current,
      imageUrls: [imageUrl, ...current.imageUrls.filter((item) => item !== imageUrl)],
    }));
  }

  function updateVariantRow(id: string, field: keyof Omit<VariantFormRow, "id">, value: string) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant) =>
        variant.id === id ? { ...variant, [field]: value } : variant
      ),
    }));
  }

  function addVariantRow() {
    setForm((current) => ({
      ...current,
      variants: [...current.variants, createEmptyVariant()],
    }));
  }

  function removeVariantRow(id: string) {
    setForm((current) => ({
      ...current,
      variants: current.variants.filter((variant) => variant.id !== id),
    }));
  }

  function scrollToAdminSection(sectionId: string) {
    if (typeof document === "undefined") {
      return;
    }

    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function refreshDashboardData() {
    void loadReport(reportDays);
    void loadAdminOrders();
    if (isAdmin) {
      void loadUsers();
    }
    void loadCoupons();
    void loadProducts();
  }

  function startNewProductEntry() {
    resetForm();
    scrollToAdminSection("admin-product-workbench");
  }

  const operationalOrderCount = orders.filter(
    (order) => order.status === "pending" || order.status === "paid"
  ).length;
  const managedCustomerCount = isAdmin
    ? users.length
    : new Set(orders.map((order) => order.user_id)).size;
  const overviewCards = [
    {
      label: "Total Sales",
      value: report ? formatCurrency(report.total_revenue) : "--",
      caption: report
        ? `${report.order_count} đơn trong ${report.window_days} ngày gần nhất`
        : "Dang tai tong quan doanh thu",
    },
    {
      label: "Active Orders",
      value: String(operationalOrderCount),
      caption:
        operationalOrderCount > 0
          ? "Đơn cần staff/admin theo dõi ngay"
          : "Không có đơn cần can thiệp thủ công",
    },
    {
      label: "Catalog Items",
      value: String(products.length),
      caption: editingProductId
        ? "Biểu mẫu đang ở chế độ chỉnh sửa"
        : "Catalog sẵn sàng nhận sản phẩm mới",
    },
    {
      label: isAdmin ? "Managed Users" : "Visible Customers",
      value: String(managedCustomerCount),
      caption: isAdmin ? "San sang cap nhat quyen truy cap" : "Tong hop tu don hang hien co",
    },
  ];
  const adminNavItems = [
    {
      id: "admin-overview",
      group: "Core Analytics",
      label: "Overview",
      helper: "Doanh thu, nhịp vận hành, và trạng thái tổng thể",
    },
    {
      id: "admin-order-ledger",
      group: "Core Analytics",
      label: "Orders",
      helper: "Theo dõi đơn hàng và giao dịch gần đây",
    },
    {
      id: "admin-user-governance",
      group: "Management",
      label: "Users",
      helper: "Phân quyền và xác minh tài khoản",
    },
    {
      id: "admin-coupon-workbench",
      group: "Management",
      label: "Coupons",
      helper: "Ưu đãi, điều kiện áp dụng, và thời hạn",
    },
    {
      id: "admin-product-workbench",
      group: "Management",
      label: "Catalog",
      helper: "Sản phẩm, hình ảnh, và biến thể",
    },
  ].filter((item) => item.id !== "admin-user-governance" || isAdmin);
  const snapshotLabel = report ? `Snapshot ${report.window_days}d` : "Loading snapshot";

  return (
    <div className="admin-console-page">
      <div className="admin-console-shell">
        <AdminConsoleSidebar
          adminNavItems={adminNavItems}
          currentRoleLabel={currentRoleLabel}
          isDevelopmentOperator={isDevelopmentOperator}
          snapshotLabel={snapshotLabel}
          onNavigate={scrollToAdminSection}
        />

        <div className="admin-console-main">
          <AdminOverviewSection
            feedback={feedback}
            isDevelopmentOperator={isDevelopmentOperator}
            isSyncingWorkbook={isSyncingWorkbook}
            overviewCards={overviewCards}
            onRefreshDashboardData={refreshDashboardData}
            onStartNewProductEntry={startNewProductEntry}
            onSyncCollections={() => void handleSyncAllProductsToWorkbook()}
          />

          <AdminReportSection
            isLoadingReport={isLoadingReport}
            report={report}
            reportDays={reportDays}
            reportWindowOptions={reportWindowOptions}
            onSelectWindow={setReportDays}
          />

          <AdminOrdersSection
            busyOrderId={busyOrderId}
            busyRefundId={busyRefundId}
            isLoadingOrders={isLoadingOrders}
            orders={orders}
            paymentsByOrder={paymentsByOrder}
            onCancelOrder={(order) => void handleManualCancel(order)}
            onRefund={(payment) => void handleRefund(payment)}
          />

          {isAdmin ? (
            <AdminUsersSection
              busyUserId={busyUserId}
              isLoadingUsers={isLoadingUsers}
              users={users}
              onRoleChange={(userId, role) => void handleRoleChange(userId, role)}
            />
          ) : null}

          <AdminCouponsSection
            couponForm={couponForm}
            coupons={coupons}
            isCreatingCoupon={isCreatingCoupon}
            setCouponForm={setCouponForm}
            onSubmit={handleCreateCoupon}
          />

          <AdminCatalogSection
            busyProductId={busyProductId}
            editingProductId={editingProductId}
            form={form}
            isCreating={isCreating}
            isSyncingWorkbook={isSyncingWorkbook}
            isUploadingImages={isUploadingImages}
            products={products}
            selectedImageFiles={selectedImageFiles}
            setForm={setForm}
            syncingWorkbookProductId={syncingWorkbookProductId}
            uploadInputKey={uploadInputKey}
            onAddVariantRow={addVariantRow}
            onDeleteProduct={(product) => void handleDelete(product)}
            onEditProduct={handleEdit}
            onHandleImageSelection={handleImageSelection}
            onHandleManualImageAdd={handleManualImageAdd}
            onRemoveImage={handleRemoveImage}
            onRemoveVariantRow={removeVariantRow}
            onResetForm={resetForm}
            onSetPrimaryImage={handleSetPrimaryImage}
            onSubmit={handleCreate}
            onSyncAllProducts={() => void handleSyncAllProductsToWorkbook()}
            onSyncProduct={(product) => void handleSyncProduct(product)}
            onUpdateVariantRow={updateVariantRow}
            onUploadImages={() => void handleUploadImages()}
          />
        </div>
      </div>
    </div>
  );
}
