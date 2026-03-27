import type { ApiEnvelope } from "@/types/api";

const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

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

function createHttpError(
  status: number,
  message: string,
  detail: string,
  code?: string,
): HttpError {
  const error = new Error(message) as HttpError;
  error.status = status;
  error.detail = detail;
  error.code = code;
  return error;
}

function parseErrorResponse(response: Response, raw: string) {
  let parsed: ApiEnvelope<unknown> | null = null;

  if (raw) {
    try {
      parsed = JSON.parse(raw) as ApiEnvelope<unknown>;
    } catch {
      parsed = null;
    }
  }

  return {
    message: parsed?.message || response.statusText || "Request failed",
    detail: parsed?.error || raw || "Unexpected response from server",
  };
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const headers = new Headers({
    Accept: "application/json",
  });

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
        ? (options.body as FormData)
        : JSON.stringify(options.body);

  if (options.body !== undefined && !isFormData) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

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
    credentials: "same-origin",
  });

  const raw = await response.text();

  if (!response.ok) {
    const { message, detail } = parseErrorResponse(response, raw);
    throw createHttpError(response.status, message, detail);
  }

  let parsed: ApiEnvelope<T> | null = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw) as ApiEnvelope<T>;
    } catch {
      throw createHttpError(500, "Invalid response", "Server returned invalid JSON");
    }
  }

  if (!parsed?.success) {
    throw createHttpError(400, parsed?.message || "Request failed", parsed?.error || "Unknown error");
  }

  return parsed;
}

function getCsrfToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
  if (metaTag?.content) {
    return metaTag.content;
  }

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "csrf_token" || name === "XSRF-TOKEN") {
      return decodeURIComponent(value);
    }
  }

  return null;
}

