import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authApiMocks = vi.hoisted(() => ({
  authApi: {
    register: vi.fn(),
    login: vi.fn(),
    refreshToken: vi.fn(),
    exchangeOAuthTicket: vi.fn(),
    verifyEmail: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    changePassword: vi.fn(),
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    getPhoneVerificationStatus: vi.fn(),
    sendPhoneOtp: vi.fn(),
    verifyPhoneOtp: vi.fn(),
    resendPhoneOtp: vi.fn(),
    resendVerificationEmail: vi.fn(),
    buildOAuthStartUrl: vi.fn(() => "/api/v1/auth/oauth/google/start"),
  },
}));

vi.mock("../src/services/api/modules/auth-api", () => authApiMocks);

import { useAuth } from "@/features/auth/hooks/use-auth";
import { AuthProvider } from "@/features/auth/providers/auth-provider";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PERSISTENT_ACCESS_TOKEN_KEY = "ecommerce_frontend_persistent_token";
const PERSISTENT_REFRESH_TOKEN_KEY = "ecommerce_frontend_persistent_refresh_token";
const SESSION_ACCESS_TOKEN_KEY = "ecommerce_frontend_session_token";
const SESSION_REFRESH_TOKEN_KEY = "ecommerce_frontend_session_refresh_token";

const mountedRoots: Array<{ unmount: () => void }> = [];

let latestAuth: ReturnType<typeof useAuth> | null = null;

function AuthProbe() {
  latestAuth = useAuth();
  return null;
}

function renderAuthProvider() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );
  });

  mountedRoots.push({
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  });
}

function createJwt(expiresInSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const encode = (value: Record<string, unknown>) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");

  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ exp })}.${encode({ sig: "ok" })}`;
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  latestAuth = null;
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  while (mountedRoots.length > 0) {
    mountedRoots.pop()?.unmount();
  }
  latestAuth = null;
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.body.innerHTML = "";
});

describe("AuthProvider session lifecycle", () => {
  it("keeps stored tokens when profile bootstrap fails for a non-auth error", async () => {
    window.localStorage.setItem(PERSISTENT_ACCESS_TOKEN_KEY, createJwt(3600));
    window.localStorage.setItem(PERSISTENT_REFRESH_TOKEN_KEY, createJwt(3600 * 24));
    authApiMocks.authApi.getProfile.mockRejectedValueOnce(new Error("Failed to fetch"));

    renderAuthProvider();
    await flushAsync();

    expect(latestAuth?.isAuthenticated).toBe(true);
    expect(window.localStorage.getItem(PERSISTENT_ACCESS_TOKEN_KEY)).toBeTruthy();
    expect(window.localStorage.getItem(PERSISTENT_REFRESH_TOKEN_KEY)).toBeTruthy();
    expect(latestAuth?.error).toContain("Không kết nối được đến API Gateway");
  });

  it("clears stored tokens when profile bootstrap proves the session is invalid", async () => {
    window.localStorage.setItem(PERSISTENT_ACCESS_TOKEN_KEY, createJwt(3600));
    window.localStorage.setItem(PERSISTENT_REFRESH_TOKEN_KEY, createJwt(3600 * 24));
    authApiMocks.authApi.getProfile.mockRejectedValueOnce({
      status: 401,
      detail: "invalid or expired token",
      code: "UNAUTHORIZED",
      message: "Unauthorized",
    });
    authApiMocks.authApi.refreshToken.mockRejectedValueOnce({
      status: 401,
      detail: "invalid or expired refresh token",
      code: "UNAUTHORIZED",
      message: "Unauthorized",
    });

    renderAuthProvider();
    await flushAsync();

    expect(latestAuth?.isAuthenticated).toBe(false);
    expect(window.localStorage.getItem(PERSISTENT_ACCESS_TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(PERSISTENT_REFRESH_TOKEN_KEY)).toBeNull();
  });

  it("removes both session and persistent tokens on explicit logout", async () => {
    window.localStorage.setItem(PERSISTENT_ACCESS_TOKEN_KEY, createJwt(3600));
    window.localStorage.setItem(PERSISTENT_REFRESH_TOKEN_KEY, createJwt(3600 * 24));
    window.sessionStorage.setItem(SESSION_ACCESS_TOKEN_KEY, createJwt(3600));
    window.sessionStorage.setItem(SESSION_REFRESH_TOKEN_KEY, createJwt(3600 * 24));
    authApiMocks.authApi.getProfile.mockResolvedValueOnce({
      data: {
        email: "demo@example.com",
        role: "user",
      },
    });

    renderAuthProvider();
    await flushAsync();

    act(() => {
      latestAuth?.logout();
    });
    await flushAsync();

    expect(latestAuth?.isAuthenticated).toBe(false);
    expect(window.localStorage.getItem(PERSISTENT_ACCESS_TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(PERSISTENT_REFRESH_TOKEN_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(SESSION_REFRESH_TOKEN_KEY)).toBeNull();
  });
});
