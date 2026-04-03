import type { ApiEnvelope } from "../types/api";

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

export interface CreateRequestConfig {
  getBaseUrl: () => string;
  getCsrfToken?: () => string | null;
}

export function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

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

export function getBrowserCsrfToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const metaTag = document.querySelector(
    'meta[name="csrf-token"]'
  ) as HTMLMetaElement | null;
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

  return {
    message: parsed?.message || response.statusText || "Request failed",
    detail: parsed?.error || raw || "Unexpected response from server",
  };
}

export function createRequest(config: CreateRequestConfig) {
  return async function request<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<ApiEnvelope<T>> {
    const headers = new Headers({
      Accept: "application/json",
    });

    const csrfToken = config.getCsrfToken?.() ?? null;
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

    const response = await fetch(`${config.getBaseUrl()}${path}`, {
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
        throw createHttpError(
          500,
          "Invalid response",
          "Server returned invalid JSON"
        );
      }
    }

    if (!parsed?.success) {
      throw createHttpError(
        400,
        parsed?.message || "Request failed",
        parsed?.error || "Unknown error"
      );
    }

    return parsed;
  };
}

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
