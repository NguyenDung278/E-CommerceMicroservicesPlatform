/**
 * User API Module
 * Handles all user-related API calls including
 * addresses, user management, and admin functions.
 */

import { request } from "../http-client";
import type { ApiEnvelope, Address, UserProfile } from "@/types/api";
import {
  normalizeAddress,
  normalizeAddressList,
  normalizeUserProfile,
  normalizeUserProfileList,
} from "../normalizers";

/**
 * Create address data
 */
export interface CreateAddressData {
  recipient_name: string;
  phone: string;
  street: string;
  ward?: string;
  district: string;
  city: string;
  is_default?: boolean;
}

/**
 * Update user role data
 */
export interface UpdateUserRoleData {
  role: string;
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
