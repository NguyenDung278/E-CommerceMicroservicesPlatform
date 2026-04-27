import { request } from "./http";
import type { AuthPayload, UserProfile } from "../types/api";

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  email: string;
  phone?: string;
  password: string;
  first_name: string;
  last_name: string;
};

export async function login(body: LoginRequest): Promise<AuthPayload> {
  const response = await request<AuthPayload>("/api/v1/auth/login", {
    method: "POST",
    body,
  });
  return response.data;
}

export async function register(body: RegisterRequest): Promise<AuthPayload> {
  const response = await request<AuthPayload>("/api/v1/auth/register", {
    method: "POST",
    body,
  });
  return response.data;
}

export async function getProfile(token: string): Promise<UserProfile> {
  const response = await request<UserProfile>("/api/v1/users/profile", { token });
  return response.data;
}
