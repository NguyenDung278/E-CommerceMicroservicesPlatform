import { createContext, startTransition, useEffect, useState, type ReactNode } from "react";

import { useSessionToken } from "../hooks/useSessionToken";
import { api, getErrorMessage } from "../lib/api";
import type { UserProfile } from "../types/api";

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

type AuthContextValue = {
  token: string;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isBootstrapping: boolean;
  error: string;
  register: (input: RegisterInput, options?: AuthOptions) => Promise<UserProfile>;
  login: (input: LoginInput, options?: AuthOptions) => Promise<UserProfile>;
  logout: () => void;
  refreshProfile: () => Promise<UserProfile>;
  updateProfile: (input: UpdateProfileInput) => Promise<UserProfile>;
  clearError: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { token, setToken, clearToken } = useSessionToken();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(Boolean(token));

  useEffect(() => {
    let active = true;

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

    if (user) {
      setIsBootstrapping(false);
      return () => {
        active = false;
      };
    }

    setIsBootstrapping(true);

    void api
      .getProfile(token)
      .then((response) => {
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
  }, [token, user]);

  async function register(input: RegisterInput, options?: AuthOptions) {
    setError("");
    const response = await api.register(input);
    startTransition(() => {
      setToken(response.data.token, options?.remember ?? false);
      setUser(response.data.user);
    });
    return response.data.user;
  }

  async function login(input: LoginInput, options?: AuthOptions) {
    setError("");
    const response = await api.login(input);
    startTransition(() => {
      setToken(response.data.token, options?.remember ?? false);
      setUser(response.data.user);
    });
    return response.data.user;
  }

  function logout() {
    clearToken();
    startTransition(() => {
      setUser(null);
      setError("");
    });
  }

  async function refreshProfile() {
    if (!token) {
      throw new Error("Missing JWT token");
    }

    const response = await api.getProfile(token);
    startTransition(() => {
      setUser(response.data);
      setError("");
    });
    return response.data;
  }

  async function updateProfile(input: UpdateProfileInput) {
    if (!token) {
      throw new Error("Missing JWT token");
    }

    const response = await api.updateProfile(token, input);
    startTransition(() => {
      setUser(response.data);
      setError("");
    });
    return response.data;
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: Boolean(token),
        isAdmin: user?.role === "admin",
        isBootstrapping,
        error,
        register,
        login,
        logout,
        refreshProfile,
        updateProfile,
        clearError: () => setError("")
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
