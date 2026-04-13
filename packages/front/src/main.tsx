import { createRoot } from "react-dom/client";
import "./style.css";
import { isLoggedIn, saveAccessToken, saveRefreshToken, setLocalMode, getRefreshToken } from "./auth/token-store.ts";
import { navigate } from "./hooks/useHash.ts";
import { App } from "./App.tsx";
import { API_BASE } from "./config.ts";

async function checkLocalSession(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/auth/local-session`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.enabled) return;
    setLocalMode(true);
    if (data.accessToken) {
      saveAccessToken(data.accessToken);
      const hash = window.location.hash;
      if (!hash || hash === "#" || hash === "#login" || hash === "#register") {
        navigate("drives");
      }
    } else {
      navigate("login");
    }
  } catch {
    // Backend not reachable, continue normally
  }
}

function renderApp(): void {
  if (!window.location.hash || window.location.hash === "#") {
    navigate(isLoggedIn() ? "drives" : "login");
  }
  createRoot(document.getElementById("app")!).render(<App />);
}

async function boot() {
  // Fast path: we already have a cached access token, render immediately.
  // Local-mode detection and JWT expiry are handled asynchronously — an expired
  // token is auto-refreshed by the 401 interceptor in apiFetch (api/client.ts).
  if (isLoggedIn()) {
    void checkLocalSession();
    renderApp();
    return;
  }

  // Slow path: no cached token — we must await auth checks before routing,
  // otherwise the user would flash to the login screen unnecessarily.
  await checkLocalSession();

  if (!isLoggedIn()) {
    try {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          saveAccessToken(data.accessToken);
          saveRefreshToken(data.refreshToken);
        }
      }
    } catch {
      // No valid refresh token, continue to login
    }
  }

  renderApp();
}

boot();
