"use client";

import { useContext } from "react";

import {
  AuthActionsContext,
  AuthContext,
  AuthStateContext,
} from "@/providers/auth-provider";

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

export function useAuthState() {
  const context = useContext(AuthStateContext);

  if (!context) {
    throw new Error("useAuthState must be used within AuthProvider");
  }

  return context;
}

export function useAuthActions() {
  const context = useContext(AuthActionsContext);

  if (!context) {
    throw new Error("useAuthActions must be used within AuthProvider");
  }

  return context;
}
