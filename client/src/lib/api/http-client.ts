import {
  createHttpError,
  createRequest,
  getBrowserCsrfToken,
  stripTrailingSlash,
  type HttpError,
  type HttpMethod,
  type RequestOptions,
} from "../../../../shared/web-sdk/http-core";

const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

export const API_BASE_URL = configuredApiBaseUrl
  ? stripTrailingSlash(configuredApiBaseUrl)
  : "";

export type { HttpError, HttpMethod, RequestOptions };
export { createHttpError };

export const request = createRequest({
  getBaseUrl: () => API_BASE_URL,
  getCsrfToken: getBrowserCsrfToken,
});
