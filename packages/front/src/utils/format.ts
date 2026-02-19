import { getLocale } from "../i18n/i18n-store.ts";
import { translations, bcp47 } from "../i18n/translations/index.ts";

export function formatSize(bytes: number): string {
  const locale = getLocale();
  const units = translations[locale]["format.sizeUnits"].split(",");
  if (bytes === 0) return `0 ${units[0]}`;
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(isoOrTimestamp: string | number): string {
  const locale = getLocale();
  const date =
    typeof isoOrTimestamp === "string"
      ? new Date(isoOrTimestamp)
      : new Date(isoOrTimestamp * 1000);
  return date.toLocaleDateString(bcp47[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
