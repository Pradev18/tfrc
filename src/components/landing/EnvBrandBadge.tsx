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

/** Catalogue / brand image on a white card, covering the full frame. */
export function EnvBrandBadge({
  src,
  alt,
  className,
  imageClassName,
}: EnvBrandBadgeProps) {
  const resolved = normalizeCatalogueImageSrc(src);

  return (
    <div className={cn("relative overflow-hidden bg-white", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolved}
        alt={alt}
        className={cn(
          "absolute inset-0 h-full w-full max-w-none bg-white object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]",
          imageClassName
        )}
      />
    </div>
  );
}
