import { apiBaseUrl } from "./config";
import type { ApiEnvelope } from "../types/api";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, message: string, detail: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function getRequestBody(body: unknown): BodyInit | undefined {
  if (body === undefined) {
    return undefined;
  }

  if (body instanceof FormData) {
    return body;
  }

  return JSON.stringify(body);
}

function parseError(status: number, statusText: string, raw: string): ApiError {
  if (!raw) {
    return new ApiError(status, statusText || "Request failed", "Unexpected empty response");
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ApiEnvelope<unknown>>;
    return new ApiError(
      status,
      parsed.message || statusText || "Request failed",
      typeof parsed.error === "string" ? parsed.error : raw,
    );
  } catch {
    return new ApiError(status, statusText || "Request failed", raw);
  }
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const headers = new Headers({ Accept: "application/json" });
  const body = getRequestBody(options.body);

  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  Object.entries(options.headers ?? {}).forEach(([key, value]) => {
    headers.set(key, value);
  });

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    body,
    headers,
    signal: options.signal,
  });

  const raw = await response.text();

  if (!response.ok) {
    throw parseError(response.status, response.statusText, raw);
  }

  if (!raw) {
    throw new ApiError(500, "Invalid response", "Server returned an empty response");
  }

  const parsed = JSON.parse(raw) as ApiEnvelope<T>;

  if (!parsed.success) {
    throw new ApiError(400, parsed.message || "Request failed", parsed.error || "Unknown error");
  }

  return parsed;
}
