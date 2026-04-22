import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import {
  AdminCatalogSection,
  AdminConsoleSidebar,
  AdminCouponsSection,
  AdminOrdersSection,
  AdminOverviewSection,
  AdminPaymentsSection,
  AdminReportSection,
  AdminReturnsSection,
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
import type {
  AdminOrderReport,
  ApiMeta,
  Coupon,
  NotificationDeliveryAuditItem,
  Order,
  Payment,
  Product,
  ProductSearchAnalyticsSummary,
  ReturnRequest,
  ReturnQueueHealth,
  UserProfile,
} from "@/types/api";
import { formatRoleLabel, isDevelopmentAccount } from "@/utils/dev-accounts";
import { formatCurrency } from "@/utils/format";
import { sanitizeMultiline, sanitizeText, sanitizeUrl, toPositiveFloat } from "@/utils/sanitize";
import { validateProduct } from "@/utils/validation";
import "@/styles/pages/admin/admin-page.css";

const adminReturnPageSize = 6;
const adminOrderPageSize = 8;
const returnQueueRefreshIntervalMs = 20_000;

type AdminView =
  | "overview"
  | "revenue"
  | "orders"
  | "payments"
  | "returns"
  | "products"
  | "coupons"
  | "users";

const adminViewByPath: Record<string, AdminView> = {
  "/admin": "overview",
  "/admin/revenue": "revenue",
  "/admin/orders": "orders",
  "/admin/payments": "payments",
  "/admin/returns": "returns",
  "/admin/products": "products",
  "/admin/coupons": "coupons",
  "/admin/users": "users",
};

function normalizeAdminPathname(pathname: string) {
  const normalizedPathname = pathname.replace(/\/+$/, "");
  return normalizedPathname || pathname;
}

export function AdminPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, isAdmin, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [returnQueueHealth, setReturnQueueHealth] = useState<ReturnQueueHealth | null>(null);
  const [returnQueueLastUpdatedAt, setReturnQueueLastUpdatedAt] = useState("");
  const [paymentsByOrder, setPaymentsByOrder] = useState<Record<string, Payment[]>>({});
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [report, setReport] = useState<AdminOrderReport | null>(null);
  const [searchAnalytics, setSearchAnalytics] = useState<ProductSearchAnalyticsSummary | null>(null);
  const [notificationAudit, setNotificationAudit] = useState<NotificationDeliveryAuditItem[]>([]);
  const [feedback, setFeedback] = useState("");
  const [busyProductId, setBusyProductId] = useState("");
  const [busyOrderId, setBusyOrderId] = useState("");
  const [busyRefundId, setBusyRefundId] = useState("");
  const [busyReturnId, setBusyReturnId] = useState("");
  const [busyReturnAction, setBusyReturnAction] = useState<"" | "refund" | "status">("");
  const [busyUserId, setBusyUserId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isCreatingCoupon, setIsCreatingCoupon] = useState(false);
  const [isSyncingWorkbook, setIsSyncingWorkbook] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isLoadingReturns, setIsLoadingReturns] = useState(false);
  const [isLoadingReturnQueueHealth, setIsLoadingReturnQueueHealth] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [editingProductId, setEditingProductId] = useState("");
  const [syncingWorkbookProductId, setSyncingWorkbookProductId] = useState("");
  const [reportDays, setReportDays] = useState(30);
  const [adminReturnPage, setAdminReturnPage] = useState(1);
  const [adminReturnStatusFilter, setAdminReturnStatusFilter] = useState("all");
  const [adminReturnQuery, setAdminReturnQuery] = useState("");
  const [adminReturnQueryDraft, setAdminReturnQueryDraft] = useState("");
  const [adminReturnMeta, setAdminReturnMeta] = useState<ApiMeta>({
    page: 1,
    limit: adminReturnPageSize,
    total: 0,
  });
  const [adminOrderMeta, setAdminOrderMeta] = useState<ApiMeta>({
    limit: adminOrderPageSize,
    next_cursor: "",
    has_next: false,
  });
  const [isLoadingMoreOrders, setIsLoadingMoreOrders] = useState(false);
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
        const [reportResult, analyticsResult, auditResult] = await Promise.allSettled([
          api.getAdminOrderReport(token, days),
          api.getSearchAnalytics(token, { days, limit: 8 }),
          api.listNotificationAudit(token, { limit: 8 }),
        ]);

        if (reportResult.status === "fulfilled") {
          setReport(reportResult.value.data);
        }
        if (analyticsResult.status === "fulfilled") {
          setSearchAnalytics(analyticsResult.value.data);
        }
        if (auditResult.status === "fulfilled") {
          setNotificationAudit(auditResult.value.data);
        }
        if (
          reportResult.status === "rejected" &&
          analyticsResult.status === "rejected" &&
          auditResult.status === "rejected"
        ) {
          setFeedback(getErrorMessage(reportResult.reason));
        }
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

  const loadAdminOrders = useCallback(async (options: { append?: boolean; cursor?: string } = {}) => {
    if (!token) {
      return;
    }

    try {
      if (options.append) {
        setIsLoadingMoreOrders(true);
      } else {
        setIsLoadingOrders(true);
      }
      const response = await api.listAdminOrders(token, {
        limit: adminOrderPageSize,
        cursor: options.cursor,
      });
      setOrders((current) => (options.append ? [...current, ...response.data] : response.data));
      setAdminOrderMeta({
        limit: response.meta?.limit ?? adminOrderPageSize,
        next_cursor: response.meta?.next_cursor ?? "",
        has_next: response.meta?.has_next ?? false,
      });
      const requestedOrderIds = response.data.map((order) => order.id);
      const emptyPaymentMap = Object.fromEntries(
        requestedOrderIds.map((orderId) => [orderId, [] as Payment[]])
      );

      let nextPaymentsByOrder = emptyPaymentMap;
      try {
        const paymentResponse = await api.listAdminPaymentsByOrders(token, requestedOrderIds);
        nextPaymentsByOrder = {
          ...emptyPaymentMap,
          ...paymentResponse.data,
        };
      } catch {
        setFeedback("Đơn hàng đã được tải nhưng payment history batch hiện chưa phản hồi.");
      }

      setPaymentsByOrder((current) =>
        options.append
          ? {
              ...current,
              ...nextPaymentsByOrder,
            }
          : nextPaymentsByOrder
      );
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      if (options.append) {
        setIsLoadingMoreOrders(false);
      } else {
        setIsLoadingOrders(false);
      }
    }
  }, [token]);

  const loadAdminReturns = useCallback(
    async (
      nextPage = adminReturnPage,
      nextQuery = adminReturnQuery,
      nextStatus = adminReturnStatusFilter
    ) => {
      if (!token) {
        return;
      }

      try {
        setIsLoadingReturns(true);
        const response = await api.listAdminReturns(token, {
          page: nextPage,
          limit: adminReturnPageSize,
          query: nextQuery || undefined,
          status: nextStatus === "all" ? undefined : nextStatus,
        });

        const total = response.meta?.total ?? 0;
        if (nextPage > 1 && response.data.length === 0 && total > 0) {
          setAdminReturnPage(nextPage - 1);
          return;
        }

        setReturns(response.data);
        setAdminReturnMeta({
          page: response.meta?.page ?? nextPage,
          limit: response.meta?.limit ?? adminReturnPageSize,
          total,
        });
      } catch (reason) {
        setFeedback(getErrorMessage(reason));
      } finally {
        setIsLoadingReturns(false);
      }
    },
    [adminReturnPage, adminReturnQuery, adminReturnStatusFilter, token]
  );

  const loadReturnQueueHealth = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!token) {
        return;
      }

      try {
        if (!options.silent) {
          setIsLoadingReturnQueueHealth(true);
        }
        const response = await api.getAdminReturnQueueHealth(token);
        setReturnQueueHealth(response.data);
        setReturnQueueLastUpdatedAt(new Date().toISOString());
      } catch (reason) {
        setFeedback(getErrorMessage(reason));
      } finally {
        if (!options.silent) {
          setIsLoadingReturnQueueHealth(false);
        }
      }
    },
    [token]
  );

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

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadAdminReturns();
    void loadReturnQueueHealth();
  }, [loadAdminReturns, loadReturnQueueHealth, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadReturnQueueHealth({ silent: true });
    }, returnQueueRefreshIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadReturnQueueHealth, token]);

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

  async function handleReturnStatusUpdate(
    returnRequest: ReturnRequest,
    status: "approved" | "rejected" | "received" | "cancelled"
  ) {
    if (!token) {
      setFeedback("Bạn cần tài khoản staff/admin để cập nhật yêu cầu trả hàng.");
      return;
    }

    const statusMessages: Record<"approved" | "rejected" | "received" | "cancelled", string> = {
      approved: "Return approved from admin dashboard.",
      rejected: "Return rejected from admin dashboard.",
      received: "Returned items received by operations team.",
      cancelled: "Return request cancelled from admin dashboard.",
    };

    try {
      setBusyReturnId(returnRequest.id);
      setBusyReturnAction("status");
      await api.updateAdminReturnStatus(token, returnRequest.id, {
        status,
        message: statusMessages[status],
      });
      await loadAdminReturns();
      await loadReturnQueueHealth();
      setFeedback(`Đã cập nhật yêu cầu ${returnRequest.id} sang ${status}.`);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusyReturnId("");
      setBusyReturnAction("");
    }
  }

  async function handleQueueReturnRefund(returnRequest: ReturnRequest) {
    if (!token) {
      setFeedback("Bạn cần tài khoản staff/admin để xếp hàng hoàn tiền.");
      return;
    }

    try {
      setBusyReturnId(returnRequest.id);
      setBusyReturnAction("refund");
      await api.requestAdminReturnRefund(token, returnRequest.id, {
        message:
          returnRequest.status === "refund_pending"
            ? "Manual refund retry requested from admin dashboard."
            : "Refund queued from admin dashboard.",
      });
      await loadAdminReturns();
      await loadReturnQueueHealth();
      setFeedback(
        returnRequest.status === "refund_pending"
          ? `Đã yêu cầu thử lại hoàn tiền cho ${returnRequest.id}.`
          : `Đã xếp hàng hoàn tiền cho ${returnRequest.id}.`
      );
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusyReturnId("");
      setBusyReturnAction("");
    }
  }

  function handleAdminReturnFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextQuery = adminReturnQueryDraft.trim();
    if (nextQuery === adminReturnQuery && adminReturnPage === 1) {
      void loadAdminReturns(1, nextQuery, adminReturnStatusFilter);
      return;
    }

    setAdminReturnPage(1);
    setAdminReturnQuery(nextQuery);
  }

  function handleResetAdminReturnFilters() {
    const hasChanges =
      adminReturnQueryDraft || adminReturnQuery || adminReturnStatusFilter !== "all";
    setAdminReturnQueryDraft("");
    setAdminReturnQuery("");
    setAdminReturnStatusFilter("all");
    if (adminReturnPage !== 1) {
      setAdminReturnPage(1);
      return;
    }
    if (hasChanges) {
      void loadAdminReturns(1, "", "all");
    }
  }

  function handleAdminReturnStatusFilterChange(nextStatus: string) {
    setAdminReturnStatusFilter(nextStatus);
    if (adminReturnPage !== 1) {
      setAdminReturnPage(1);
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

  function refreshDashboardData() {
    void loadReport(reportDays);
    void loadAdminOrders();
    void loadAdminReturns();
    void loadReturnQueueHealth();
    if (isAdmin) {
      void loadUsers();
    }
    void loadCoupons();
    void loadProducts();
  }

  function startNewProductEntry() {
    resetForm();
    navigate("/admin/products");
  }

  const operationalOrderCount = orders.filter(
    (order) => order.status === "pending" || order.status === "paid"
  ).length;
  const paidOrderCount = orders.filter((order) => order.status === "paid").length;
  const completedChargeCount = Object.values(paymentsByOrder)
    .flat()
    .filter(
      (payment) => payment.transaction_type === "charge" && payment.status === "completed"
    ).length;
  const activeReturnCount = returns.filter((item) =>
    ["requested", "approved", "received", "refund_pending"].includes(item.status)
  ).length;
  const managedCustomerCount = isAdmin
    ? users.length
    : new Set(orders.map((order) => order.user_id)).size;
  const overviewCapabilities = [
    "Thêm sản phẩm và biến thể",
    "Theo dõi đơn đã thanh toán",
    "Xem doanh thu và AOV",
    "Kiểm tra search analytics",
  ];
  const overviewCards = [
    {
      label: "Doanh thu",
      value: report ? formatCurrency(report.total_revenue) : "--",
      caption: report
        ? `${report.order_count} đơn trong ${report.window_days} ngày gần nhất`
        : "Đang tải doanh thu tổng quan",
    },
    {
      label: "Đơn đã thanh toán",
      value: String(paidOrderCount),
      caption:
        completedChargeCount > 0
          ? `${completedChargeCount} giao dịch charge completed đã được ghi nhận`
          : "Chưa có giao dịch completed trong batch hiện tại",
    },
    {
      label: "Catalog sản phẩm",
      value: String(products.length),
      caption: editingProductId
        ? "Biểu mẫu đang ở chế độ chỉnh sửa"
        : "Sẵn sàng thêm SKU, ảnh và biến thể mới",
    },
    {
      label:
        operationalOrderCount > 0 || activeReturnCount > 0 ? "Vận hành cần theo dõi" : "Khách hàng",
      value:
        operationalOrderCount > 0 || activeReturnCount > 0
          ? String(operationalOrderCount + activeReturnCount)
          : String(managedCustomerCount),
      caption:
        operationalOrderCount > 0 || activeReturnCount > 0
          ? `${operationalOrderCount} đơn và ${activeReturnCount} yêu cầu return đang mở`
          : isAdmin
            ? "Sẵn sàng cập nhật quyền truy cập"
            : "Tổng hợp từ đơn hàng hiện có",
    },
  ];
  const adminPathname = normalizeAdminPathname(location.pathname);
  const activeAdminView = adminViewByPath[adminPathname];
  const adminNavItems = [
    {
      id: "overview",
      href: "/admin",
      group: "Điều hành",
      label: "Tổng quan",
      helper: "Snapshot điều hành, KPI tổng quan và lối tắt sang từng bàn vận hành",
    },
    {
      id: "revenue",
      href: "/admin/revenue",
      group: "Điều hành",
      label: "Doanh thu",
      helper: "Báo cáo kinh doanh, top sản phẩm, search analytics và delivery audit",
    },
    {
      id: "orders",
      href: "/admin/orders",
      group: "Điều hành",
      label: "Đơn hàng",
      helper: "Theo dõi vòng đời đơn hàng, thao tác hủy và xem payment theo từng order",
    },
    {
      id: "payments",
      href: "/admin/payments",
      group: "Điều hành",
      label: "Payments",
      helper: "Charge completed, refund, lỗi gateway và ledger giao dịch riêng",
    },
    {
      id: "returns",
      href: "/admin/returns",
      group: "Điều hành",
      label: "Trả hàng",
      helper: "Trả hàng, refund queue, và lịch sử xử lý",
    },
    {
      id: "users",
      href: "/admin/users",
      group: "Quản trị",
      label: "Người dùng",
      helper: "Phân quyền và xác minh tài khoản",
    },
    {
      id: "coupons",
      href: "/admin/coupons",
      group: "Quản trị",
      label: "Coupon",
      helper: "Ưu đãi, điều kiện áp dụng, và thời hạn",
    },
    {
      id: "products",
      href: "/admin/products",
      group: "Quản trị",
      label: "Sản phẩm",
      helper: "Sản phẩm, hình ảnh, và biến thể",
    },
  ].filter((item) => item.id !== "users" || isAdmin);
  const adminQuickLinks = adminNavItems.filter((item) => item.id !== "overview");
  const snapshotLabel = report ? `ND Admin • ${report.window_days} ngày` : "Đang tải snapshot";

  if (!activeAdminView || (activeAdminView === "users" && !isAdmin)) {
    return <Navigate replace to="/admin" />;
  }

  function renderActiveAdminView() {
    switch (activeAdminView) {
      case "overview":
        return (
          <>
            <AdminOverviewSection
              capabilities={overviewCapabilities}
              isDevelopmentOperator={isDevelopmentOperator}
              isSyncingWorkbook={isSyncingWorkbook}
              overviewCards={overviewCards}
              onRefreshDashboardData={refreshDashboardData}
              onStartNewProductEntry={startNewProductEntry}
              onSyncCollections={() => void handleSyncAllProductsToWorkbook()}
            />

            <section className="admin-console-panel">
              <div className="section-heading">
                <div>
                  <h2>Đi thẳng tới khu vực nghiệp vụ</h2>
                  <p className="history-subtle">
                    Chọn đúng màn hình theo công việc: quản lý sản phẩm, doanh thu, payments, đơn
                    hàng hoặc returns.
                  </p>
                </div>
              </div>

              <div className="admin-console-route-grid">
                {adminQuickLinks.map((item) => (
                  <Link className="admin-console-route-card" key={item.id} to={item.href}>
                    <span className="admin-console-route-eyebrow">{item.group}</span>
                    <strong>{item.label}</strong>
                    <p>{item.helper}</p>
                  </Link>
                ))}
              </div>
            </section>
          </>
        );
      case "revenue":
        return (
          <AdminReportSection
            isLoadingReport={isLoadingReport}
            report={report}
            searchAnalytics={searchAnalytics}
            notificationAudit={notificationAudit}
            reportDays={reportDays}
            reportWindowOptions={reportWindowOptions}
            onSelectWindow={setReportDays}
          />
        );
      case "orders":
        return (
          <AdminOrdersSection
            busyOrderId={busyOrderId}
            busyRefundId={busyRefundId}
            hasMoreOrders={Boolean(adminOrderMeta.has_next)}
            isLoadingOrders={isLoadingOrders}
            isLoadingMoreOrders={isLoadingMoreOrders}
            orders={orders}
            onLoadMoreOrders={() =>
              void loadAdminOrders({
                append: true,
                cursor: adminOrderMeta.next_cursor,
              })
            }
            paymentsByOrder={paymentsByOrder}
            onCancelOrder={(order) => void handleManualCancel(order)}
            onRefund={(payment) => void handleRefund(payment)}
          />
        );
      case "payments":
        return (
          <AdminPaymentsSection
            busyRefundId={busyRefundId}
            hasMoreOrders={Boolean(adminOrderMeta.has_next)}
            isLoadingOrders={isLoadingOrders}
            isLoadingMoreOrders={isLoadingMoreOrders}
            orders={orders}
            paymentsByOrder={paymentsByOrder}
            onLoadMoreOrders={() =>
              void loadAdminOrders({
                append: true,
                cursor: adminOrderMeta.next_cursor,
              })
            }
            onRefund={(payment) => void handleRefund(payment)}
          />
        );
      case "returns":
        return (
          <AdminReturnsSection
            busyReturnAction={busyReturnAction}
            busyReturnId={busyReturnId}
            isLoadingQueueHealth={isLoadingReturnQueueHealth}
            isLoadingReturns={isLoadingReturns}
            limit={adminReturnMeta.limit ?? adminReturnPageSize}
            page={adminReturnMeta.page ?? adminReturnPage}
            queryDraft={adminReturnQueryDraft}
            queueHealth={returnQueueHealth}
            queueLastUpdatedAt={returnQueueLastUpdatedAt}
            returns={returns}
            selectedStatus={adminReturnStatusFilter}
            total={adminReturnMeta.total ?? 0}
            onPageChange={setAdminReturnPage}
            onQueryDraftChange={setAdminReturnQueryDraft}
            onQueueRefund={(returnRequest) => void handleQueueReturnRefund(returnRequest)}
            onResetFilters={handleResetAdminReturnFilters}
            onSelectStatus={handleAdminReturnStatusFilterChange}
            onSubmitFilters={handleAdminReturnFilterSubmit}
            onUpdateStatus={(returnRequest, status) =>
              void handleReturnStatusUpdate(returnRequest, status)
            }
          />
        );
      case "products":
        return (
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
        );
      case "coupons":
        return (
          <AdminCouponsSection
            couponForm={couponForm}
            coupons={coupons}
            isCreatingCoupon={isCreatingCoupon}
            setCouponForm={setCouponForm}
            onSubmit={handleCreateCoupon}
          />
        );
      case "users":
        return isAdmin ? (
          <AdminUsersSection
            busyUserId={busyUserId}
            isLoadingUsers={isLoadingUsers}
            users={users}
            onRoleChange={(userId, role) => void handleRoleChange(userId, role)}
          />
        ) : null;
    }
  }

  return (
    <div className="admin-console-page">
      <div className="admin-console-shell">
        <AdminConsoleSidebar
          adminNavItems={adminNavItems}
          currentRoleLabel={currentRoleLabel}
          isDevelopmentOperator={isDevelopmentOperator}
          snapshotLabel={snapshotLabel}
        />

        <div className="admin-console-main">
          {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}
          {renderActiveAdminView()}
        </div>
      </div>
    </div>
  );
}
