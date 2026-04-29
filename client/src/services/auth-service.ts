import { request } from "./http";
import { apiBaseUrl } from "./config";
import type { AuthPayload, UserProfile } from "../types/api";

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  email: string;
  phone?: string;
  password: string;
  first_name: string;
  last_name: string;
};

export type OAuthExchangeRequest = {
  ticket: string;
};

export type ForgotPasswordRequest = {
  email: string;
};

export type ResetPasswordRequest = {
  token: string;
  new_password: string;
};

function apiUrl(path: string): string {
  return `${apiBaseUrl.replace(/\/$/, "")}${path}`;
}

export async function login(body: LoginRequest): Promise<AuthPayload> {
  const response = await request<AuthPayload>("/api/v1/auth/login", {
    method: "POST",
    body,
  });
  return response.data;
}

export async function register(body: RegisterRequest): Promise<AuthPayload> {
  const response = await request<AuthPayload>("/api/v1/auth/register", {
    method: "POST",
    body,
  });
  return response.data;
}

export async function forgotPassword(body: ForgotPasswordRequest): Promise<void> {
  await request<null>("/api/v1/auth/forgot-password", {
    method: "POST",
    body,
  });
}

export async function resetPassword(body: ResetPasswordRequest): Promise<void> {
  await request<null>("/api/v1/auth/reset-password", {
    method: "POST",
    body,
  });
}

export async function exchangeOAuthTicket(body: OAuthExchangeRequest): Promise<AuthPayload> {
  const response = await request<AuthPayload>("/api/v1/auth/oauth/exchange", {
    method: "POST",
    body,
  });
  return response.data;
}

export function getGoogleOAuthStartUrl(redirectTo = "/account"): string {
  const params = new URLSearchParams({ redirect_to: redirectTo });
  return apiUrl(`/api/v1/auth/oauth/google/start?${params.toString()}`);
}

export async function getProfile(token: string): Promise<UserProfile> {
  const response = await request<UserProfile>("/api/v1/users/profile", { token });
  return response.data;
}
