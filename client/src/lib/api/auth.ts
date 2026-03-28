import { API_BASE_URL, request } from "@/lib/api/http-client";
import type { ApiEnvelope, AuthPayload } from "@/types/api";

export type OAuthProvider = "google";

export interface LoginCredentials {
  identifier: string;
  email?: string;
  password: string;
}

export interface RegisterData {
  email: string;
  phone: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface RefreshTokenData {
  refresh_token: string;
}

export interface VerifyEmailData {
  token: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  new_password: string;
}

export interface ChangePasswordData {
  current_password: string;
  new_password: string;
}

export interface OAuthExchangeData {
  ticket: string;
}

export const authApi = {
  register(body: RegisterData): Promise<ApiEnvelope<AuthPayload>> {
    return request<AuthPayload>("/api/v1/auth/register", {
      method: "POST",
      body,
    });
  },

  login(body: LoginCredentials): Promise<ApiEnvelope<AuthPayload>> {
    return request<AuthPayload>("/api/v1/auth/login", {
      method: "POST",
      body,
    });
  },

  refreshToken(body: RefreshTokenData): Promise<ApiEnvelope<AuthPayload>> {
    return request<AuthPayload>("/api/v1/auth/refresh", {
      method: "POST",
      body,
    });
  },

  exchangeOAuthTicket(body: OAuthExchangeData): Promise<ApiEnvelope<AuthPayload>> {
    return request<AuthPayload>("/api/v1/auth/oauth/exchange", {
      method: "POST",
      body,
    });
  },

  verifyEmail(body: VerifyEmailData): Promise<ApiEnvelope<null>> {
    return request<null>("/api/v1/auth/verify-email", {
      method: "POST",
      body,
    });
  },

  forgotPassword(body: ForgotPasswordData): Promise<ApiEnvelope<null>> {
    return request<null>("/api/v1/auth/forgot-password", {
      method: "POST",
      body,
    });
  },

  resetPassword(body: ResetPasswordData): Promise<ApiEnvelope<null>> {
    return request<null>("/api/v1/auth/reset-password", {
      method: "POST",
      body,
    });
  },
  changePassword(token: string, body: ChangePasswordData): Promise<ApiEnvelope<null>> {
    return request<null>("/api/v1/users/password", {
      method: "PUT",
      token,
      body,
    });
  },

  resendVerificationEmail(token: string): Promise<ApiEnvelope<null>> {
    return request<null>("/api/v1/users/verify-email/resend", {
      method: "POST",
      token,
    });
  },

  buildOAuthStartUrl(provider: OAuthProvider, redirectTo = "/profile") {
    const path = `/api/v1/auth/oauth/${provider}/start?redirect_to=${encodeURIComponent(redirectTo)}`;
    const baseUrl = resolveOAuthBaseUrl();

    return `${baseUrl}${path}`;
  },
};

function resolveOAuthBaseUrl() {
  if (typeof window === "undefined") {
    return API_BASE_URL || "http://localhost:3000";
  }

  if (API_BASE_URL) {
    if (/^https?:\/\//i.test(API_BASE_URL)) {
      return API_BASE_URL;
    }

    return `${window.location.origin}${API_BASE_URL}`;
  }

  return window.location.origin;
}
