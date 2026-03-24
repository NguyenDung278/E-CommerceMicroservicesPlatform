/**
 * Authentication Context Module
 * Provides centralized authentication state management
 * with secure token handling and user profile management.
 */

import {
  createContext,
  startTransition,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { useSessionToken } from "../hooks/useSessionToken";
import { authApi } from "../lib/api/auth";
import { getErrorMessage } from "../lib/errors/handler";
import type { UserProfile } from "../types/api";
import type { ApiEnvelope } from "../types/api";

// Input types
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

type UpdateProfileInput = {
  first_name: string;
  last_name: string;
};

// Context value type
type AuthContextValue = {
  token: string;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  canAccessAdmin: boolean;
  isBootstrapping: boolean;
  error: string;
  register: (input: RegisterInput, options?: AuthOptions) => Promise<UserProfile>;
  login: (input: LoginInput, options?: AuthOptions) => Promise<UserProfile>;
  logout: () => void;
  refreshProfile: () => Promise<UserProfile>;
  updateProfile: (input: UpdateProfileInput) => Promise<UserProfile>;
  resendVerificationEmail: () => Promise<void>;
  clearError: () => void;
};

// Create context
export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Authentication Provider Component
 * Manages authentication state and provides auth methods to children
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { token, setToken, clearToken } = useSessionToken();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(Boolean(token));

  // Fetch user profile when token changes
  useEffect(() => {
    let active = true;

    // No token - clear user state
    if (!token) {
      startTransition(() => {
        setUser(null);
        setError("");
        setIsBootstrapping(false);
      });

      return () => {
        active = false;
      };
    }

    // Already have user - skip loading
    if (user) {
      setIsBootstrapping(false);
      return () => {
        active = false;
      };
    }

    setIsBootstrapping(true);

    // Fetch profile
    authApi
      .getProfile(token)
      .then((response: ApiEnvelope<UserProfile>) => {
        if (!active) {
          return;
        }

        startTransition(() => {
          setUser(response.data);
          setError("");
        });
      })
      .catch((reason) => {
        if (!active) {
          return;
        }

        // Clear token on auth failure
        clearToken();
        startTransition(() => {
          setUser(null);
          setError(getErrorMessage(reason));
        });
      })
      .finally(() => {
        if (active) {
          setIsBootstrapping(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token, user, clearToken]);

  /**
   * Register a new user
   */
  async function register(input: RegisterInput, options?: AuthOptions) {
    setError("");
    const response = await authApi.register(input);
    startTransition(() => {
      setToken(response.data.token, options?.remember ?? false);
      setUser(response.data.user);
    });
    return response.data.user;
  }

  /**
   * Login user
   */
  async function login(input: LoginInput, options?: AuthOptions) {
    setError("");
    const response = await authApi.login(input);
    startTransition(() => {
      setToken(response.data.token, options?.remember ?? false);
      setUser(response.data.user);
    });
    return response.data.user;
  }

  /**
   * Logout user
   */
  function logout() {
    clearToken();
    startTransition(() => {
      setUser(null);
      setError("");
    });
  }

  /**
   * Refresh user profile
   */
  async function refreshProfile() {
    if (!token) {
      throw new Error("Missing JWT token");
    }

    const response = await authApi.getProfile(token);
    startTransition(() => {
      setUser(response.data);
      setError("");
    });
    return response.data;
  }

  /**
   * Update user profile
   */
  async function updateProfile(input: UpdateProfileInput) {
    if (!token) {
      throw new Error("Missing JWT token");
    }

    const response = await authApi.updateProfile(token, input);
    startTransition(() => {
      setUser(response.data);
      setError("");
    });
    return response.data;
  }

  /**
   * Resend verification email
   */
  async function resendVerificationEmail() {
    if (!token) {
      throw new Error("Missing JWT token");
    }

    await authApi.resendVerificationEmail(token);
  }

  // Compute derived state
  const isAdmin = user?.role === "admin";
  const isStaff = user?.role === "staff";
  const canAccessAdmin = isAdmin || isStaff;

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: Boolean(token),
        isAdmin,
        isStaff,
        canAccessAdmin,
        isBootstrapping,
        error,
        register,
        login,
        logout,
        refreshProfile,
        updateProfile,
        resendVerificationEmail,
        clearError: () => setError(""),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
