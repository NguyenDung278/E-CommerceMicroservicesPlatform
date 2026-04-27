"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import { useAuthState } from "@/hooks/useAuth";
import { adminApi } from "@/lib/api/admin";
import { productApi, type CreateProductData } from "@/lib/api/product";
import { getErrorMessage } from "@/lib/errors/handler";
import type { AdminOrderReport, Order, Product, UserProfile } from "@/types/api";
import {
  buildProductPayload,
  canCancelOrder,
  dedupeProducts,
  emptyProductForm,
  productStatuses,
  productToForm,
  reportWindows,
  type ProductFormState,
} from "@/components/admin/admin-shared";
import { formatShortOrderId } from "@/utils/format";

const syncIntervalMs = 8_000;

type AdminConsoleMetrics = {
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: number;
  openOrders: number;
  revenue: number;
};

type AdminConsoleContextValue = {
  canAccessAdmin: boolean;
  isBootstrapping: boolean;
  user: UserProfile | null;
  products: Product[];
  orders: Order[];
  report: AdminOrderReport | null;
  reportDays: (typeof reportWindows)[number];
  setReportDays: Dispatch<SetStateAction<(typeof reportWindows)[number]>>;
  orderStatusFilter: string;
  setOrderStatusFilter: Dispatch<SetStateAction<string>>;
  form: ProductFormState;
  setForm: Dispatch<SetStateAction<ProductFormState>>;
  editingProductId: string;
  inventoryDrafts: Record<string, string>;
  feedback: string;
  setFeedback: Dispatch<SetStateAction<string>>;
  isLoading: boolean;
  isRefreshing: boolean;
  isSaving: boolean;
  busyProductId: string;
  busyOrderId: string;
  lastSyncedAt: Date | null;
  metrics: AdminConsoleMetrics;
  inventoryProducts: Product[];
  refreshAdminData: (showLoader?: boolean) => Promise<void>;
  resetProductForm: () => void;
  startEditingProduct: (product: Product) => void;
  saveProductForm: () => Promise<void>;
  deleteProduct: (product: Product) => Promise<void>;
  patchProduct: (product: Product, patch: Partial<CreateProductData>) => Promise<void>;
  setInventoryDraftValue: (productId: string, value: string) => void;
  saveInventory: (product: Product) => Promise<void>;
  cancelOrder: (order: Order) => Promise<void>;
};

const AdminConsoleContext = createContext<AdminConsoleContextValue | null>(null);

