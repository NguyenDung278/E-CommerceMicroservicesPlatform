/**
 * HTTP Client Module
 * Provides a secure and robust HTTP client for API communication
 * with built-in error handling, request/response transformation,
 * and security best practices.
 */

import type { ApiEnvelope } from "../../types/api";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = configuredApiBaseUrl
  ? configuredApiBaseUrl.replace(/\/+$/, "")
  : "";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface HttpError extends Error {
  status: number;
  detail: string;
  code?: string;
}

/**
 * Check if a value is a plain object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Create a standardized HTTP error
 */
export function createHttpError(
  status: number,
  message: string,
  detail: string,
  code?: string
): HttpError {
  const error = new Error(message) as HttpError;
  error.status = status;
  error.detail = detail;
  error.code = code;
  return error;
}

/**
 * Parse error response from server
 */
function parseErrorResponse(
  response: Response,
  raw: string
): { message: string; detail: string } {
  let parsed: ApiEnvelope<unknown> | null = null;

  if (raw) {
    try {
      parsed = JSON.parse(raw) as ApiEnvelope<unknown>;
    } catch {
      parsed = null;
    }
  }

  const message = parsed?.message || response.statusText || "Request failed";
  const detail = parsed?.error || raw || "Unexpected response from server";

  return { message, detail };
}

/**
 * Main HTTP request function with security features
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiEnvelope<T>> {
  const headers = new Headers({
    Accept: "application/json",
  });

  // Security: Add CSRF token header if available
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const requestBody =
    options.body === undefined
      ? undefined
      : isFormData
        ? options.body as FormData
        : JSON.stringify(options.body);

  if (options.body !== undefined && !isFormData) {
    headers.set("Content-Type", "application/json");
  }

  // Security: Add authorization header
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  // Add custom headers
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    body: requestBody,
    headers,
    signal: options.signal,
    // Security: Explicitly set credentials mode
    credentials: "same-origin",
  });

  const raw = await response.text();

  // Handle error responses
  if (!response.ok) {
    const { message, detail } = parseErrorResponse(response, raw);
    throw createHttpError(response.status, message, detail);
  }

  // Parse successful response
  let parsed: ApiEnvelope<T> | null = null;

  if (raw) {
    try {
      parsed = JSON.parse(raw) as ApiEnvelope<T>;
    } catch {
      // Handle non-JSON responses
      throw createHttpError(
        500,
        "Invalid response",
        "Server returned invalid JSON"
      );
    }
  }

  // Check for API-level success flag
  if (!parsed?.success) {
    const message = parsed?.message || "Request failed";
    const detail = parsed?.error || "Unknown error";
    throw createHttpError(400, message, detail);
  }

  return parsed;
}

/**
 * Get CSRF token from meta tag or cookie
 */
function getCsrfToken(): string | null {
  // Try to get from meta tag
  const metaTag = document.querySelector(
    'meta[name="csrf-token"]'
  ) as HTMLMetaElement | null;
  if (metaTag?.content) {
    return metaTag.content;
  }

  // Try to get from cookie
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "csrf_token" || name === "XSRF-TOKEN") {
      return decodeURIComponent(value);
    }
  }

  return null;
}

/**
 * Abort controller factory for request cancellation
 */
export function createAbortController(timeoutMs?: number): {
  controller: AbortController;
  signal: AbortSignal;
} {
  const controller = new AbortController();

  if (timeoutMs) {
    setTimeout(() => controller.abort(), timeoutMs);
  }

  return {
    controller,
    signal: controller.signal,
  };
}

export default request;
