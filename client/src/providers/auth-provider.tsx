"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { useSessionToken } from "@/hooks/useSessionToken";
import { authApi, type OAuthProvider } from "@/lib/api/auth";
import { getErrorMessage, isHttpError } from "@/lib/errors/handler";
import type { ApiEnvelope, UserProfile } from "@/types/api";
import {
  clearPendingOAuthRemember,
  savePendingOAuthRemember,
} from "@/utils/auth/oauth";

type RegisterInput = {
  email: string;
  phone: string;
  password: string;
  first_name: string;
  last_name: string;
};

type LoginInput = {
  identifier: string;
  email?: string;
  password: string;
};

type UpdateProfileInput = {
  first_name: string;
  last_name: string;
};

type ChangePasswordInput = {
  current_password: string;
  new_password: string;
};

type AuthContextValue = {
  token: string;
  refreshToken: string;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  canAccessAdmin: boolean;
  isBootstrapping: boolean;
  error: string;
  register: (input: RegisterInput, remember?: boolean) => Promise<UserProfile>;
  login: (input: LoginInput, remember?: boolean) => Promise<UserProfile>;
  beginOAuthLogin: (provider: OAuthProvider, redirectTo?: string, remember?: boolean) => void;
  exchangeOAuthTicket: (ticket: string, remember?: boolean) => Promise<UserProfile>;
  logout: () => void;
  refreshProfile: () => Promise<UserProfile>;
  updateProfile: (input: UpdateProfileInput) => Promise<UserProfile>;
  changePassword: (input: ChangePasswordInput) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  clearError: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { token, refreshToken, remember, hasSession, setTokens, clearTokens } = useSessionToken();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(hasSession);

  const completeAuth = useCallback(
    (
      response: ApiEnvelope<{ token: string; refresh_token: string; user: UserProfile }>,
      rememberSession: boolean,
    ) => {
      startTransition(() => {
        setTokens(response.data.token, response.data.refresh_token, rememberSession);
        setUser(response.data.user);
        setError("");
      });
    },
    [setTokens],
  );

  const refreshSession = useCallback(
    async (rememberSession = remember) => {
      if (!refreshToken) {
        throw new Error("Missing refresh token");
      }

      const response = await authApi.refreshToken({ refresh_token: refreshToken });
      completeAuth(response, rememberSession);
      return response.data.token;
    },
    [completeAuth, refreshToken, remember],
  );

  const withFreshToken = useCallback(
    async <T,>(operation: (activeToken: string) => Promise<T>): Promise<T> => {
      if (token) {
        try {
          return await operation(token);
        } catch (reason) {
          if (!isHttpError(reason) || reason.status !== 401 || !refreshToken) {
            throw reason;
          }
        }
      }

      const refreshedToken = await refreshSession();
      return operation(refreshedToken);
    },
    [refreshSession, refreshToken, token],
  );

  useEffect(() => {
    let active = true;

    if (!hasSession) {
      startTransition(() => {
        setUser(null);
        setError("");
        setIsBootstrapping(false);
      });
      return () => {
        active = false;
      };
    }

    if (user && token) {
      setIsBootstrapping(false);
      return () => {
        active = false;
      };
    }

    setIsBootstrapping(true);

    const bootstrap = async () => {
      try {
        const profile = await withFreshToken((activeToken) => authApi.getProfile(activeToken));
        if (!active) {
          return;
        }

        startTransition(() => {
          setUser(profile.data);
          setError("");
        });
      } catch (reason) {
        if (!active) {
          return;
        }

        clearTokens();
        clearPendingOAuthRemember();
        startTransition(() => {
          setUser(null);
          setError(getErrorMessage(reason));
        });
      } finally {
        if (active) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [clearTokens, hasSession, refreshToken, token, user, withFreshToken]);

  async function register(input: RegisterInput, rememberSession = false) {
    setError("");
    const response = await authApi.register(input);
    completeAuth(response, rememberSession);
    return response.data.user;
  }

  async function login(input: LoginInput, rememberSession = false) {
    setError("");
    const response = await authApi.login(input);
    completeAuth(response, rememberSession);
    return response.data.user;
  }

  function beginOAuthLogin(provider: OAuthProvider, redirectTo = "/profile", rememberSession = false) {
    savePendingOAuthRemember(rememberSession);
    window.location.assign(authApi.buildOAuthStartUrl(provider, redirectTo));
  }

  async function exchangeOAuthTicket(ticket: string, rememberSession = false) {
    setError("");
    const response = await authApi.exchangeOAuthTicket({ ticket });
    completeAuth(response, rememberSession);
    clearPendingOAuthRemember();
    return response.data.user;
  }

  function logout() {
    clearTokens();
    clearPendingOAuthRemember();
    startTransition(() => {
      setUser(null);
      setError("");
    });
  }

  async function refreshProfile() {
    const response = await withFreshToken((activeToken) => authApi.getProfile(activeToken));
    startTransition(() => {
      setUser(response.data);
      setError("");
    });
    return response.data;
  }

  async function updateProfile(input: UpdateProfileInput) {
    const response = await withFreshToken((activeToken) => authApi.updateProfile(activeToken, input));
    startTransition(() => {
      setUser(response.data);
      setError("");
    });
    return response.data;
  }

  async function changePassword(input: ChangePasswordInput) {
    await withFreshToken((activeToken) => authApi.changePassword(activeToken, input));
  }

  async function resendVerificationEmail() {
    await withFreshToken((activeToken) => authApi.resendVerificationEmail(activeToken));
  }

  const isAdmin = user?.role === "admin";
  const isStaff = user?.role === "staff";
  const canAccessAdmin = isAdmin || isStaff;

  return (
    <AuthContext.Provider
      value={{
        token,
        refreshToken,
        user,
        isAuthenticated: Boolean(token || refreshToken),
        isAdmin,
        isStaff,
        canAccessAdmin,
        isBootstrapping,
        error,
        register,
        login,
        beginOAuthLogin,
        exchangeOAuthTicket,
        logout,
        refreshProfile,
        updateProfile,
        changePassword,
        resendVerificationEmail,
        clearError: () => setError(""),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

