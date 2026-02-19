import { API_BASE } from "../config.ts";
import { getAccessToken, saveAccessToken, clearTokens, getRefreshToken, saveRefreshToken } from "../auth/token-store.ts";
import { notifyAuthChange } from "../hooks/useAuth.ts";
import { translate } from "../i18n/i18n-store.ts";

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // Try refresh on 401
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = getAccessToken();
      headers.set("Authorization", `Bearer ${newToken}`);
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });
      // If still 401 after refresh (e.g. expired Infomaniak token), logout
      if (res.status === 401) {
        logout();
        throw new Error(translate("error.sessionExpired"));
      }
    } else if (getAccessToken()) {
      // Only logout if we haven't already been logged out by another request
      logout();
      throw new Error(translate("error.sessionExpired"));
    }
  }

  return res;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefresh();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function doRefresh(): Promise<boolean> {
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    saveAccessToken(data.accessToken);
    saveRefreshToken(data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function verifyInfomaniakToken(infomaniakToken: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/auth/verify-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ infomaniakToken }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.valid === true;
}

export async function updateInfomaniakToken(token: string): Promise<void> {
  const res = await apiFetch("/auth/token", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ infomaniakToken: token }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? translate("error.status", { status: res.status }));
  }
}

export function logout(): void {
  fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
  }).catch(() => {});
  clearTokens();
  notifyAuthChange();
  window.location.hash = "#login";
}
