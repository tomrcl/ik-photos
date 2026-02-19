import fr from "./fr.ts";
import en from "./en.ts";
import de from "./de.ts";
import es from "./es.ts";
import it from "./it.ts";

export type Locale = "fr" | "en" | "de" | "es" | "it";

export type TranslationKeys = typeof fr;
export type TKey = keyof TranslationKeys & string;

// Derive plural base keys (e.g. "selection.count" from "selection.count_one")
type PluralBase = {
  [K in TKey]: K extends `${infer B}_one` ? B : never;
}[TKey];

export type TKeyOrPlural = TKey | PluralBase;

export const translations: Record<Locale, Record<TKey, string>> = {
  fr,
  en,
  de,
  es,
  it,
};

export const bcp47: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-US",
  de: "de-DE",
  es: "es-ES",
  it: "it-IT",
};

export const localeOptions: { value: Locale; label: string; flag: string }[] = [
  { value: "fr", label: "Français", flag: "\u{1F1EB}\u{1F1F7}" },
  { value: "en", label: "English", flag: "\u{1F1EC}\u{1F1E7}" },
  { value: "de", label: "Deutsch", flag: "\u{1F1E9}\u{1F1EA}" },
  { value: "es", label: "Español", flag: "\u{1F1EA}\u{1F1F8}" },
  { value: "it", label: "Italiano", flag: "\u{1F1EE}\u{1F1F9}" },
];
