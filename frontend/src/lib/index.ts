/**
 * Library Index
 * Central export point for all library modules
 */

// Re-export HTTP client
export { request, API_BASE_URL, createAbortController } from "./http/client";
export type { RequestOptions, HttpMethod, HttpError } from "./http/client";

// Re-export error handling
export { getErrorMessage, getErrorCode, isHttpError, isNetworkError, logError, createErrorHandler, ErrorCode } from "./errors/handler";

// Re-export normalizers
export * from "./normalizers";

// Re-export API modules
export { authApi } from "./api/auth";
export { userApi } from "./api/user";
export { productApi } from "./api/product";
export { cartApi } from "./api/cart";
export { orderApi } from "./api/order";
export { paymentApi } from "./api/payment";
export { adminApi } from "./api/admin";
