// Orvalの標準の機能ではBaseURLを動的に変更できないため、fetchのラッパーを作成
// 参考: https://github.com/orval-labs/orval/blob/master/samples/next-app-with-fetch/custom-fetch.ts

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

// URL prefix for deployments with a stage prefix (e.g., /prod)
const urlPrefix = import.meta.env.VITE_URL_PREFIX || "";

// NOTE: Supports cases where `content-type` is other than `json`
const getBody = <T>(c: Response | Request): Promise<T> => {
  const contentType = c.headers.get("content-type");

  if (contentType && contentType.includes("application/json")) {
    return c.json();
  }

  if (contentType && contentType.includes("application/pdf")) {
    return c.blob() as Promise<T>;
  }

  return c.text() as Promise<T>;
};

// NOTE: Update just base url
const getUrl = (contextUrl: string): string => {
  // Use relative URLs when served from same origin (no VITE_BASE_URL set)
  // This avoids CORS issues when UI is served from Django
  const baseUrl = import.meta.env.VITE_BASE_URL;

  if (!baseUrl) {
    // No base URL - use relative path (same origin)
    // Include URL prefix for deployments with stage prefix (e.g., /prod)
    const url = new URL(contextUrl, "http://placeholder");
    return `${urlPrefix}${url.pathname}${url.search}`;
  }

  // Base URL specified - use absolute URL (for development with separate servers)
  const cleanBaseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
  const url = new URL(contextUrl, cleanBaseUrl);
  const requestUrl = new URL(`${cleanBaseUrl}${url.pathname}${url.search}`);

  return requestUrl.toString();
};

// NOTE: Add headers
const getHeaders = (headers?: HeadersInit, token?: string): HeadersInit => {
  const authToken =
    token || (typeof window !== "undefined" ? localStorage.getItem("authToken") : null);
  const defaultHeaders: HeadersInit = authToken ? { Authorization: `Bearer ${authToken}` } : {};

  return {
    ...defaultHeaders,
    ...headers,
  };
};

// Redirect to login page
const redirectToLogin = () => {
  if (typeof window !== "undefined") {
    // Clear auth data
    localStorage.removeItem("authToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("username");
    // Set flag to show message on login page
    localStorage.setItem("authExpired", "true");
    // Redirect to login
    window.location.href = "/login";
  }
};

// Attempt to refresh the token
const refreshToken = async (): Promise<string | null> => {
  const refreshTokenValue =
    typeof window !== "undefined" ? localStorage.getItem("refreshToken") : null;

  if (!refreshTokenValue) {
    return null;
  }

  try {
    // Use relative URL when no base URL specified (same origin)
    // Include URL prefix for deployments with stage prefix (e.g., /prod)
    const baseUrl = import.meta.env.VITE_BASE_URL;
    const refreshUrl = baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/api/token/refresh/`
      : `${urlPrefix}/api/token/refresh/`;
    const response = await fetch(refreshUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshTokenValue }),
      credentials: "include",
    });

    if (response.ok) {
      const data = await response.json();
      const newAccessToken = data.access;

      if (newAccessToken && typeof window !== "undefined") {
        localStorage.setItem("authToken", newAccessToken);
        return newAccessToken;
      }
    }

    // Refresh failed
    return null;
  } catch {
    return null;
  }
};

// Get or wait for refreshed token
const getRefreshedToken = async (): Promise<string | null> => {
  if (isRefreshing && refreshPromise) {
    // Wait for the existing refresh attempt
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = refreshToken();

  try {
    const result = await refreshPromise;
    return result;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
};

export const customFetch = async <T>(url: string, options: RequestInit): Promise<T> => {
  const requestUrl = getUrl(url);
  const requestHeaders = getHeaders(options.headers);

  const requestInit: RequestInit = {
    ...options,
    headers: requestHeaders,
    credentials: "include", // Include cookies for Django session auth
  };

  const response = await fetch(requestUrl, requestInit);

  // Handle 401 Unauthorized or 403 Forbidden - attempt token refresh
  if (response.status === 401 || response.status === 403) {
    // Don't try to refresh for token endpoints to avoid infinite loop
    if (url.includes("/api/token/")) {
      const data = await getBody<T>(response);
      return { status: response.status, data, headers: response.headers } as T;
    }

    const newToken = await getRefreshedToken();

    if (newToken) {
      // Retry the request with the new token
      const retryHeaders = getHeaders(options.headers, newToken);
      const retryInit: RequestInit = {
        ...options,
        headers: retryHeaders,
        credentials: "include", // Include cookies for session auth
      };

      const retryResponse = await fetch(requestUrl, retryInit);
      const retryData = await getBody<T>(retryResponse);

      // If still unauthorized after refresh, redirect to login
      if (retryResponse.status === 401 || retryResponse.status === 403) {
        redirectToLogin();
      }

      return { status: retryResponse.status, data: retryData, headers: retryResponse.headers } as T;
    }

    // Refresh failed - redirect to login
    redirectToLogin();
  }

  const data = await getBody<T>(response);

  return { status: response.status, data, headers: response.headers } as T;
};
