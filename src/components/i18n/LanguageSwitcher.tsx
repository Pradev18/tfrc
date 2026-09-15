"use client";

import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  className?: string;
  compact?: boolean;
}

/** In-place EN ↔ Qatari Arabic toggle. Does not flip the page layout. */
export function LanguageSwitcher({ className, compact = false }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useLanguage();
  const next = locale === "en" ? "ar-QA" : "en";
  const label = locale === "en" ? "العربية" : "English";

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/90 font-semibold text-[#141414] transition-colors hover:bg-white",
        compact ? "h-9 min-w-9 px-2 text-[11px]" : "h-9 px-3 text-xs",
        className
      )}
      aria-label={`${t("switchLabel")}: ${label}`}
      title={label}
    >
      {compact ? (locale === "en" ? "ع" : "EN") : label}
    </button>
  );
}
