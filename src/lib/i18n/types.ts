export type Locale = "en" | "ar-QA";

export const LOCALES: Locale[] = ["en", "ar-QA"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "tfrc-locale";

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "ar-QA";
}
