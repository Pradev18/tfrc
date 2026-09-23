export interface BreadcrumbItem {
  /** Plain label (category names, brands, etc.) */
  label?: string;
  /** i18n key — preferred for Home / Shop */
  labelKey?: string;
  href?: string;
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
