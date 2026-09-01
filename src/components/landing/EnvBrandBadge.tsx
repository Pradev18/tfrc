import Image from "next/image";
import { cn } from "@/lib/utils";

interface EnvBrandBadgeProps {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  sizes?: string;
}

/** Circular TFRC brand badge on premium dark backdrop */
export function EnvBrandBadge({
  src,
  alt,
  className,
  imageClassName,
  priority,
  sizes = "(max-width: 768px) 90vw, 320px",
}: EnvBrandBadgeProps) {
  return (
    <div
      className={cn(
        "env-brand-badge relative flex items-center justify-center overflow-hidden",
        className
      )}
    >
      <div className="env-brand-badge-glow pointer-events-none absolute inset-0" aria-hidden />
      <Image
        src={src}
        alt={alt}
        width={640}
        height={640}
        priority={priority}
        className={cn(
          "relative z-10 h-auto w-[78%] max-w-[280px] object-contain drop-shadow-2xl transition-transform duration-500 ease-out group-hover:scale-[1.03]",
          imageClassName
        )}
        sizes={sizes}
      />
    </div>
  );
}
