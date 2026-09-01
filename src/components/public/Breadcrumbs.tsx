import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-text-muted">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />}
            {item.href ? (
              <Link href={item.href} className="transition-colors hover:text-primary">
                {item.label}
              </Link>
            ) : (
              <span className="text-text" aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
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
      name: item.label,
      item: item.href ? `${siteUrl}${item.href}` : undefined,
    })),
  };
}
