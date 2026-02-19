import { translations, type Locale, type TKey, type TKeyOrPlural } from "./translations/index.ts";

const KEY = "ik_locale";
const LOCALES: Locale[] = ["fr", "en", "de", "es", "it"];

let listeners: Array<() => void> = [];

function emitChange() {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function detectBrowserLocale(): Locale {
  const lang = navigator.language.slice(0, 2);
  return LOCALES.includes(lang as Locale) ? (lang as Locale) : "en";
}

export function getLocale(): Locale {
  const stored = localStorage.getItem(KEY);
  if (stored && LOCALES.includes(stored as Locale)) return stored as Locale;
  return detectBrowserLocale();
}

export function setLocale(locale: Locale): void {
  localStorage.setItem(KEY, locale);
  document.documentElement.lang = locale;
  emitChange();
}

export function translate(key: TKeyOrPlural, params?: Record<string, string | number>): string {
  const dict = translations[getLocale()];

  let resolvedKey: string = key;
  if (params && "count" in params) {
    const suffix = params.count === 1 ? "_one" : "_other";
    const candidate = `${key}${suffix}`;
    if (candidate in dict) resolvedKey = candidate;
  }

  let text = dict[resolvedKey as TKey] ?? key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }

  return text;
}
