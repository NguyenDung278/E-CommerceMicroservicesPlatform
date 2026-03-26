/**
 * API Module - Backward Compatibility Layer
 * This file re-exports from the new modular API structure
 * to maintain backward compatibility with existing imports.
 */

// Re-export HTTP client
import { request, API_BASE_URL, createAbortController } from "./http/client";
export { request, API_BASE_URL as apiBaseUrl, createAbortController };
export type { RequestOptions, HttpMethod, HttpError } from "./http/client";

// Re-export error handling
import { getErrorMessage, getErrorCode, isHttpError, isNetworkError, logError, createErrorHandler, ErrorCode } from "./errors/handler";
export { getErrorMessage, getErrorCode, isHttpError, isNetworkError, logError, createErrorHandler, ErrorCode };

// Re-export normalizers
import {
  normalizeProduct,
  normalizeProductList,
  normalizeProductReview,
  normalizeProductReviewList,
  normalizeProductReviewSummary,
  normalizeProductVariant,
  normalizeAddress,
  normalizeAddressList,
  normalizeShippingAddress,
  normalizeCartItem,
  normalizeCart,
  normalizeOrderItem,
  normalizeOrder,
  normalizeOrderList,
  normalizeOrderEvent,
  normalizeOrderEventList,
  normalizeOrderPreview,
  normalizePayment,
  normalizePaymentList,
  normalizeUserProfile,
  normalizeCoupon,
  normalizeProductPopularity,
  normalizeProductPopularityList,
} from "./normalizers";
export {
  normalizeProduct,
  normalizeProductList,
  normalizeProductReview,
  normalizeProductReviewList,
  normalizeProductReviewSummary,
  normalizeProductVariant,
  normalizeAddress,
  normalizeAddressList,
  normalizeShippingAddress,
  normalizeCartItem,
  normalizeCart,
  normalizeOrderItem,
  normalizeOrder,
  normalizeOrderList,
  normalizeOrderEvent,
  normalizeOrderEventList,
  normalizeOrderPreview,
  normalizePayment,
  normalizePaymentList,
  normalizeUserProfile,
  normalizeCoupon,
  normalizeProductPopularity,
  normalizeProductPopularityList,
};

// Re-export API modules
import { authApi } from "./api/auth";
import { userApi } from "./api/user";
import { productApi } from "./api/product";
import { cartApi } from "./api/cart";
import { orderApi } from "./api/order";
import { paymentApi } from "./api/payment";
import { adminApi } from "./api/admin";

export { authApi, userApi, productApi, cartApi, orderApi, paymentApi, adminApi };

// Backward compatibility unified api object
import { authApi as _authApi } from "./api/auth";
import { cartApi as _cartApi } from "./api/cart";
import { orderApi as _orderApi } from "./api/order";
import { paymentApi as _paymentApi } from "./api/payment";
import { productApi as _productApi } from "./api/product";
import { userApi as _userApi } from "./api/user";
import { adminApi as _adminApi } from "./api/admin";
import { getErrorMessage as _getErrorMessage } from "./errors/handler";

export const api = {
  register: _authApi.register,
  login: _authApi.login,
  verifyEmail: _authApi.verifyEmail,
  forgotPassword: _authApi.forgotPassword,
  resetPassword: _authApi.resetPassword,
  getProfile: _authApi.getProfile,
  updateProfile: _authApi.updateProfile,
  resendVerificationEmail: _authApi.resendVerificationEmail,
  listAddresses: _userApi.listAddresses,
  createAddress: _userApi.createAddress,
  listUsers: _userApi.listUsers,
  updateUserRole: _userApi.updateUserRole,
  listProducts: _productApi.listProducts,
  getProductById: _productApi.getProductById,
  listProductReviews: _productApi.listProductReviews,
  getMyProductReview: _productApi.getMyProductReview,
  createProductReview: _productApi.createProductReview,
  updateMyProductReview: _productApi.updateMyProductReview,
  deleteMyProductReview: _productApi.deleteMyProductReview,
  getProductPopularity: _productApi.getProductPopularity,
  createProduct: _productApi.createProduct,
  uploadProductImages: _productApi.uploadProductImages,
  updateProduct: _productApi.updateProduct,
  deleteProduct: _productApi.deleteProduct,
  getCart: _cartApi.getCart,
  addToCart: _cartApi.addToCart,
  updateCartItem: _cartApi.updateCartItem,
  removeCartItem: _cartApi.removeCartItem,
  clearCart: _cartApi.clearCart,
  mergeCart: _cartApi.mergeCart,
  createOrder: _orderApi.createOrder,
  previewOrder: _orderApi.previewOrder,
  listOrders: _orderApi.listOrders,
  getOrderById: _orderApi.getOrderById,
  getOrderEvents: _orderApi.getOrderEvents,
  cancelOrder: _orderApi.cancelOrder,
  getAdminOrderReport: _adminApi.getOrderReport,
  processPayment: _paymentApi.processPayment,
  listPayments: _paymentApi.listPayments,
  listPaymentHistory: _paymentApi.listPaymentHistory,
  getPaymentById: _paymentApi.getPaymentById,
  getPaymentsByOrderId: _paymentApi.getPaymentsByOrderId,
  listPaymentsByOrder: _paymentApi.listPaymentsByOrder,
  verifyPaymentSignature: _paymentApi.verifyPaymentSignature,
  listCoupons: _adminApi.listCoupons,
  createCoupon: _adminApi.createCoupon,
  listAdminOrders: _adminApi.listOrders,
  cancelAdminOrder: _adminApi.cancelOrder,
  listAdminPaymentsByOrder: _adminApi.listPaymentsByOrder,
  refundPayment: _adminApi.refundPayment,
  getErrorMessage: _getErrorMessage,
} as const;
