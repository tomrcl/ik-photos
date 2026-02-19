const ACCESS_TOKEN_KEY = "ik_access_token";
const REFRESH_TOKEN_KEY = "ik_refresh_token";

let accessToken: string | null = null;
let _localMode = false;

export function setLocalMode(v: boolean): void {
  _localMode = v;
}

export function isLocalMode(): boolean {
  return _localMode;
}

export function saveAccessToken(token: string): void {
  accessToken = token;
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  return accessToken;
}

export function saveRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearTokens(): void {
  accessToken = null;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return getAccessToken() !== null;
}
