import { useState } from "react";
import { API_BASE } from "../config.ts";
import { saveAccessToken, isLocalMode } from "../auth/token-store.ts";
import { navigate } from "../hooks/useHash.ts";
import { notifyAuthChange } from "../hooks/useAuth.ts";
import { useI18n } from "../i18n/useI18n.ts";
import { localeOptions } from "../i18n/translations/index.ts";
import { useTheme } from "../theme/useTheme.ts";
import type { ThemeChoice } from "../theme/theme-store.ts";
import { updateInfomaniakToken, verifyInfomaniakToken } from "../api/client.ts";

const themeOptions: { value: ThemeChoice; icon: string }[] = [
  { value: "system", icon: "\u{1F5A5}\uFE0F" },
  { value: "light", icon: "\u2600\uFE0F" },
  { value: "dark", icon: "\uD83C\uDF19" },
];

export function LoginView({ mode }: { mode: "login" | "register" }) {
  const { t, locale, setLocale } = useI18n();
  const { choice, setChoice } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [infomaniakToken, setInfomaniakToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const localMode = isLocalMode();

  async function submit() {
    setError("");
    setLoading(true);

    try {
      // Verify Infomaniak token (required for local mode + register)
      if (localMode || mode === "register") {
        if (!infomaniakToken.trim()) {
          throw new Error(t("login.tokenRequired"));
        }
        const valid = await verifyInfomaniakToken(infomaniakToken);
        if (!valid) {
          throw new Error(t("login.tokenInvalid"));
        }
      }

      if (localMode) {
        saveAccessToken("local-mode");
        notifyAuthChange();
        await updateInfomaniakToken(infomaniakToken);
        navigate("drives");
        return;
      }

      const endpoint = mode === "register" ? "/auth/register" : "/auth/login";
      const body: Record<string, string> = { email, password };
      if (mode === "register") {
        body.infomaniakToken = infomaniakToken;
      }

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? t("error.status", { status: res.status }));
      }

      const data = await res.json();
      saveAccessToken(data.accessToken);
      notifyAuthChange();
      navigate("drives");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-10 max-w-sm w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t("login.title")}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          {localMode ? t("login.localSubtitle") : t("login.subtitle")}
        </p>

        {!localMode && (
          <>
            <input
              type="email"
              placeholder={t("login.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg py-3 px-4 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />

            <input
              type="password"
              placeholder={t("login.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg py-3 px-4 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </>
        )}

        {(localMode || mode === "register") && (
          <input
            type="password"
            placeholder={t("login.infomaniakToken")}
            value={infomaniakToken}
            onChange={(e) => setInfomaniakToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg py-3 px-4 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          />
        )}

        <button
          onClick={submit}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-6 rounded-lg transition-colors cursor-pointer"
        >
          {loading ? "..." : localMode ? t("login.submit.login") : mode === "login" ? t("login.submit.login") : t("login.submit.register")}
        </button>

        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

        {(localMode || mode === "register") && (
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-4">
            {t("login.tokenHelp.before")}{" "}
            <a
              href="https://manager.infomaniak.com/v3/ng/profile/user/token/list"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              manager.infomaniak.com
            </a>{" "}
            {t("login.tokenHelp.after")} <strong>drive</strong>
          </p>
        )}

        {!localMode && mode === "register" && (
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">
            {t("login.tokenEncrypted")}
          </p>
        )}

        {!localMode && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            {mode === "login" ? (
              <button onClick={() => navigate("register")} className="hover:underline cursor-pointer">
                {t("login.switchToRegister")}
              </button>
            ) : (
              <button onClick={() => navigate("login")} className="hover:underline cursor-pointer">
                {t("login.switchToLogin")}
              </button>
            )}
          </p>
        )}

        {/* GitHub link */}
        <a
          href="https://github.com/tomrcl/ik-photos"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 mt-6 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          github.com/tomrcl/ik-photos
        </a>

        {/* Theme & language selectors */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-col items-center gap-3">
          <div className="flex gap-1">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setChoice(opt.value)}
                className={`w-8 h-8 flex items-center justify-center rounded-md text-sm cursor-pointer transition-colors ${
                  choice === opt.value
                    ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
                title={opt.value}
              >
                {opt.icon}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {localeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLocale(opt.value)}
                className={`w-8 h-8 flex items-center justify-center rounded-md text-sm cursor-pointer transition-colors ${
                  locale === opt.value
                    ? "bg-blue-100 dark:bg-blue-900/40"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
                title={opt.label}
              >
                {opt.flag}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
