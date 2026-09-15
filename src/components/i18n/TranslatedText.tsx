"use client";

import type { ElementType } from "react";
import { useT } from "@/context/LanguageContext";

/** Client-side translated text for use inside server-rendered pages. */
export function TranslatedText({
  k,
  vars,
  as: Tag = "span",
  className,
}: {
  k: string;
  vars?: Record<string, string | number>;
  as?: ElementType;
  className?: string;
}) {
  const t = useT();
  return <Tag className={className}>{t(k, vars)}</Tag>;
}
