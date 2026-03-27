import { request } from "@/lib/api/http-client";
import {
  normalizeAddress,
  normalizeAddressList,
  normalizeUserProfile,
  normalizeUserProfileList,
} from "@/lib/api/normalizers";
import type { Address, ApiEnvelope, UserProfile } from "@/types/api";

export interface CreateAddressData {
  recipient_name: string;
  phone: string;
  street: string;
  ward?: string;
  district: string;
  city: string;
  is_default?: boolean;
}

export interface UpdateAddressData {
  recipient_name?: string;
  phone?: string;
  street?: string;
  ward?: string;
  district?: string;
  city?: string;
  is_default?: boolean;
}

export interface UpdateUserRoleData {
  role: string;
}

export const userApi = {
  listAddresses(token: string): Promise<ApiEnvelope<Address[]>> {
    return request<unknown>("/api/v1/users/addresses", { token }).then((response) => ({
      ...response,
      data: normalizeAddressList(response.data),
    }));
  },

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

  updateAddress(token: string, addressId: string, body: UpdateAddressData): Promise<ApiEnvelope<Address>> {
    return request<unknown>(`/api/v1/users/addresses/${encodeURIComponent(addressId)}`, {
      method: "PUT",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizeAddress(response.data),
    }));
  },

  deleteAddress(token: string, addressId: string): Promise<ApiEnvelope<null>> {
    return request<null>(`/api/v1/users/addresses/${encodeURIComponent(addressId)}`, {
      method: "DELETE",
      token,
    });
  },

  setDefaultAddress(token: string, addressId: string): Promise<ApiEnvelope<Address>> {
    return request<unknown>(`/api/v1/users/addresses/${encodeURIComponent(addressId)}/default`, {
      method: "PUT",
      token,
    }).then((response) => ({
      ...response,
      data: normalizeAddress(response.data),
    }));
  },

  listUsers(token: string): Promise<ApiEnvelope<UserProfile[]>> {
    return request<unknown>("/api/v1/admin/users", { token }).then((response) => ({
      ...response,
      data: normalizeUserProfileList(response.data),
    }));
  },

  updateUserRole(token: string, userId: string, body: UpdateUserRoleData): Promise<ApiEnvelope<UserProfile>> {
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

