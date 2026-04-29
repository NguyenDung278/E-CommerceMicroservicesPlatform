import { request } from "./http";
import type {
  Address,
  EmailVerificationStatus,
  NotificationPreference,
  PhoneVerificationStatus,
  UploadAvatarResponse,
  UserProfile,
} from "../types/api";

export type CreateAddressRequest = {
  recipient_name: string;
  phone: string;
  location: string;
  is_default?: boolean;
};

export type UpdateAddressRequest = Partial<CreateAddressRequest>;

export type UpdateProfileRequest = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  phone_verification_id?: string;
};

export type ChangePasswordRequest = {
  current_password: string;
  new_password: string;
};

export type UpdateNotificationPreference = {
  topic: string;
  enabled: boolean;
};

export async function updateProfile(
  token: string,
  body: UpdateProfileRequest,
): Promise<UserProfile> {
  const response = await request<UserProfile>("/api/v1/users/profile", {
    method: "PUT",
    token,
    body,
  });
  return response.data;
}

export async function uploadAvatar(token: string, file: File): Promise<UploadAvatarResponse> {
  const formData = new FormData();
  formData.set("avatar", file);

  const response = await request<UploadAvatarResponse>("/api/v1/users/avatar", {
    method: "POST",
    token,
    body: formData,
  });
  return response.data;
}

export async function getPhoneVerificationStatus(
  token: string,
): Promise<PhoneVerificationStatus | null> {
  const response = await request<PhoneVerificationStatus | null>(
    "/api/v1/users/profile/phone-verification",
    { token },
  );
  return response.data ?? null;
}

export async function sendPhoneVerificationOTP(
  token: string,
  phone: string,
): Promise<PhoneVerificationStatus> {
  const response = await request<PhoneVerificationStatus>(
    "/api/v1/users/profile/phone-verification/send-otp",
    {
      method: "POST",
      token,
      body: { phone },
    },
  );
  return response.data;
}

export async function verifyPhoneVerificationOTP(
  token: string,
  verificationId: string,
  otpCode: string,
): Promise<PhoneVerificationStatus> {
  const response = await request<PhoneVerificationStatus>(
    "/api/v1/users/profile/phone-verification/verify-otp",
    {
      method: "POST",
      token,
      body: { verification_id: verificationId, otp_code: otpCode },
    },
  );
  return response.data;
}

export async function resendPhoneVerificationOTP(
  token: string,
  verificationId: string,
): Promise<PhoneVerificationStatus> {
  const response = await request<PhoneVerificationStatus>(
    "/api/v1/users/profile/phone-verification/resend-otp",
    {
      method: "POST",
      token,
      body: { verification_id: verificationId },
    },
  );
  return response.data;
}

export async function getEmailVerificationStatus(
  token: string,
): Promise<EmailVerificationStatus | null> {
  const response = await request<EmailVerificationStatus | null>(
    "/api/v1/users/verify-email/status",
    { token },
  );
  return response.data ?? null;
}

export async function sendEmailVerificationOTP(token: string): Promise<EmailVerificationStatus> {
  const response = await request<EmailVerificationStatus>(
    "/api/v1/users/verify-email/send-otp",
    {
      method: "POST",
      token,
    },
  );
  return response.data;
}

export async function verifyEmailVerificationOTP(
  token: string,
  verificationId: string,
  otpCode: string,
): Promise<EmailVerificationStatus> {
  const response = await request<EmailVerificationStatus>(
    "/api/v1/users/verify-email/verify-otp",
    {
      method: "POST",
      token,
      body: { verification_id: verificationId, otp_code: otpCode },
    },
  );
  return response.data;
}

export async function resendEmailVerificationOTP(
  token: string,
  verificationId: string,
): Promise<EmailVerificationStatus> {
  const response = await request<EmailVerificationStatus>(
    "/api/v1/users/verify-email/resend-otp",
    {
      method: "POST",
      token,
      body: { verification_id: verificationId },
    },
  );
  return response.data;
}

export async function changePassword(token: string, body: ChangePasswordRequest): Promise<void> {
  await request<null>("/api/v1/users/password", {
    method: "PUT",
    token,
    body,
  });
}

export async function listAddresses(token: string): Promise<Address[]> {
  const response = await request<Address[]>("/api/v1/users/addresses", { token });
  return Array.isArray(response.data) ? response.data : [];
}

export async function createAddress(token: string, body: CreateAddressRequest): Promise<Address> {
  const response = await request<Address>("/api/v1/users/addresses", {
    method: "POST",
    token,
    body,
  });
  return response.data;
}

export async function updateAddress(
  token: string,
  addressId: string,
  body: UpdateAddressRequest,
): Promise<Address> {
  const response = await request<Address>(
    `/api/v1/users/addresses/${encodeURIComponent(addressId)}`,
    {
      method: "PUT",
      token,
      body,
    },
  );
  return response.data;
}

export async function deleteAddress(token: string, addressId: string): Promise<void> {
  await request<null>(`/api/v1/users/addresses/${encodeURIComponent(addressId)}`, {
    method: "DELETE",
    token,
  });
}

export async function setDefaultAddress(token: string, addressId: string): Promise<Address> {
  const response = await request<Address>(
    `/api/v1/users/addresses/${encodeURIComponent(addressId)}/default`,
    {
      method: "PUT",
      token,
    },
  );
  return response.data;
}

export async function listNotificationPreferences(
  token: string,
): Promise<NotificationPreference[]> {
  const response = await request<NotificationPreference[]>(
    "/api/v1/users/notification-preferences",
    { token },
  );
  return Array.isArray(response.data) ? response.data : [];
}

export async function updateNotificationPreferences(
  token: string,
  preferences: UpdateNotificationPreference[],
): Promise<NotificationPreference[]> {
  const response = await request<NotificationPreference[]>(
    "/api/v1/users/notification-preferences",
    {
      method: "PUT",
      token,
      body: { preferences },
    },
  );
  return Array.isArray(response.data) ? response.data : [];
}
