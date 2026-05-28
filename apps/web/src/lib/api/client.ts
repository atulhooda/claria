import { clientEnv, getServerEnv } from "@/lib/env";
import { ApiError, type ApiErrorBody } from "@/lib/api/errors";
import { getClientToken } from "@/lib/api/auth";

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

export interface RequestOptions extends Omit<RequestInit, "body" | "method"> {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: Json;
  searchParams?: Record<string, string | number | boolean | undefined>;
  requestId?: string;
  signal?: AbortSignal;
  /** Bearer token override. RSC callers pass `await getServerAuthToken()`. */
  token?: string | null;
  /** Skip auth entirely (public endpoints like /health). */
  unauthenticated?: boolean;
}

function resolveBaseUrl(): string {
  if (typeof window === "undefined") {
    return getServerEnv().API_BASE_URL_INTERNAL ?? clientEnv.NEXT_PUBLIC_API_BASE_URL;
  }
  return clientEnv.NEXT_PUBLIC_API_BASE_URL;
}

function buildUrl(path: string, searchParams?: RequestOptions["searchParams"]): string {
  const base = resolveBaseUrl().replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${normalized}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function parseError(response: Response): Promise<ApiError> {
  let code = "http_error";
  let message = response.statusText || `HTTP ${response.status}`;
  let requestId = response.headers.get("x-request-id");
  try {
    const data = (await response.json()) as ApiErrorBody;
    if (data?.error) {
      code = data.error.code ?? code;
      message = data.error.message ?? message;
      requestId = data.error.requestId ?? requestId;
    }
  } catch {
    // Non-JSON error body — fall back to status text.
  }
  return new ApiError({ status: response.status, code, message, requestId });
}

async function resolveAuthHeader(opts: RequestOptions): Promise<string | null> {
  if (opts.unauthenticated) return null;
  if (opts.token !== undefined) {
    return opts.token ? `Bearer ${opts.token}` : null;
  }
  const token = await getClientToken();
  return token ? `Bearer ${token}` : null;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    body,
    headers,
    searchParams,
    requestId = newRequestId(),
    signal,
    token: _token,
    unauthenticated: _unauthenticated,
    ...rest
  } = options;

  const authHeader = await resolveAuthHeader(options);
  const url = buildUrl(path, searchParams);
  const init: RequestInit = {
    method,
    headers: {
      Accept: "application/json",
      "x-request-id": requestId,
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
    cache: "no-store",
    ...rest,
  };

  const response = await fetch(url, init);

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: Json, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: Json, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: Json, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};
