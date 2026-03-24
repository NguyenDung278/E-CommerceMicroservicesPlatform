/**
 * Authentication API Module
 * Handles all authentication-related API calls including
 * registration, login, password reset, and email verification.
 */

import { request } from "../http/client";
import type { ApiEnvelope, AuthPayload, UserProfile } from "../../types/api";
import { normalizeUserProfile } from "../normalizers";

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
  first_name: string;
  last_name: string;
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

  /**
   * Resend verification email
   */
  resendVerificationEmail(token: string): Promise<ApiEnvelope<null>> {
    return request<null>("/api/v1/users/verify-email/resend", {
      method: "POST",
      token,
    });
  },
};

export default authApi;
