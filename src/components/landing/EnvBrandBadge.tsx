import Image from "next/image";
import { cn } from "@/lib/utils";
import { isDynamicCatalogueImage, normalizeCatalogueImageSrc } from "@/lib/media-url";

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
  priority,
  sizes = "(max-width: 768px) 90vw, 320px",
}: EnvBrandBadgeProps) {
  const resolved = normalizeCatalogueImageSrc(src);
  const dynamic = isDynamicCatalogueImage(resolved);

  return (
    <div className={cn("relative overflow-hidden bg-neutral-100", className)}>
      {dynamic ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved}
          alt={alt}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]",
            imageClassName
          )}
        />
      ) : (
        <Image
          src={resolved}
          alt={alt}
          fill
          priority={priority}
          className={cn(
            "object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]",
            imageClassName
          )}
          sizes={sizes}
        />
      )}
    </div>
  );
}
