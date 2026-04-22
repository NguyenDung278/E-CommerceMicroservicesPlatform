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
import {
  getErrorMessage,
  getErrorCode,
  isHttpError,
  isNetworkError,
  logError,
  createErrorHandler,
  ErrorCode,
} from "./error-handler";
export {
  getErrorMessage,
  getErrorCode,
  isHttpError,
  isNetworkError,
  logError,
  createErrorHandler,
  ErrorCode,
};

// Re-export normalizers
import {
  normalizeProduct,
  normalizeProductList,
  normalizeProductReview,
  normalizeProductReviewList,
  normalizeProductReviewSummary,
  normalizeProductSearchAssist,
  normalizeProductSearchFacet,
  normalizeProductSearchFacetValue,
  normalizeProductSearchSortOption,
  normalizeProductSearchSuggestion,
  normalizeProductVariant,
  normalizeAddress,
  normalizeAddressList,
  normalizeShippingAddress,
  normalizeShippingOption,
  normalizeCartItem,
  normalizeCart,
  normalizeOrderItem,
  normalizeOrder,
  normalizeOrderList,
  normalizeOrderEvent,
  normalizeOrderEventList,
  normalizeReturnEvent,
  normalizeReturnEvidence,
  normalizeReturnItem,
  normalizeReturnQueueFailure,
  normalizeReturnQueueHealth,
  normalizeReturnEligibilityItem,
  normalizeReturnEligibilitySnapshot,
  normalizeReturnRequest,
  normalizeReturnRequestList,
  normalizeOrderPreview,
  normalizeNotificationPreference,
  normalizeNotificationInboxItem,
  normalizeNotificationInboxList,
  normalizeNotificationPreferenceList,
  normalizeProductSearchAnalyticsEntry,
  normalizeProductSearchAnalyticsSummary,
  normalizeWishlistAlert,
  normalizeWishlistAlertList,
  normalizeWishlistItem,
  normalizeWishlistItemList,
  normalizePayment,
  normalizePaymentList,
  normalizeUserProfile,
  normalizeCoupon,
  normalizeProductPopularity,
  normalizeProductPopularityList,
  normalizeStorefrontCategory,
  normalizeStorefrontCategoryList,
  normalizeStorefrontCategoryPageData,
  normalizeStorefrontEditorialSection,
  normalizeStorefrontFeaturedProduct,
  normalizeStorefrontHomeData,
  normalizeStorefrontProduct,
} from "./normalizers";
export {
  normalizeProduct,
  normalizeProductList,
  normalizeProductReview,
  normalizeProductReviewList,
  normalizeProductReviewSummary,
  normalizeProductSearchAssist,
  normalizeProductSearchFacet,
  normalizeProductSearchFacetValue,
  normalizeProductSearchSortOption,
  normalizeProductSearchSuggestion,
  normalizeProductVariant,
  normalizeAddress,
  normalizeAddressList,
  normalizeShippingAddress,
  normalizeShippingOption,
  normalizeCartItem,
  normalizeCart,
  normalizeOrderItem,
  normalizeOrder,
  normalizeOrderList,
  normalizeOrderEvent,
  normalizeOrderEventList,
  normalizeReturnEvent,
  normalizeReturnEvidence,
  normalizeReturnItem,
  normalizeReturnQueueFailure,
  normalizeReturnQueueHealth,
  normalizeReturnEligibilityItem,
  normalizeReturnEligibilitySnapshot,
  normalizeReturnRequest,
  normalizeReturnRequestList,
  normalizeOrderPreview,
  normalizeNotificationPreference,
  normalizeNotificationInboxItem,
  normalizeNotificationInboxList,
  normalizeNotificationPreferenceList,
  normalizeProductSearchAnalyticsEntry,
  normalizeProductSearchAnalyticsSummary,
  normalizeWishlistAlert,
  normalizeWishlistAlertList,
  normalizeWishlistItem,
  normalizeWishlistItemList,
  normalizePayment,
  normalizePaymentList,
  normalizeUserProfile,
  normalizeCoupon,
  normalizeProductPopularity,
  normalizeProductPopularityList,
  normalizeStorefrontCategory,
  normalizeStorefrontCategoryList,
  normalizeStorefrontCategoryPageData,
  normalizeStorefrontEditorialSection,
  normalizeStorefrontFeaturedProduct,
  normalizeStorefrontHomeData,
  normalizeStorefrontProduct,
};

// Re-export API modules
import { authApi } from "./modules/auth-api";
import { userApi } from "./modules/user-api";
import { productApi } from "./modules/product-api";
import { orderApi } from "./modules/order-api";
import { paymentApi } from "./modules/payment-api";
import { adminApi } from "./modules/admin-api";

export { authApi, userApi, productApi, orderApi, paymentApi, adminApi };

// Backward compatibility unified api object
import { authApi as _authApi } from "./modules/auth-api";
import { productApi as _productApi } from "./modules/product-api";
import { userApi as _userApi } from "./modules/user-api";
import { adminApi as _adminApi } from "./modules/admin-api";
import { getErrorMessage as _getErrorMessage } from "./error-handler";

export const api = {
  verifyEmail: _authApi.verifyEmail,
  forgotPassword: _authApi.forgotPassword,
  resetPassword: _authApi.resetPassword,
  listUsers: _userApi.listUsers,
  updateUserRole: _userApi.updateUserRole,
  listProducts: _productApi.listProducts,
  createProduct: _productApi.createProduct,
  uploadProductImages: _productApi.uploadProductImages,
  updateProduct: _productApi.updateProduct,
  deleteProduct: _productApi.deleteProduct,
  getAdminOrderReport: _adminApi.getOrderReport,
  getSearchAnalytics: _adminApi.getSearchAnalytics,
  listNotificationAudit: _adminApi.listNotificationAudit,
  listCoupons: _adminApi.listCoupons,
  createCoupon: _adminApi.createCoupon,
  listAdminOrders: _adminApi.listOrders,
  listAdminReturns: _adminApi.listReturns,
  getAdminReturnQueueHealth: _adminApi.getReturnQueueHealth,
  cancelAdminOrder: _adminApi.cancelOrder,
  updateAdminReturnStatus: _adminApi.updateReturnStatus,
  requestAdminReturnRefund: _adminApi.requestReturnRefund,
  listAdminPaymentsByOrders: _adminApi.listPaymentsByOrders,
  refundPayment: _adminApi.refundPayment,
  getErrorMessage: _getErrorMessage,
} as const;
