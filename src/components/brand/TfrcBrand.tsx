import { cn } from "@/lib/utils";
import { PLATFORM } from "@/lib/environments";

interface TfrcBrandProps {
  className?: string;
  textClassName?: string;
  iconClassName?: string;
  showText?: boolean;
  /** Show full “TFRC Wholesale Services” instead of short TFRC mark. */
  fullName?: boolean;
}

/** TFRC purple bars mark + wordmark */
export function TfrcBrand({
  className,
  textClassName,
  iconClassName,
  showText = true,
  fullName = false,
}: TfrcBrandProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={PLATFORM.logoUrl}
        alt=""
        className={cn("h-5 w-auto shrink-0 md:h-6", iconClassName)}
        aria-hidden
      />
      {showText && (
        <span
          className={cn(
            "text-lg font-semibold tracking-tight text-[#141414] md:text-xl",
            textClassName
          )}
        >
          {fullName ? PLATFORM.fullName : PLATFORM.name}
        </span>
      )}
    </span>
  );
}
