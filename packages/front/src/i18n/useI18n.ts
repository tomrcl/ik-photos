import { useSyncExternalStore, useCallback } from "react";
import {
  getLocale,
  setLocale as storeSetLocale,
  subscribe,
  translate,
} from "./i18n-store.ts";
import type { Locale, TKeyOrPlural } from "./translations";

type TFunction = (key: TKeyOrPlural, params?: Record<string, string | number>) => string;

export function useI18n(): { t: TFunction; locale: Locale; setLocale: (l: Locale) => void } {
  const locale = useSyncExternalStore(subscribe, getLocale);

  const setLocale = useCallback((next: Locale) => {
    storeSetLocale(next);
  }, []);

  return { t: translate, locale, setLocale };
}
