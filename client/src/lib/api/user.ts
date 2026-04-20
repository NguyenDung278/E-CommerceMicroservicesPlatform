import { request } from "@/lib/api/http-client";
import {
  normalizeAddress,
  normalizeAddressList,
  normalizeEmailVerificationChallenge,
  normalizeNotificationPreferenceList,
  normalizePhoneVerificationChallenge,
  normalizeUserProfile,
  normalizeUserProfileList,
  normalizeWishlistAlertList,
  normalizeWishlistItem,
  normalizeWishlistItemList,
} from "@/lib/api/normalizers";
import type {
  Address,
  ApiEnvelope,
  EmailVerificationChallenge,
  NotificationPreference,
  PhoneVerificationChallenge,
  ProfileAddressPatch,
  UserProfile,
  WishlistAlert,
  WishlistItem,
} from "@/types/api";

export interface CreateAddressData {
  recipient_name: string;
  phone: string;
  location: string;
  is_default?: boolean;
}

export interface UpdateAddressData {
  recipient_name?: string;
  phone?: string;
  location?: string;
  is_default?: boolean;
}

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

export interface VerifyEmailOTPData {
  verification_id: string;
  otp_code: string;
}

export interface ResendEmailOTPData {
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

  getEmailVerificationStatus(token: string): Promise<ApiEnvelope<EmailVerificationChallenge | null>> {
    return request<unknown>("/api/v1/users/verify-email/status", { token }).then((response) => ({
      ...response,
      data: normalizeEmailVerificationChallenge(response.data),
    }));
  },

  sendEmailVerificationOtp(token: string): Promise<ApiEnvelope<EmailVerificationChallenge | null>> {
    return request<unknown>("/api/v1/users/verify-email/send-otp", {
      method: "POST",
      token,
    }).then((response) => ({
      ...response,
      data: normalizeEmailVerificationChallenge(response.data),
    }));
  },

  verifyEmailOtp(token: string, body: VerifyEmailOTPData): Promise<ApiEnvelope<EmailVerificationChallenge>> {
    return request<unknown>("/api/v1/users/verify-email/verify-otp", {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizeEmailVerificationChallenge(response.data) as EmailVerificationChallenge,
    }));
  },

  resendEmailVerificationOtp(token: string, body: ResendEmailOTPData): Promise<ApiEnvelope<EmailVerificationChallenge>> {
    return request<unknown>("/api/v1/users/verify-email/resend-otp", {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizeEmailVerificationChallenge(response.data) as EmailVerificationChallenge,
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
      }),
    );
  },

  updateNotificationPreferences(
    token: string,
    body: UpdateNotificationPreferencesData,
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