export function AdminConsoleProvider({ children }: { children: ReactNode }) {
  const { canAccessAdmin, isBootstrapping, token, user } = useAuthState();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [report, setReport] = useState<AdminOrderReport | null>(null);
  const [reportDays, setReportDays] = useState<(typeof reportWindows)[number]>(30);
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [form, setForm] = useState<ProductFormState>(emptyProductForm);
  const [editingProductId, setEditingProductId] = useState("");
  const [inventoryDrafts, setInventoryDrafts] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [busyProductId, setBusyProductId] = useState("");
  const [busyOrderId, setBusyOrderId] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const hasInitializedRef = useRef(false);

  const refreshAdminData = useCallback(
    async (showLoader = false) => {
      if (!token || !canAccessAdmin) {
        setIsLoading(false);
        return;
      }

      if (showLoader) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const [productResponses, orderResponse, reportResponse] = await Promise.all([
          Promise.all(productStatuses.map((status) => productApi.listProducts({ status, limit: 100 }))),
          adminApi.listOrders(token, {
            limit: 20,
            status: orderStatusFilter !== "all" ? orderStatusFilter : undefined,
          }),
          adminApi.getOrderReport(token, reportDays),
        ]);

        setProducts(dedupeProducts(productResponses.flatMap((response) => response.data)));
        setOrders(orderResponse.data);
        setReport(reportResponse.data);
        setLastSyncedAt(new Date());
        setFeedback("");
      } catch (reason) {
        setFeedback(getErrorMessage(reason));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [canAccessAdmin, orderStatusFilter, reportDays, token],
  );

  useEffect(() => {
    void refreshAdminData(!hasInitializedRef.current);
    hasInitializedRef.current = true;
    const intervalId = window.setInterval(() => void refreshAdminData(false), syncIntervalMs);
    const handleFocus = () => void refreshAdminData(false);

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshAdminData]);

  useEffect(() => {
    setInventoryDrafts((current) => {
      const next: Record<string, string> = {};

      for (const product of products) {
        next[product.id] = current[product.id] ?? String(product.stock);
      }

      return next;
    });
  }, [products]);

  const metrics = useMemo(() => {
    const activeProducts = products.filter((product) => product.status === "active");
    const lowStockProducts = activeProducts.filter((product) => product.stock <= 5);
    const openOrders = orders.filter((order) => canCancelOrder(order));

    return {
      totalProducts: products.length,
      activeProducts: activeProducts.length,
      lowStockProducts: lowStockProducts.length,
      openOrders: openOrders.length,
      revenue: report?.total_revenue ?? 0,
    };
  }, [orders, products, report]);

  const inventoryProducts = useMemo(
    () =>
      products
        .slice()
        .sort((left, right) => left.stock - right.stock || left.name.localeCompare(right.name, "vi")),
    [products],
  );

  const resetProductForm = useCallback(() => {
    setForm(emptyProductForm);
    setEditingProductId("");
  }, []);

  const startEditingProduct = useCallback((product: Product) => {
    setEditingProductId(product.id);
    setForm(productToForm(product));
  }, []);

  const patchProduct = useCallback(
    async (product: Product, patch: Partial<CreateProductData>) => {
      if (!token || busyProductId) {
        return;
      }

      try {
        setBusyProductId(product.id);
        const response = await productApi.updateProduct(token, product.id, patch);
        setProducts((current) => dedupeProducts([response.data, ...current]));
        setInventoryDrafts((current) => ({
          ...current,
          [response.data.id]: String(response.data.stock),
        }));
        setFeedback("Đã cập nhật sản phẩm.");
      } catch (reason) {
        setFeedback(getErrorMessage(reason));
      } finally {
        setBusyProductId("");
      }
    },
    [busyProductId, token],
  );

  const saveProductForm = useCallback(async () => {
    if (!token) {
      setFeedback("Bạn cần phiên admin hợp lệ để lưu sản phẩm.");
      return;
    }

    try {
      setIsSaving(true);
      const payload = buildProductPayload(form);
      const response = editingProductId
        ? await productApi.updateProduct(token, editingProductId, payload)
        : await productApi.createProduct(token, payload);

      setProducts((current) => dedupeProducts([response.data, ...current]));
      setInventoryDrafts((current) => ({
        ...current,
        [response.data.id]: String(response.data.stock),
      }));
      setFeedback(editingProductId ? "Đã cập nhật sản phẩm." : "Đã tạo sản phẩm.");
      resetProductForm();
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsSaving(false);
    }
  }, [editingProductId, form, resetProductForm, token]);

  const deleteProduct = useCallback(
    async (product: Product) => {
      if (!token || busyProductId) {
        return;
      }

      const confirmed = window.confirm(`Xóa sản phẩm "${product.name}" khỏi catalog?`);
      if (!confirmed) {
        return;
      }

      try {
        setBusyProductId(product.id);
        await productApi.deleteProduct(token, product.id);
        setProducts((current) => current.filter((item) => item.id !== product.id));
        setInventoryDrafts((current) => {
          const next = { ...current };
          delete next[product.id];
          return next;
        });
        if (editingProductId === product.id) {
          resetProductForm();
        }
        setFeedback("Đã xóa sản phẩm.");
      } catch (reason) {
        setFeedback(getErrorMessage(reason));
      } finally {
        setBusyProductId("");
      }
    },
    [busyProductId, editingProductId, resetProductForm, token],
  );

  const setInventoryDraftValue = useCallback((productId: string, value: string) => {
    setInventoryDrafts((current) => ({
      ...current,
      [productId]: value,
    }));
  }, []);

  const saveInventory = useCallback(
    async (product: Product) => {
      const nextStock = Number.parseInt(inventoryDrafts[product.id] ?? "", 10);

      if (!Number.isInteger(nextStock) || nextStock < 0) {
        setFeedback(`Tồn kho của ${product.name} phải là số nguyên không âm.`);
        return;
      }

      await patchProduct(product, { stock: nextStock });
    },
    [inventoryDrafts, patchProduct],
  );

  const cancelOrder = useCallback(
    async (order: Order) => {
      if (!token || busyOrderId || !canCancelOrder(order)) {
        return;
      }

      const confirmed = window.confirm(`Hủy đơn ${formatShortOrderId(order.id)}?`);
      if (!confirmed) {
        return;
      }

      try {
        setBusyOrderId(order.id);
        const response = await adminApi.cancelOrder(token, order.id, {
          message: "Hủy đơn từ admin console",
        });
        setOrders((current) =>
          current.map((item) => (item.id === order.id ? response.data : item)),
        );
        setFeedback(`Đã hủy đơn ${formatShortOrderId(order.id)}.`);
      } catch (reason) {
        setFeedback(getErrorMessage(reason));
      } finally {
        setBusyOrderId("");
      }
    },
    [busyOrderId, token],
  );

  const value = useMemo<AdminConsoleContextValue>(
    () => ({
      canAccessAdmin,
      isBootstrapping,
      user,
      products,
      orders,
      report,
      reportDays,
      setReportDays,
      orderStatusFilter,
      setOrderStatusFilter,
      form,
      setForm,
      editingProductId,
      inventoryDrafts,
      feedback,
      setFeedback,
      isLoading,
      isRefreshing,
      isSaving,
      busyProductId,
      busyOrderId,
      lastSyncedAt,
      metrics,
      inventoryProducts,
      refreshAdminData,
      resetProductForm,
      startEditingProduct,
      saveProductForm,
      deleteProduct,
      patchProduct,
      setInventoryDraftValue,
      saveInventory,
      cancelOrder,
    }),
    [
      canAccessAdmin,
      isBootstrapping,
      user,
      products,
      orders,
      report,
      reportDays,
      orderStatusFilter,
      form,
      editingProductId,
      inventoryDrafts,
      feedback,
      isLoading,
      isRefreshing,
      isSaving,
      busyProductId,
      busyOrderId,
      lastSyncedAt,
      metrics,
      inventoryProducts,
      refreshAdminData,
      resetProductForm,
      startEditingProduct,
      saveProductForm,
      deleteProduct,
      patchProduct,
      setInventoryDraftValue,
      saveInventory,
      cancelOrder,
    ],
  );

  return (
    <AdminConsoleContext.Provider value={value}>
      {children}
    </AdminConsoleContext.Provider>
  );
}

export function useAdminConsole() {
  const context = useContext(AdminConsoleContext);

  if (!context) {
    throw new Error("useAdminConsole must be used within AdminConsoleProvider");
  }

  return context;
}
