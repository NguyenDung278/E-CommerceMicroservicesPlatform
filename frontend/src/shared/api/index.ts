/**
 * API Module - Backward Compatibility Layer
 * This file re-exports from the new modular API structure
 * to maintain backward compatibility with existing imports.
 */

// Re-export HTTP client
import { request, API_BASE_URL, createAbortController } from "./http-client";
export { request, API_BASE_URL as apiBaseUrl, createAbortController };
export type { RequestOptions, HttpMethod, HttpError } from "./http-client";

// Re-export error handling
import { getErrorMessage, getErrorCode, isHttpError, isNetworkError, logError, createErrorHandler, ErrorCode } from "./error-handler";
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
import { authApi } from "./modules/authApi";
import { userApi } from "./modules/userApi";
import { productApi } from "./modules/productApi";
import { cartApi } from "./modules/cartApi";
import { orderApi } from "./modules/orderApi";
import { paymentApi } from "./modules/paymentApi";
import { adminApi } from "./modules/adminApi";

export { authApi, userApi, productApi, cartApi, orderApi, paymentApi, adminApi };

// Backward compatibility unified api object
import { authApi as _authApi } from "./modules/authApi";
import { cartApi as _cartApi } from "./modules/cartApi";
import { orderApi as _orderApi } from "./modules/orderApi";
import { paymentApi as _paymentApi } from "./modules/paymentApi";
import { productApi as _productApi } from "./modules/productApi";
import { userApi as _userApi } from "./modules/userApi";
import { adminApi as _adminApi } from "./modules/adminApi";
import { getErrorMessage as _getErrorMessage } from "./error-handler";

export const api = {
  register: _authApi.register,
  login: _authApi.login,
  refreshToken: _authApi.refreshToken,
  verifyEmail: _authApi.verifyEmail,
  forgotPassword: _authApi.forgotPassword,
  resetPassword: _authApi.resetPassword,
  exchangeOAuthTicket: _authApi.exchangeOAuthTicket,
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
  listCoupons: _adminApi.listCoupons,
  createCoupon: _adminApi.createCoupon,
  listAdminOrders: _adminApi.listOrders,
  cancelAdminOrder: _adminApi.cancelOrder,
  listAdminPaymentsByOrder: _adminApi.listPaymentsByOrder,
  refundPayment: _adminApi.refundPayment,
  getErrorMessage: _getErrorMessage,
} as const;
