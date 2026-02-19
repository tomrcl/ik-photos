const ACCESS_TOKEN_KEY = "ik_access_token";

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
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  return accessToken;
}

export function clearTokens(): void {
  accessToken = null;
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return getAccessToken() !== null;
}
