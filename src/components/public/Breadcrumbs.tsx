"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useT } from "@/context/LanguageContext";
import type { BreadcrumbItem } from "@/lib/breadcrumb-schema";

export type { BreadcrumbItem };

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const t = useT();

  return (
    <nav aria-label={t("store.breadcrumb")} className="mb-6">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-text-muted">
        {items.map((item, i) => {
          const text = item.labelKey ? t(item.labelKey) : item.label ?? "";
          return (
            <li key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />}
              {item.href ? (
                <Link href={item.href} className="transition-colors hover:text-primary">
                  {text}
                </Link>
              ) : (
                <span className="text-text" aria-current="page">
                  {text}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}