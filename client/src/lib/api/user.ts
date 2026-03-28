import { request } from "@/lib/api/http-client";
import {
  normalizeAddress,
  normalizeAddressList,
  normalizePhoneVerificationChallenge,
  normalizeUserProfile,
  normalizeUserProfileList,
} from "@/lib/api/normalizers";
import type {
  Address,
  ApiEnvelope,
  PhoneVerificationChallenge,
  ProfileAddressPatch,
  UserProfile,
} from "@/types/api";

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

export interface UpdateProfileData {
  first_name?: string;
  last_name?: string;
  phone?: string;
  phone_verification_id?: string;
  default_address?: ProfileAddressPatch;
}

export interface SendPhoneOTPData {
  phone: string;
}

export interface VerifyPhoneOTPData {
  verification_id: string;
  otp_code: string;
}

export interface ResendPhoneOTPData {
  verification_id: string;
}

export const userApi = {
  getProfile(token: string): Promise<ApiEnvelope<UserProfile>> {
    return request<unknown>("/api/v1/users/profile", { token }).then((response) => ({
      ...response,
      data: normalizeUserProfile(response.data),
    }));
  },

  updateProfile(token: string, body: UpdateProfileData): Promise<ApiEnvelope<UserProfile>> {
    return request<unknown>("/api/v1/users/profile", {
      method: "PUT",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizeUserProfile(response.data),
    }));
  },

  getPhoneVerificationStatus(token: string): Promise<ApiEnvelope<PhoneVerificationChallenge | null>> {
    return request<unknown>("/api/v1/users/profile/phone-verification", { token }).then((response) => ({
      ...response,
      data: normalizePhoneVerificationChallenge(response.data),
    }));
  },

  sendPhoneOtp(token: string, body: SendPhoneOTPData): Promise<ApiEnvelope<PhoneVerificationChallenge>> {
    return request<unknown>("/api/v1/users/profile/phone-verification/send-otp", {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizePhoneVerificationChallenge(response.data) as PhoneVerificationChallenge,
    }));
  },

  verifyPhoneOtp(token: string, body: VerifyPhoneOTPData): Promise<ApiEnvelope<PhoneVerificationChallenge>> {
    return request<unknown>("/api/v1/users/profile/phone-verification/verify-otp", {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizePhoneVerificationChallenge(response.data) as PhoneVerificationChallenge,
    }));
  },

  resendPhoneOtp(token: string, body: ResendPhoneOTPData): Promise<ApiEnvelope<PhoneVerificationChallenge>> {
    return request<unknown>("/api/v1/users/profile/phone-verification/resend-otp", {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizePhoneVerificationChallenge(response.data) as PhoneVerificationChallenge,
    }));
  },

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
