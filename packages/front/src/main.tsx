import { createRoot } from "react-dom/client";
import "./style.css";
import { isLoggedIn, saveAccessToken, saveRefreshToken, setLocalMode, getRefreshToken } from "./auth/token-store.ts";
import { navigate } from "./hooks/useHash.ts";
import { App } from "./App.tsx";
import { API_BASE } from "./config.ts";

async function boot() {
  // Check local mode on every boot
  try {
    const res = await fetch(`${API_BASE}/auth/local-session`);
    if (res.ok) {
      const data = await res.json();
      if (data.enabled) {
        setLocalMode(true);
        if (data.accessToken) {
          saveAccessToken(data.accessToken);
          if (!window.location.hash || window.location.hash === "#" || window.location.hash === "#login" || window.location.hash === "#register") {
            navigate("drives");
          }
        } else {
          // No token yet — show the token input mire
          navigate("login");
        }
      }
    }
  } catch {
    // Backend not reachable, continue normally
  }

  // If not logged in, try to recover session via refresh token
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

  if (!window.location.hash || window.location.hash === "#") {
    navigate(isLoggedIn() ? "drives" : "login");
  }

  createRoot(document.getElementById("app")!).render(<App />);
}

boot();
