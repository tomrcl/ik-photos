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

        {/* Theme & language selectors */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-col items-center gap-3">
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
