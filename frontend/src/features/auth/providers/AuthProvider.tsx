/**
 * Authentication Context Module
 * Provides centralized authentication state management
 * with secure token handling and user profile management.
 */

import {
  createContext,
  startTransition,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { useSessionToken } from "../hooks/useSessionToken";
import { authApi, type OAuthProvider } from "../../../shared/api/modules/authApi";
import { getErrorMessage, isHttpError } from "../../../shared/api/error-handler";
import type {
  ApiEnvelope,
  PhoneVerificationChallenge,
  ProfileAddressPatch,
  UserProfile
} from "../../../shared/types/api";
import {
  clearPendingOAuthRemember,
  savePendingOAuthRemember,
} from "../storage/oauthSessionStorage";

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

type AuthOptions = {
  remember?: boolean;
};

type OAuthLoginOptions = {
  redirectTo?: string;
  remember?: boolean;
};

type UpdateProfileInput = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  phone_verification_id?: string;
  default_address?: ProfileAddressPatch;
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
  register: (input: RegisterInput, options?: AuthOptions) => Promise<UserProfile>;
  login: (input: LoginInput, options?: AuthOptions) => Promise<UserProfile>;
  beginOAuthLogin: (provider: OAuthProvider, options?: OAuthLoginOptions) => void;
  exchangeOAuthTicket: (ticket: string, options?: AuthOptions) => Promise<UserProfile>;
  logout: () => void;
  refreshProfile: () => Promise<UserProfile>;
  updateProfile: (input: UpdateProfileInput) => Promise<UserProfile>;
  getPhoneVerificationStatus: () => Promise<PhoneVerificationChallenge | null>;
  sendPhoneOtp: (phone: string) => Promise<PhoneVerificationChallenge>;
  verifyPhoneOtp: (verificationId: string, otpCode: string) => Promise<PhoneVerificationChallenge>;
  resendPhoneOtp: (verificationId: string) => Promise<PhoneVerificationChallenge>;
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
    (response: ApiEnvelope<{ token: string; refresh_token: string; user: UserProfile }>, rememberSession: boolean) => {
      startTransition(() => {
        setTokens(response.data.token, response.data.refresh_token, rememberSession);
        setUser(response.data.user);
        setError("");
      });
    },
    [setTokens]
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
    [completeAuth, refreshToken, remember]
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
    [token, refreshToken, refreshSession]
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
  }, [token, refreshToken, user, hasSession, withFreshToken, clearTokens]);

  async function register(input: RegisterInput, options?: AuthOptions) {
    setError("");
    const response = await authApi.register(input);
    completeAuth(response, options?.remember ?? false);
    return response.data.user;
  }

  async function login(input: LoginInput, options?: AuthOptions) {
    setError("");
    const response = await authApi.login(input);
    completeAuth(response, options?.remember ?? false);
    return response.data.user;
  }

  function beginOAuthLogin(provider: OAuthProvider, options?: OAuthLoginOptions) {
    savePendingOAuthRemember(options?.remember ?? false);
    window.location.assign(authApi.buildOAuthStartUrl(provider, options?.redirectTo ?? "/profile"));
  }

  async function exchangeOAuthTicket(ticket: string, options?: AuthOptions) {
    setError("");
    const response = await authApi.exchangeOAuthTicket({ ticket });
    completeAuth(response, options?.remember ?? false);
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
    setError("");
    const response = await withFreshToken((activeToken) => authApi.getProfile(activeToken));
    startTransition(() => {
      setUser(response.data);
      setError("");
    });
    return response.data;
  }

  async function updateProfile(input: UpdateProfileInput) {
    setError("");
    const response = await withFreshToken((activeToken) => authApi.updateProfile(activeToken, input));
    startTransition(() => {
      setUser(response.data);
      setError("");
    });
    return response.data;
  }

  async function getPhoneVerificationStatus() {
    setError("");
    const response = await withFreshToken((activeToken) => authApi.getPhoneVerificationStatus(activeToken));
    return response.data;
  }

  async function sendPhoneOtp(phone: string) {
    setError("");
    const response = await withFreshToken((activeToken) =>
      authApi.sendPhoneOtp(activeToken, {
        phone,
      })
    );
    return response.data;
  }

  async function verifyPhoneOtp(verificationId: string, otpCode: string) {
    setError("");
    const response = await withFreshToken((activeToken) =>
      authApi.verifyPhoneOtp(activeToken, {
        verification_id: verificationId,
        otp_code: otpCode,
      })
    );
    return response.data;
  }

  async function resendPhoneOtp(verificationId: string) {
    setError("");
    const response = await withFreshToken((activeToken) =>
      authApi.resendPhoneOtp(activeToken, {
        verification_id: verificationId,
      })
    );
    return response.data;
  }

  async function resendVerificationEmail() {
    setError("");
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
        getPhoneVerificationStatus,
        sendPhoneOtp,
        verifyPhoneOtp,
        resendPhoneOtp,
        resendVerificationEmail,
        clearError: () => setError(""),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
