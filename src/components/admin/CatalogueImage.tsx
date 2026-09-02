"use client";

import { normalizeCatalogueImageSrc } from "@/lib/media-url";

type CatalogueImageProps = {
  src: string;
  alt?: string;
  className?: string;
};

export { normalizeCatalogueImageSrc };

export function CatalogueImage({ src, alt = "", className }: CatalogueImageProps) {
  const resolved = normalizeCatalogueImageSrc(src);
  if (!resolved) return null;
  // Dynamic uploads/data URLs should bypass next/image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={resolved} alt={alt} className={className} />;
}
