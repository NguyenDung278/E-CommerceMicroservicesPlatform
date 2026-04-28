import { request } from "./http";
import type { Address, NotificationPreference, UserProfile } from "../types/api";

export type CreateAddressRequest = {
  recipient_name: string;
  phone: string;
  location: string;
  is_default?: boolean;
};

export type UpdateProfileRequest = {
  first_name?: string;
  last_name?: string;
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
