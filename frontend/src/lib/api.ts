import type {
  AdminOrderReport,
  Address,
  ApiEnvelope,
  AuthPayload,
  Cart,
  Coupon,
  Order,
  OrderEvent,
  OrderPreview,
  Payment,
  Product,
  UploadedProductImages,
  UserProfile
} from "../types/api";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const apiBaseUrl = configuredApiBaseUrl ? configuredApiBaseUrl.replace(/\/+$/, "") : "";

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
    return request<Address[]>("/api/v1/users/addresses", { token });
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
    return request<Address>("/api/v1/users/addresses", { method: "POST", token, body });
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

    const query = `?${params.toString()}`;
    return request<Product[]>(`/api/v1/products${query}`);
  },
  getProductById(productId: string) {
    return request<Product>(`/api/v1/products/${encodeURIComponent(productId)}`);
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
        price: number;
        stock: number;
      }>;
      image_url: string;
      image_urls: string[];
    }
  ) {
    return request<Product>("/api/v1/products", { method: "POST", token, body });
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
    });
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
    return request<Order[]>("/api/v1/orders", { token });
  },
  getAdminOrderReport(token: string, days = 30) {
    return request<AdminOrderReport>(`/api/v1/admin/orders/report?days=${encodeURIComponent(String(days))}`, {
      token
    });
  },
  getOrderById(token: string, orderId: string) {
    return request<Order>(`/api/v1/orders/${encodeURIComponent(orderId)}`, { token });
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
    return request<Order>("/api/v1/orders", { method: "POST", token, body });
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
    return request<OrderEvent[]>(`/api/v1/orders/${encodeURIComponent(orderId)}/events`, { token });
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

    return request<Order[]>(`/api/v1/admin/orders?${params.toString()}`, { token });
  },
  getAdminOrder(token: string, orderId: string) {
    return request<Order>(`/api/v1/admin/orders/${encodeURIComponent(orderId)}`, { token });
  },
  getAdminOrderTimeline(token: string, orderId: string) {
    return request<OrderEvent[]>(`/api/v1/admin/orders/${encodeURIComponent(orderId)}/events`, { token });
  },
  updateAdminOrderStatus(
    token: string,
    orderId: string,
    body: {
      status: string;
      message?: string;
    }
  ) {
    return request<Order>(`/api/v1/admin/orders/${encodeURIComponent(orderId)}/status`, {
      method: "PUT",
      token,
      body
    });
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
    }
  ) {
    return request<Payment>("/api/v1/payments", { method: "POST", token, body });
  },
  getPaymentByOrder(token: string, orderId: string) {
    return request<Payment>(`/api/v1/payments/order/${encodeURIComponent(orderId)}`, { token });
  }
};
