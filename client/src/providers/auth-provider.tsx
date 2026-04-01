"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useSessionToken } from "@/hooks/useSessionToken";
import { authApi, type OAuthProvider } from "@/lib/api/auth";
import { userApi } from "@/lib/api/user";
import { getErrorMessage, isHttpError } from "@/lib/errors/handler";
import type {
  ApiEnvelope,
  PhoneVerificationChallenge,
  ProfileAddressPatch,
  UserProfile,
} from "@/types/api";
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
  first_name?: string;
  last_name?: string;
  phone?: string;
  phone_verification_id?: string;
  default_address?: ProfileAddressPatch;
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
  getPhoneVerificationStatus: () => Promise<PhoneVerificationChallenge | null>;
  sendPhoneOtp: (phone: string) => Promise<PhoneVerificationChallenge>;
  verifyPhoneOtp: (verificationId: string, otpCode: string) => Promise<PhoneVerificationChallenge>;
  resendPhoneOtp: (verificationId: string) => Promise<PhoneVerificationChallenge>;
  changePassword: (input: ChangePasswordInput) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  clearError: () => void;
};

type AuthStateValue = Pick<
  AuthContextValue,
  | "token"
  | "refreshToken"
  | "user"
  | "isAuthenticated"
  | "isAdmin"
  | "isStaff"
  | "canAccessAdmin"
  | "isBootstrapping"
  | "error"
>;

type AuthActionsValue = Pick<
  AuthContextValue,
  | "register"
  | "login"
  | "beginOAuthLogin"
  | "exchangeOAuthTicket"
  | "logout"
  | "refreshProfile"
  | "updateProfile"
  | "getPhoneVerificationStatus"
  | "sendPhoneOtp"
  | "verifyPhoneOtp"
  | "resendPhoneOtp"
  | "changePassword"
  | "resendVerificationEmail"
  | "clearError"
>;

export const AuthContext = createContext<AuthContextValue | null>(null);
export const AuthStateContext = createContext<AuthStateValue | null>(null);
export const AuthActionsContext = createContext<AuthActionsValue | null>(null);

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
        const profile = await withFreshToken((activeToken) => userApi.getProfile(activeToken));
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

  const register = useCallback(async (input: RegisterInput, rememberSession = false) => {
    setError("");
    const response = await authApi.register(input);
    completeAuth(response, rememberSession);
    return response.data.user;
  }, [completeAuth]);

  const login = useCallback(async (input: LoginInput, rememberSession = false) => {
    setError("");
    const response = await authApi.login(input);
    completeAuth(response, rememberSession);
    return response.data.user;
  }, [completeAuth]);

  const beginOAuthLogin = useCallback((
    provider: OAuthProvider,
    redirectTo = "/profile",
    rememberSession = false,
  ) => {
    savePendingOAuthRemember(rememberSession);
    window.location.assign(authApi.buildOAuthStartUrl(provider, redirectTo));
  }, []);

  const exchangeOAuthTicket = useCallback(async (ticket: string, rememberSession = false) => {
    setError("");
    const response = await authApi.exchangeOAuthTicket({ ticket });
    completeAuth(response, rememberSession);
    clearPendingOAuthRemember();
    return response.data.user;
  }, [completeAuth]);

  const logout = useCallback(() => {
    clearTokens();
    clearPendingOAuthRemember();
    startTransition(() => {
      setUser(null);
      setError("");
    });
  }, [clearTokens]);

  const refreshProfile = useCallback(async () => {
    setError("");
    const response = await withFreshToken((activeToken) => userApi.getProfile(activeToken));
    startTransition(() => {
      setUser(response.data);
      setError("");
    });
    return response.data;
  }, [withFreshToken]);

  const updateProfile = useCallback(async (input: UpdateProfileInput) => {
    setError("");
    const response = await withFreshToken((activeToken) => userApi.updateProfile(activeToken, input));
    startTransition(() => {
      setUser(response.data);
      setError("");
    });
    return response.data;
  }, [withFreshToken]);

  const getPhoneVerificationStatus = useCallback(async () => {
    setError("");
    const response = await withFreshToken((activeToken) => userApi.getPhoneVerificationStatus(activeToken));
    return response.data;
  }, [withFreshToken]);

  const sendPhoneOtp = useCallback(async (phone: string) => {
    setError("");
    const response = await withFreshToken((activeToken) =>
      userApi.sendPhoneOtp(activeToken, {
        phone,
      }),
    );
    return response.data;
  }, [withFreshToken]);

  const verifyPhoneOtp = useCallback(async (verificationId: string, otpCode: string) => {
    setError("");
    const response = await withFreshToken((activeToken) =>
      userApi.verifyPhoneOtp(activeToken, {
        verification_id: verificationId,
        otp_code: otpCode,
      }),
    );
    return response.data;
  }, [withFreshToken]);

  const resendPhoneOtp = useCallback(async (verificationId: string) => {
    setError("");
    const response = await withFreshToken((activeToken) =>
      userApi.resendPhoneOtp(activeToken, {
        verification_id: verificationId,
      }),
    );
    return response.data;
  }, [withFreshToken]);

  const changePassword = useCallback(async (input: ChangePasswordInput) => {
    setError("");
    await withFreshToken((activeToken) => authApi.changePassword(activeToken, input));
  }, [withFreshToken]);

  const resendVerificationEmail = useCallback(async () => {
    setError("");
    await withFreshToken((activeToken) => authApi.resendVerificationEmail(activeToken));
  }, [withFreshToken]);

  const clearError = useCallback(() => {
    setError("");
  }, []);

  const isAdmin = user?.role === "admin";
  const isStaff = user?.role === "staff";
  const canAccessAdmin = isAdmin || isStaff;
  const isAuthenticated = Boolean(token || refreshToken);

  const authState = useMemo<AuthStateValue>(
    () => ({
      token,
      refreshToken,
      user,
      isAuthenticated,
      isAdmin,
      isStaff,
      canAccessAdmin,
      isBootstrapping,
      error,
    }),
    [
      token,
      refreshToken,
      user,
      isAuthenticated,
      isAdmin,
      isStaff,
      canAccessAdmin,
      isBootstrapping,
      error,
    ],
  );

  const authActions = useMemo<AuthActionsValue>(
    () => ({
      register,
      login,
      beginOAuthLogin,
      exchangeOAuthTicket,
      logout,
      refreshProfile,
      updateProfile,
      getPhoneVerificationStatus,
      sendPhoneOtp,
      verifyPhoneOtp,
      resendPhoneOtp,
      changePassword,
      resendVerificationEmail,
      clearError,
    }),
    [
      register,
      login,
      beginOAuthLogin,
      exchangeOAuthTicket,
      logout,
      refreshProfile,
      updateProfile,
      getPhoneVerificationStatus,
      sendPhoneOtp,
      verifyPhoneOtp,
      resendPhoneOtp,
      changePassword,
      resendVerificationEmail,
      clearError,
    ],
  );

  const authContextValue = useMemo<AuthContextValue>(
    () => ({
      ...authState,
      ...authActions,
    }),
    [authState, authActions],
  );

  return (
    <AuthStateContext.Provider value={authState}>
      <AuthActionsContext.Provider value={authActions}>
        <AuthContext.Provider value={authContextValue}>
          {children}
        </AuthContext.Provider>
      </AuthActionsContext.Provider>
    </AuthStateContext.Provider>
  );
}
