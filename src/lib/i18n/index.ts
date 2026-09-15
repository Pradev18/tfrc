import { arQA } from "@/lib/i18n/dictionaries/ar-QA";
import { en, type Dictionary } from "@/lib/i18n/dictionaries/en";
import type { Locale } from "@/lib/i18n/types";

const dictionaries: Record<Locale, Dictionary> = {
  en,
  "ar-QA": arQA,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? en;
}

type NestedValue = string | { [key: string]: NestedValue };

function lookup(dict: Dictionary, path: string): string | undefined {
  const parts = path.split(".");
  let current: NestedValue = dict as unknown as NestedValue;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>
): string {
  const raw = lookup(getDictionary(locale), key) ?? lookup(en, key) ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    raw
  );
}
