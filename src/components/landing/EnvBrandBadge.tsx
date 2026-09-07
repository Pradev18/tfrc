import { cn } from "@/lib/utils";
import { normalizeCatalogueImageSrc } from "@/lib/media-url";

interface EnvBrandBadgeProps {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  sizes?: string;
}

/** Bare catalogue logo — no card chrome; full logo visible (object-contain). */
export function EnvBrandBadge({
  src,
  alt,
  className,
  imageClassName,
}: EnvBrandBadgeProps) {
  const resolved = normalizeCatalogueImageSrc(src);

  return (
    <div className={cn("catalogue-logo relative", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolved}
        alt={alt}
        className={cn("catalogue-logo__img h-full w-full", imageClassName)}
      />
    </div>
  );
}
