/**
 * Authentication API Module
 * Handles all authentication-related API calls including
 * registration, login, password reset, and email verification.
 */

import { API_BASE_URL, request } from "../http/client";
import type {
  ApiEnvelope,
  AuthPayload,
  PhoneVerificationChallenge,
  ProfileAddressPatch,
  UserProfile
} from "../../types/api";
import { normalizePhoneVerificationChallenge, normalizeUserProfile } from "../normalizers";

export type OAuthProvider = "google";

/**
 * Login credentials
 */
export interface LoginCredentials {
  identifier: string;
  email?: string;
  password: string;
}

/**
 * Registration data
 */
export interface RegisterData {
  email: string;
  phone: string;
  password: string;
  first_name: string;
  last_name: string;
}

/**
 * Email verification data
 */
export interface VerifyEmailData {
  token: string;
}

export interface RefreshTokenData {
  refresh_token: string;
}

/**
 * Forgot password data
 */
export interface ForgotPasswordData {
  email: string;
}

/**
 * Reset password data
 */
export interface ResetPasswordData {
  token: string;
  new_password: string;
}

/**
 * Update profile data
 */
export interface UpdateProfileData {
  first_name?: string;
  last_name?: string;
  phone?: string;
  phone_verification_id?: string;
  default_address?: ProfileAddressPatch;
}

export interface OAuthExchangeData {
  ticket: string;
}

export interface SendPhoneOtpData {
  phone: string;
}

export interface VerifyPhoneOtpData {
  verification_id: string;
  otp_code: string;
}

export interface ResendPhoneOtpData {
  verification_id: string;
}

/**
 * Auth API functions
 */
export const authApi = {
  /**
   * Register a new user account
   */
  register(body: RegisterData): Promise<ApiEnvelope<AuthPayload>> {
    return request<AuthPayload>("/api/v1/auth/register", {
      method: "POST",
      body,
    });
  },

  /**
   * Login with email/phone and password
   */
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

  /**
   * Verify email address with token
   */
  verifyEmail(body: VerifyEmailData): Promise<ApiEnvelope<null>> {
    return request<null>("/api/v1/auth/verify-email", {
      method: "POST",
      body,
    });
  },

  /**
   * Request password reset email
   */
  forgotPassword(body: ForgotPasswordData): Promise<ApiEnvelope<null>> {
    return request<null>("/api/v1/auth/forgot-password", {
      method: "POST",
      body,
    });
  },

  /**
   * Reset password with token
   */
  resetPassword(body: ResetPasswordData): Promise<ApiEnvelope<null>> {
    return request<null>("/api/v1/auth/reset-password", {
      method: "POST",
      body,
    });
  },

  /**
   * Get current user profile
   */
  getProfile(token: string): Promise<ApiEnvelope<UserProfile>> {
    return request<unknown>("/api/v1/users/profile", { token }).then((response) => ({
      ...response,
      data: normalizeUserProfile(response.data),
    }));
  },

  /**
   * Update user profile
   */
  updateProfile(
    token: string,
    body: UpdateProfileData
  ): Promise<ApiEnvelope<UserProfile>> {
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

  sendPhoneOtp(token: string, body: SendPhoneOtpData): Promise<ApiEnvelope<PhoneVerificationChallenge>> {
    return request<unknown>("/api/v1/users/profile/phone-verification/send-otp", {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizePhoneVerificationChallenge(response.data) as PhoneVerificationChallenge,
    }));
  },

  verifyPhoneOtp(token: string, body: VerifyPhoneOtpData): Promise<ApiEnvelope<PhoneVerificationChallenge>> {
    return request<unknown>("/api/v1/users/profile/phone-verification/verify-otp", {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizePhoneVerificationChallenge(response.data) as PhoneVerificationChallenge,
    }));
  },

  resendPhoneOtp(token: string, body: ResendPhoneOtpData): Promise<ApiEnvelope<PhoneVerificationChallenge>> {
    return request<unknown>("/api/v1/users/profile/phone-verification/resend-otp", {
      method: "POST",
      token,
      body,
    }).then((response) => ({
      ...response,
      data: normalizePhoneVerificationChallenge(response.data) as PhoneVerificationChallenge,
    }));
  },

  /**
   * Resend verification email
   */
  resendVerificationEmail(token: string): Promise<ApiEnvelope<null>> {
    return request<null>("/api/v1/users/verify-email/resend", {
      method: "POST",
      token,
    });
  },

  buildOAuthStartUrl(provider: OAuthProvider, redirectTo = "/profile"): string {
    const path = `/api/v1/auth/oauth/${provider}/start?redirect_to=${encodeURIComponent(redirectTo)}`;
    const baseUrl = resolveOAuthBaseUrl();

    return `${baseUrl}${path}`;
  },
};

function resolveOAuthBaseUrl(): string {
  if (typeof window === "undefined") {
    return API_BASE_URL || "http://localhost:8080";
  }

  if (API_BASE_URL) {
    if (/^https?:\/\//i.test(API_BASE_URL)) {
      return API_BASE_URL;
    }

    return `${window.location.origin}${API_BASE_URL}`;
  }

  if (window.location.port === "8080") {
    return window.location.origin;
  }

  return `${window.location.protocol}//${window.location.hostname}:8080`;
}

export default authApi;
