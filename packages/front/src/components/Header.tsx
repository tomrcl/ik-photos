import { useState, useRef, useEffect } from "react";
import { logout } from "../api/client.ts";
import { useTheme } from "../theme/useTheme.ts";
import type { ThemeChoice } from "../theme/theme-store.ts";
import { useI18n } from "../i18n/useI18n.ts";
import { localeOptions, type TKeyOrPlural } from "../i18n/translations/index.ts";
import { navigate } from "../hooks/useHash.ts";

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

export function Header({ breadcrumbs, menuItems }: { breadcrumbs: Breadcrumb[]; menuItems?: MenuItem[] }) {
  const [open, setOpen] = useState(false);
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
                  navigate("token");
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

    </>
  );
}
