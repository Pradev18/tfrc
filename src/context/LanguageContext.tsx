"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { translate } from "@/lib/i18n";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_STORAGE_KEY,
  type Locale,
} from "@/lib/i18n/types";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  isArabic: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // ignore
  }
  return DEFAULT_LOCALE;
}

function applyDocumentLang(locale: Locale) {
  if (typeof document === "undefined") return;
  // Keep LTR layout positions; only change language metadata + font shaping.
  document.documentElement.lang = locale === "ar-QA" ? "ar-QA" : "en";
  document.documentElement.dir = "ltr";
  document.documentElement.dataset.locale = locale;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const next = readStoredLocale();
    setLocaleState(next);
    applyDocumentLang(next);
    setReady(true);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    applyDocumentLang(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      isArabic: locale === "ar-QA",
    }),
    [locale, setLocale, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      <div
        className={ready && locale === "ar-QA" ? "tfrc-locale-ar" : "tfrc-locale-en"}
        lang={locale === "ar-QA" ? "ar-QA" : "en"}
        dir="ltr"
      >
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => undefined,
      t: (key: string, vars?: Record<string, string | number>) =>
        translate(DEFAULT_LOCALE, key, vars),
      isArabic: false,
    } satisfies LanguageContextValue;
  }
  return ctx;
}

export function useT() {
  return useLanguage().t;
}
