import { useState, useRef, useEffect } from "react";
import { logout, updateInfomaniakToken } from "../api/client.ts";
import { useTheme } from "../theme/useTheme.ts";
import type { ThemeChoice } from "../theme/theme-store.ts";
import { useI18n } from "../i18n/useI18n.ts";
import { localeOptions, type TKeyOrPlural } from "../i18n/translations/index.ts";

export interface Breadcrumb {
  label: string;
  hash: string;
}

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

const themeOptions: { value: ThemeChoice; key: TKeyOrPlural; icon: string }[] = [
  { value: "system", key: "theme.system", icon: "\u{1F5A5}\uFE0F" },
  { value: "light", key: "theme.light", icon: "\u2600\uFE0F" },
  { value: "dark", key: "theme.dark", icon: "\uD83C\uDF19" },
];

function TokenModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  async function handleSave() {
    if (!token.trim()) return;
    setSaving(true);
    setError("");
    try {
      await updateInfomaniakToken(token.trim());
      setSuccess(true);
      setTimeout(onClose, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={backdropRef}
      onClick={(e) => e.target === backdropRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          {t("token.title")}
        </h3>
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

        <input
          type="password"
          placeholder={t("token.placeholder")}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg py-2.5 px-3 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
        />

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        {success && <p className="text-green-600 dark:text-green-400 text-sm mb-3">{t("token.success")}</p>}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
          >
            {t("token.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !token.trim()}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg cursor-pointer"
          >
            {saving ? "..." : t("token.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Header({ breadcrumbs, menuItems }: { breadcrumbs: Breadcrumb[]; menuItems?: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [tokenModal, setTokenModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { choice, setChoice } = useTheme();
  const { t, locale, setLocale } = useI18n();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <>
      <nav className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.hash} className="flex items-center gap-2 min-w-0">
              {i > 0 && <span className="text-gray-400 dark:text-gray-500">/</span>}
              <a
                href={`#${crumb.hash}`}
                className={
                  i === breadcrumbs.length - 1
                    ? "font-semibold text-gray-900 dark:text-gray-100 truncate"
                    : "text-blue-600 dark:text-blue-400 hover:underline"
                }
              >
                {crumb.label}
              </a>
            </span>
          ))}
        </div>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            aria-label="Menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2 z-50">
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                {t("theme.title")}
              </div>
              {themeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setChoice(opt.value)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 cursor-pointer transition-colors ${
                    choice === opt.value
                      ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <span>{opt.icon}</span>
                  <span>{t(opt.key)}</span>
                </button>
              ))}

              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

              <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                {t("lang.title")}
              </div>
              {localeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLocale(opt.value)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 cursor-pointer transition-colors ${
                    locale === opt.value
                      ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <span>{opt.flag}</span>
                  <span>{opt.label}</span>
                </button>
              ))}

              {menuItems && menuItems.length > 0 && (
                <>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                  {menuItems.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => { setOpen(false); item.onClick(); }}
                      disabled={item.disabled}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </>
              )}

              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

              <button
                onClick={() => {
                  setOpen(false);
                  setTokenModal(true);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
                {t("menu.token")}
              </button>

              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

              <button
                onClick={() => logout()}
                className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3-3h-9m9 0l-3-3m3 3l-3 3" />
                </svg>
                {t("menu.logout")}
              </button>
            </div>
          )}
        </div>
      </nav>

      {tokenModal && <TokenModal onClose={() => setTokenModal(false)} />}
    </>
  );
}
