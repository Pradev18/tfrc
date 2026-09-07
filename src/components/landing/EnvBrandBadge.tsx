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

/** Catalogue / brand image that fills its card frame edge-to-edge. */
export function EnvBrandBadge({
  src,
  alt,
  className,
  imageClassName,
}: EnvBrandBadgeProps) {
  const resolved = normalizeCatalogueImageSrc(src);

  return (
    <div className={cn("relative overflow-hidden bg-neutral-200", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolved}
        alt={alt}
        className={cn(
          "absolute inset-0 h-full w-full max-w-none object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]",
          imageClassName
        )}
      />
    </div>
  );
}
