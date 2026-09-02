/** Normalize catalogue/media URLs for display across admin + storefront. */
export function normalizeCatalogueImageSrc(src: string | null | undefined): string {
  if (!src) return "";
  const value = src.trim();
  if (!value) return "";
  if (value.startsWith("data:")) return value;
  if (value.startsWith("/uploads/")) {
    return `/api/media/${encodeURIComponent(value.slice("/uploads/".length))}`;
  }
  return value;
}

export function isDynamicCatalogueImage(src: string): boolean {
  return (
    src.startsWith("data:") ||
    src.startsWith("/api/media/") ||
    src.startsWith("/uploads/")
  );
}
