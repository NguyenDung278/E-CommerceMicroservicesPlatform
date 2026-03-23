import type {
  AdminOrderReport,
  Address,
  ApiEnvelope,
  AuthPayload,
  Cart,
  Coupon,
  Order,
  OrderItem,
  OrderEvent,
  OrderPreview,
  Payment,
  ProductPopularity,
  Product,
  ShippingAddress,
  UploadedProductImages,
  UserProfile
} from "../types/api";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const apiBaseUrl = configuredApiBaseUrl ? configuredApiBaseUrl.replace(/\/+$/, "") : "";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function normalizeProductVariant(value: unknown): Product["variants"][number] {
  const variant = isRecord(value) ? value : {};

  return {
    sku: normalizeString(variant.sku),
    label: normalizeString(variant.label),
    size: normalizeString(variant.size) || undefined,
    color: normalizeString(variant.color) || undefined,
    price: normalizeNumber(variant.price),
    stock: normalizeNumber(variant.stock)
  };
}

function normalizeProduct(value: unknown): Product {
  const product = isRecord(value) ? value : {};

  return {
    id: normalizeString(product.id),
    name: normalizeString(product.name),
    description: normalizeString(product.description),
    price: normalizeNumber(product.price),
    stock: normalizeNumber(product.stock),
    category: normalizeString(product.category),
    brand: normalizeString(product.brand),
    tags: Array.isArray(product.tags)
      ? product.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
      : [],
    status: normalizeString(product.status),
    sku: normalizeString(product.sku),
    variants: Array.isArray(product.variants) ? product.variants.map((variant) => normalizeProductVariant(variant)) : [],
    image_url: normalizeString(product.image_url),
    image_urls: Array.isArray(product.image_urls)
      ? product.image_urls.filter((url): url is string => typeof url === "string" && url.trim().length > 0)
      : [],
    created_at: normalizeString(product.created_at),
    updated_at: normalizeString(product.updated_at)
  };
}

function normalizeProductList(value: unknown) {
  return Array.isArray(value) ? value.map((product) => normalizeProduct(product)) : [];
}

function normalizeAddress(value: unknown): Address {
  const address = isRecord(value) ? value : {};

  return {
    id: normalizeString(address.id),
    user_id: normalizeString(address.user_id),
    recipient_name: normalizeString(address.recipient_name),
    phone: normalizeString(address.phone),
    street: normalizeString(address.street),
    ward: normalizeString(address.ward) || undefined,
    district: normalizeString(address.district),
    city: normalizeString(address.city),
    is_default: normalizeBoolean(address.is_default),
    created_at: normalizeString(address.created_at),
    updated_at: normalizeString(address.updated_at)
  };
}

function normalizeAddressList(value: unknown) {
  return Array.isArray(value) ? value.map((address) => normalizeAddress(address)) : [];
}

function normalizeShippingAddress(value: unknown): ShippingAddress | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    recipient_name: normalizeString(value.recipient_name),
    phone: normalizeString(value.phone),
    street: normalizeString(value.street),
    ward: normalizeString(value.ward) || undefined,
    district: normalizeString(value.district),
    city: normalizeString(value.city)
  };
}

function normalizeOrderItem(value: unknown): OrderItem {
  const item = isRecord(value) ? value : {};

  return {
    id: normalizeString(item.id),
    order_id: normalizeString(item.order_id),
    product_id: normalizeString(item.product_id),
    name: normalizeString(item.name),
    price: normalizeNumber(item.price),
    quantity: normalizeNumber(item.quantity)
  };
}

function normalizeOrder(value: unknown): Order {
  const order = isRecord(value) ? value : {};

  return {
    id: normalizeString(order.id),
    user_id: normalizeString(order.user_id),
    status: normalizeString(order.status),
    subtotal_price: normalizeNumber(order.subtotal_price),
    discount_amount: normalizeNumber(order.discount_amount),
    coupon_code: normalizeString(order.coupon_code) || undefined,
    shipping_method: normalizeString(order.shipping_method),
    shipping_fee: normalizeNumber(order.shipping_fee),
    shipping_address: normalizeShippingAddress(order.shipping_address),
    total_price: normalizeNumber(order.total_price),
    items: Array.isArray(order.items) ? order.items.map((item) => normalizeOrderItem(item)) : [],
    created_at: normalizeString(order.created_at),
    updated_at: normalizeString(order.updated_at)
  };
}

