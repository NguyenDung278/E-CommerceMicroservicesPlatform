import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  exchangeOAuthTicket,
  getProfile,
  login as loginRequest,
  register as registerRequest,
  type RegisterRequest,
} from "../services/auth-service";
import type { UserProfile } from "../types/api";

type AuthContextValue = {
  token: string | null;
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (body: RegisterRequest) => Promise<void>;
  completeOAuthLogin: (ticket: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => void;
};

const storageKey = "ndshop_access_token";
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(storageKey));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(Boolean(token));

  const refreshProfile = useCallback(async () => {
    if (!token) {
      setUser(null);
      return;
    }

    const profile = await getProfile(token);
    setUser(profile);
  }, [token]);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const profile = await getProfile(token);
        if (active) {
          setUser(profile);
        }
      } catch {
        localStorage.removeItem(storageKey);
        if (active) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const payload = await loginRequest({ email, password });
    localStorage.setItem(storageKey, payload.token);
    setToken(payload.token);
    setUser(payload.user);
  }, []);

  const register = useCallback(async (body: RegisterRequest) => {
    const payload = await registerRequest(body);
    localStorage.setItem(storageKey, payload.token);
    setToken(payload.token);
    setUser(payload.user);
  }, []);

  const completeOAuthLogin = useCallback(async (ticket: string) => {
    const payload = await exchangeOAuthTicket({ ticket });
    localStorage.setItem(storageKey, payload.token);
    setToken(payload.token);
    setUser(payload.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(storageKey);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        login,
        register,
        completeOAuthLogin,
        refreshProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
