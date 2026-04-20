/**
 * User API Module
 * Handles all user-related API calls including
 * addresses, user management, and admin functions.
 */

import { request } from "../http-client";
import type {
  Address,
  ApiEnvelope,
  NotificationPreference,
  UserProfile,
  WishlistAlert,
  WishlistItem,
} from "@/types/api";
import {
  normalizeAddress,
  normalizeAddressList,
  normalizeNotificationPreferenceList,
  normalizeUserProfile,
  normalizeUserProfileList,
  normalizeWishlistAlertList,
  normalizeWishlistItem,
  normalizeWishlistItemList,
} from "../normalizers";

/**
 * Create address data
 */
export interface CreateAddressData {
  recipient_name: string;
  phone: string;
  location: string;
  is_default?: boolean;
}

/**
 * Update user role data
 */
export interface UpdateUserRoleData {
  role: string;
}

export interface AddWishlistItemData {
  product_id: string;
}

export interface SyncWishlistData {
  product_ids: string[];
}

export interface UpdateNotificationPreferencesData {
  preferences: Array<{
    topic: string;
    enabled: boolean;
  }>;
}

export interface UploadAvatarResult {
  avatar_url?: string;
  user?: UserProfile;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function normalizeUploadAvatarResult(value: unknown): UploadAvatarResult {
  const payload = isRecord(value) ? value : {};
  const user = isRecord(payload.user) ? normalizeUserProfile(payload.user) : undefined;
  const avatarUrl =
    normalizeOptionalString(payload.avatar_url) ??
    normalizeOptionalString(payload.url) ??
    normalizeOptionalString(payload.avatarUrl) ??
    user?.avatar_url;

  return {
    avatar_url: avatarUrl,
    user,
  };
}

/**
 * User API functions
 */
export const userApi = {
  /**
   * List all addresses for current user
   */
  listAddresses(token: string): Promise<ApiEnvelope<Address[]>> {
    return request<unknown>("/api/v1/users/addresses", { token }).then((response) => ({
      ...response,
      data: normalizeAddressList(response.data),
    }));
  },

  /**
   * Create a new address
   */
  createAddress(token: string, body: CreateAddressData): Promise<ApiEnvelope<Address>> {
    return request<unknown>("/api/v1/users/addresses", {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizeAddress(response.data),
    }));
  },

  listWishlist(token: string): Promise<ApiEnvelope<WishlistItem[]>> {
    return request<unknown>("/api/v1/users/wishlist", { token }).then((response) => ({
      ...response,
      data: normalizeWishlistItemList(response.data),
    }));
  },

  addWishlistItem(token: string, body: AddWishlistItemData): Promise<ApiEnvelope<WishlistItem>> {
    return request<unknown>("/api/v1/users/wishlist", {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizeWishlistItem(response.data),
    }));
  },

  syncWishlist(token: string, body: SyncWishlistData): Promise<ApiEnvelope<WishlistItem[]>> {
    return request<unknown>("/api/v1/users/wishlist/sync", {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizeWishlistItemList(response.data),
    }));
  },

  removeWishlistItem(token: string, productId: string): Promise<ApiEnvelope<null>> {
    return request<null>(`/api/v1/users/wishlist/${encodeURIComponent(productId)}`, {
      method: "DELETE",
      token,
    });
  },

  listWishlistAlerts(token: string): Promise<ApiEnvelope<WishlistAlert[]>> {
    return request<unknown>("/api/v1/users/wishlist/alerts", { token }).then((response) => ({
      ...response,
      data: normalizeWishlistAlertList(response.data),
    }));
  },

  listNotificationPreferences(token: string): Promise<ApiEnvelope<NotificationPreference[]>> {
    return request<unknown>("/api/v1/users/notification-preferences", { token }).then(
      (response) => ({
        ...response,
        data: normalizeNotificationPreferenceList(response.data),
      })
    );
  },

  updateNotificationPreferences(
    token: string,
    body: UpdateNotificationPreferencesData
  ): Promise<ApiEnvelope<NotificationPreference[]>> {
    return request<unknown>("/api/v1/users/notification-preferences", {
      method: "PUT",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizeNotificationPreferenceList(response.data),
    }));
  },

  /**
   * Upload current user avatar
   */
  uploadAvatar(token: string, file: File): Promise<ApiEnvelope<UploadAvatarResult>> {
    const formData = new FormData();
    formData.append("avatar", file);

    return request<unknown>("/api/v1/users/avatar", {
      method: "POST",
      token,
      body: formData,
    }).then((response) => ({
      ...response,
      data: normalizeUploadAvatarResult(response.data),
    }));
  },

  /**
   * List all users (admin only)
   */
  listUsers(token: string): Promise<ApiEnvelope<UserProfile[]>> {
    return request<unknown>("/api/v1/admin/users", { token }).then((response) => ({
      ...response,
      data: normalizeUserProfileList(response.data),
    }));
  },

  /**
   * Update user role (admin only)
   */
  updateUserRole(
    token: string,
    userId: string,
    body: UpdateUserRoleData
  ): Promise<ApiEnvelope<UserProfile>> {
    return request<unknown>(`/api/v1/admin/users/${encodeURIComponent(userId)}/role`, {
      method: "PUT",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizeUserProfile(response.data),
    }));
  },
};

export default userApi;
