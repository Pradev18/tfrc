"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useT } from "@/context/LanguageContext";

export interface BreadcrumbItem {
  /** Plain label (category names, brands, etc.) */
  label?: string;
  /** i18n key — preferred for Home / Shop */
  labelKey?: string;
  href?: string;
}

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

export function breadcrumbSchema(items: BreadcrumbItem[], siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label ?? item.labelKey ?? "",
      item: item.href ? `${siteUrl}${item.href}` : undefined,
    })),
  };
}
