import { useState } from "react";
import { updateInfomaniakToken, verifyInfomaniakToken } from "../api/client.ts";
import { Header } from "../components/Header.tsx";
import { navigate } from "../hooks/useHash.ts";
import { useI18n } from "../i18n/useI18n.ts";

export function TokenView({ expired }: { expired?: boolean }) {
  const { t } = useI18n();
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    if (!token.trim()) return;
    setSaving(true);
    setError("");
    try {
      const valid = await verifyInfomaniakToken(token.trim());
      if (!valid) {
        throw new Error(t("login.tokenInvalid"));
      }
      await updateInfomaniakToken(token.trim());
      setSuccess(true);
      setTimeout(() => navigate("drives"), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header breadcrumbs={[
        { label: t("drives.breadcrumb"), hash: "drives" },
        { label: t("menu.token"), hash: "token" },
      ]} />
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-10 max-w-sm w-full text-center mx-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {t("token.title")}
          </h2>
          {expired && <p className="text-red-500 text-sm mb-3">{t("drives.tokenExpired")}</p>}
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {t("token.description")}{" "}
            <a
              href="https://manager.infomaniak.com/v3/ng/profile/user/token/list"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 dark:text-blue-400 underline"
            >
              {t("token.createLink")}
            </a>
            <br />
            <span className="text-xs text-gray-400 dark:text-gray-500">{t("login.tokenEncrypted")}</span>
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mb-4">
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

          <input
            type="password"
            placeholder={t("token.placeholder")}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg py-3 px-4 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          />

          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          {success && <p className="text-green-600 dark:text-green-400 text-sm mb-3">{t("token.success")}</p>}

          <button
            onClick={handleSave}
            disabled={saving || !token.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-6 rounded-lg transition-colors cursor-pointer"
          >
            {saving ? "..." : t("token.save")}
          </button>
        </div>
      </div>
    </>
  );
}