function normalizeOrderList(value: unknown) {
  return Array.isArray(value) ? value.map((order) => normalizeOrder(order)) : [];
}

function normalizeOrderEvent(value: unknown): OrderEvent {
  const event = isRecord(value) ? value : {};

  return {
    id: normalizeString(event.id),
    order_id: normalizeString(event.order_id),
    type: normalizeString(event.type),
    status: normalizeString(event.status),
    actor_id: normalizeString(event.actor_id) || undefined,
    actor_role: normalizeString(event.actor_role) || undefined,
    message: normalizeString(event.message),
    created_at: normalizeString(event.created_at)
  };
}

function normalizeOrderEventList(value: unknown) {
  return Array.isArray(value) ? value.map((event) => normalizeOrderEvent(event)) : [];
}

function normalizePayment(value: unknown): Payment {
  const payment = isRecord(value) ? value : {};

  return {
    id: normalizeString(payment.id),
    order_id: normalizeString(payment.order_id),
    user_id: normalizeString(payment.user_id),
    order_total: normalizeNumber(payment.order_total),
    amount: normalizeNumber(payment.amount),
    status: normalizeString(payment.status),
    transaction_type: normalizeString(payment.transaction_type),
    reference_payment_id: normalizeString(payment.reference_payment_id) || undefined,
    payment_method: normalizeString(payment.payment_method),
    gateway_provider: normalizeString(payment.gateway_provider),
    gateway_transaction_id: normalizeString(payment.gateway_transaction_id) || undefined,
    gateway_order_id: normalizeString(payment.gateway_order_id) || undefined,
    checkout_url: normalizeString(payment.checkout_url) || undefined,
    signature_verified: normalizeBoolean(payment.signature_verified),
    failure_reason: normalizeString(payment.failure_reason) || undefined,
    net_paid_amount:
      isRecord(payment) && typeof payment.net_paid_amount === "number" && Number.isFinite(payment.net_paid_amount)
        ? payment.net_paid_amount
        : undefined,
    outstanding_amount:
      isRecord(payment) && typeof payment.outstanding_amount === "number" && Number.isFinite(payment.outstanding_amount)
        ? payment.outstanding_amount
        : undefined,
    created_at: normalizeString(payment.created_at),
    updated_at: normalizeString(payment.updated_at)
  };
}

function normalizePaymentList(value: unknown) {
  return Array.isArray(value) ? value.map((payment) => normalizePayment(payment)) : [];
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
};

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, message: string, detail: string) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, options: RequestOptions = {}) {
  const headers = new Headers({
    Accept: "application/json"
  });
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const requestBody =
    options.body === undefined
      ? undefined
      : isFormData
        ? (options.body as FormData)
        : JSON.stringify(options.body);

  if (options.body !== undefined && !isFormData) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    body: requestBody,
    headers,
    signal: options.signal
  });

  const raw = await response.text();
  let parsed: ApiEnvelope<T> | null = null;

  if (raw) {
    try {
      parsed = JSON.parse(raw) as ApiEnvelope<T>;
    } catch {
      parsed = null;
    }
  }

  if (!response.ok || !parsed?.success) {
    const message = parsed?.message || response.statusText || "Request failed";
    const detail = parsed?.error || raw || "Unexpected response from server";
    throw new ApiError(response.status, message, detail);
  }

  return parsed;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409 && error.detail.includes("email already exists")) {
      return "Email đã tồn tại. Hãy đăng nhập hoặc dùng email khác.";
    }
    if (error.status === 409 && error.detail.includes("phone already exists")) {
      return "Số điện thoại đã được sử dụng. Hãy dùng số khác hoặc đăng nhập.";
    }
    if (error.status === 401 && error.detail.includes("invalid email/phone or password")) {
      return "Thông tin đăng nhập hoặc mật khẩu chưa chính xác.";
    }
    if (error.status === 401 && error.detail.includes("invalid or expired verification token")) {
      return "Liên kết xác minh email không hợp lệ hoặc đã hết hạn.";
    }
    if (error.status === 401 && error.detail.includes("invalid or expired reset token")) {
      return "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.";
    }
    return error.detail ? `${error.message}: ${error.detail}` : error.message;
  }
  if (error instanceof Error) {
    if (error.message.includes("Failed to fetch")) {
      return "Không kết nối được đến API Gateway. Frontend hiện gọi cùng origin `/api`; hãy kiểm tra `http://localhost:8080/health` hoặc `http://localhost:4173/health`.";
    }
    return error.message;
  }
  return "Có lỗi không xác định xảy ra.";
}

export const api = {
  register(body: {
    email: string;
    phone: string;
    password: string;
    first_name: string;
    last_name: string;
  }) {
    return request<AuthPayload>("/api/v1/auth/register", { method: "POST", body });
  },
  login(body: { identifier: string; email?: string; password: string }) {
    return request<AuthPayload>("/api/v1/auth/login", { method: "POST", body });
  },
  verifyEmail(body: { token: string }) {
    return request<null>("/api/v1/auth/verify-email", { method: "POST", body });
  },
  forgotPassword(body: { email: string }) {
    return request<null>("/api/v1/auth/forgot-password", { method: "POST", body });
  },
  resetPassword(body: { token: string; new_password: string }) {
    return request<null>("/api/v1/auth/reset-password", { method: "POST", body });
  },
  getProfile(token: string) {
    return request<UserProfile>("/api/v1/users/profile", { token });
  },
  updateProfile(
    token: string,
    body: {
      first_name: string;
      last_name: string;
    }
  ) {
    return request<UserProfile>("/api/v1/users/profile", { method: "PUT", token, body });
  },
  resendVerificationEmail(token: string) {
    return request<null>("/api/v1/users/verify-email/resend", { method: "POST", token });
  },
  listAddresses(token: string) {
    return request<unknown>("/api/v1/users/addresses", { token }).then((response) => ({
      ...response,
      data: normalizeAddressList(response.data)
    }));
  },
  createAddress(
    token: string,
    body: {
      recipient_name: string;
      phone: string;
      street: string;
      ward?: string;
      district: string;
      city: string;
      is_default?: boolean;
    }
  ) {
    return request<unknown>("/api/v1/users/addresses", { method: "POST", token, body }).then((response) => ({
      ...response,
      data: normalizeAddress(response.data)
    }));
  },
  listUsers(token: string) {
    return request<UserProfile[]>("/api/v1/admin/users", { token });
  },
  updateUserRole(token: string, userId: string, body: { role: string }) {
    return request<UserProfile>(`/api/v1/admin/users/${encodeURIComponent(userId)}/role`, {
      method: "PUT",
      token,
      body
    });
  },
  listProducts(options?: {
    search?: string;
    category?: string;
    brand?: string;
    tag?: string;
    status?: string;
    minPrice?: number;
    maxPrice?: number;
    size?: string;
    color?: string;
    sort?: "latest" | "price_asc" | "price_desc" | "popular";
    limit?: number;
  }) {
    const params = new URLSearchParams();
    params.set("limit", String(options?.limit ?? 24));

    if (options?.search) {
      params.set("search", options.search);
    }
    if (options?.category) {
      params.set("category", options.category);
    }
    if (options?.brand) {
      params.set("brand", options.brand);
    }
    if (options?.tag) {
      params.set("tag", options.tag);
    }
    if (options?.status) {
      params.set("status", options.status);
    }
    if (typeof options?.minPrice === "number" && options.minPrice > 0) {
      params.set("min_price", String(options.minPrice));
    }
    if (typeof options?.maxPrice === "number" && options.maxPrice > 0) {
      params.set("max_price", String(options.maxPrice));
    }
    if (options?.size) {
      params.set("size", options.size);
    }
    if (options?.color) {
      params.set("color", options.color);
    }
    if (options?.sort) {
      params.set("sort", options.sort);
    }

    const query = `?${params.toString()}`;
    return request<unknown>(`/api/v1/products${query}`).then((response) => ({
      ...response,
      data: normalizeProductList(response.data)
    }));
  },
  getProductById(productId: string) {
    return request<unknown>(`/api/v1/products/${encodeURIComponent(productId)}`).then((response) => {
      if (!isRecord(response.data)) {
        throw new ApiError(500, "Invalid product response", "Product payload missing");
      }

      return {
        ...response,
        data: normalizeProduct(response.data)
      };
    });
  },
  getProductPopularity(limit = 100) {
    return request<ProductPopularity[]>(`/api/v1/catalog/popularity?limit=${encodeURIComponent(String(limit))}`);
  },
  createProduct(
    token: string,
    body: {
      name: string;
      description: string;
      price: number;
      stock: number;
      category: string;
      brand: string;
      tags: string[];
      status: string;
      sku: string;
      variants: Array<{
        sku: string;
        label: string;
        size?: string;
        color?: string;
        price: number;
        stock: number;
      }>;
      image_url: string;
      image_urls: string[];
    }
  ) {
    return request<unknown>("/api/v1/products", { method: "POST", token, body }).then((response) => ({
      ...response,
      data: normalizeProduct(response.data)
    }));
  },
  uploadProductImages(token: string, files: File[]) {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("images", file);
    });

    return request<UploadedProductImages>("/api/v1/products/uploads", {
      method: "POST",
      token,
      body: formData
    });
  },
  updateProduct(
    token: string,
    productId: string,
    body: Partial<{
      name: string;
      description: string;
      price: number;
      stock: number;
      category: string;
      brand: string;
      tags: string[];
      status: string;
      sku: string;
      variants: Array<{
        sku: string;
        label: string;
        size?: string;
        color?: string;
        price: number;
        stock: number;
      }>;
      image_url: string;
      image_urls: string[];
    }>
  ) {
    return request<Product>(`/api/v1/products/${encodeURIComponent(productId)}`, {
      method: "PUT",
      token,
      body
    }).then((response) => ({
      ...response,
      data: normalizeProduct(response.data)
    }));
  },
  deleteProduct(token: string, productId: string) {
    return request<null>(`/api/v1/products/${encodeURIComponent(productId)}`, {
      method: "DELETE",
      token
    });
  },
  getCart(token: string) {
    return request<Cart>("/api/v1/cart", { token });
  },
  addToCart(
    token: string,
    body: {
      product_id: string;
      quantity: number;
    }
  ) {
    return request<Cart>("/api/v1/cart/items", { method: "POST", token, body });
  },
  updateCartItem(token: string, productId: string, quantity: number) {
    return request<Cart>(`/api/v1/cart/items/${encodeURIComponent(productId)}`, {
      method: "PUT",
      token,
      body: { quantity }
    });
  },
  removeCartItem(token: string, productId: string) {
    return request<Cart>(`/api/v1/cart/items/${encodeURIComponent(productId)}`, {
      method: "DELETE",
      token
    });
  },
  clearCart(token: string) {
    return request<null>("/api/v1/cart", { method: "DELETE", token });
  },
  listOrders(token: string) {
    return request<unknown>("/api/v1/orders", { token }).then((response) => ({
      ...response,
      data: normalizeOrderList(response.data)
    }));
  },
  getAdminOrderReport(token: string, days = 30) {
    return request<AdminOrderReport>(`/api/v1/admin/orders/report?days=${encodeURIComponent(String(days))}`, {
      token
    });
  },
  getOrderById(token: string, orderId: string) {
    return request<unknown>(`/api/v1/orders/${encodeURIComponent(orderId)}`, { token }).then((response) => ({
      ...response,
      data: normalizeOrder(response.data)
    }));
  },
  createOrder(
    token: string,
    body: {
      items: Array<{
        product_id: string;
        quantity: number;
      }>;
      coupon_code?: string;
      shipping_method?: string;
      shipping_address?: {
        recipient_name: string;
        phone: string;
        street: string;
        ward?: string;
        district: string;
        city: string;
      };
    }
  ) {
    return request<unknown>("/api/v1/orders", { method: "POST", token, body }).then((response) => ({
      ...response,
      data: normalizeOrder(response.data)
    }));
  },
  previewOrder(
    token: string,
    body: {
      items: Array<{
        product_id: string;
        quantity: number;
      }>;
      coupon_code?: string;
      shipping_method?: string;
      shipping_address?: {
        recipient_name: string;
        phone: string;
        street: string;
        ward?: string;
        district: string;
        city: string;
      };
    }
  ) {
    return request<OrderPreview>("/api/v1/orders/preview", { method: "POST", token, body });
  },
  getOrderTimeline(token: string, orderId: string) {
    return request<unknown>(`/api/v1/orders/${encodeURIComponent(orderId)}/events`, { token }).then((response) => ({
      ...response,
      data: normalizeOrderEventList(response.data)
    }));
  },
  listAdminOrders(
    token: string,
    options?: { page?: number; limit?: number; userId?: string; status?: string; from?: string; to?: string }
  ) {
    const params = new URLSearchParams();
    params.set("page", String(options?.page ?? 1));
    params.set("limit", String(options?.limit ?? 20));

    if (options?.userId) {
      params.set("user_id", options.userId);
    }
    if (options?.status) {
      params.set("status", options.status);
    }
    if (options?.from) {
      params.set("from", options.from);
    }
    if (options?.to) {
      params.set("to", options.to);
    }

    return request<unknown>(`/api/v1/admin/orders?${params.toString()}`, { token }).then((response) => ({
      ...response,
      data: normalizeOrderList(response.data)
    }));
  },
  getAdminOrder(token: string, orderId: string) {
    return request<unknown>(`/api/v1/admin/orders/${encodeURIComponent(orderId)}`, { token }).then((response) => ({
      ...response,
      data: normalizeOrder(response.data)
    }));
  },
  getAdminOrderTimeline(token: string, orderId: string) {
    return request<unknown>(`/api/v1/admin/orders/${encodeURIComponent(orderId)}/events`, { token }).then((response) => ({
      ...response,
      data: normalizeOrderEventList(response.data)
    }));
  },
  updateAdminOrderStatus(
    token: string,
    orderId: string,
    body: {
      status: string;
      message?: string;
    }
  ) {
    return request<unknown>(`/api/v1/admin/orders/${encodeURIComponent(orderId)}/status`, {
      method: "PUT",
      token,
      body
    }).then((response) => ({
      ...response,
      data: normalizeOrder(response.data)
    }));
  },
  cancelAdminOrder(
    token: string,
    orderId: string,
    body?: {
      message?: string;
    }
  ) {
    return request<unknown>(`/api/v1/admin/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: "PUT",
      token,
      body
    }).then((response) => ({
      ...response,
      data: normalizeOrder(response.data)
    }));
  },
  listCoupons(token: string) {
    return request<Coupon[]>("/api/v1/admin/coupons", { token });
  },
  createCoupon(
    token: string,
    body: {
      code: string;
      description?: string;
      discount_type: "fixed" | "percentage";
      discount_value: number;
      min_order_amount?: number;
      usage_limit?: number;
      expires_at?: string;
      active?: boolean;
    }
  ) {
    return request<Coupon>("/api/v1/admin/coupons", { method: "POST", token, body });
  },
  processPayment(
    token: string,
    body: {
      order_id: string;
      payment_method: string;
      amount?: number;
    }
  ) {
    return request<unknown>("/api/v1/payments", { method: "POST", token, body }).then((response) => ({
      ...response,
      data: normalizePayment(response.data)
    }));
  },
  getPaymentByOrder(token: string, orderId: string) {
    return request<unknown>(`/api/v1/payments/order/${encodeURIComponent(orderId)}`, { token }).then((response) => ({
      ...response,
      data: normalizePayment(response.data)
    }));
  },
  listPaymentsByOrder(token: string, orderId: string) {
    return request<unknown>(`/api/v1/payments/order/${encodeURIComponent(orderId)}/history`, { token }).then((response) => ({
      ...response,
      data: normalizePaymentList(response.data)
    }));
  },
  listPaymentHistory(token: string) {
    return request<unknown>("/api/v1/payments/history", { token }).then((response) => ({
      ...response,
      data: normalizePaymentList(response.data)
    }));
  },
  refundPayment(
    token: string,
    paymentId: string,
    body?: {
      amount?: number;
      message?: string;
    }
    ) {
    return request<unknown>(`/api/v1/admin/payments/${encodeURIComponent(paymentId)}/refunds`, {
      method: "POST",
      token,
      body
    }).then((response) => ({
      ...response,
      data: normalizePayment(response.data)
    }));
  },
  listAdminPaymentsByOrder(token: string, orderId: string) {
    return request<unknown>(`/api/v1/admin/payments/order/${encodeURIComponent(orderId)}/history`, {
      token
    }).then((response) => ({
      ...response,
      data: normalizePaymentList(response.data)
    }));
  }
};
