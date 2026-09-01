import { cn } from "@/lib/utils";

interface TfrcBrandProps {
  className?: string;
  textClassName?: string;
  iconClassName?: string;
  showText?: boolean;
}

/** TFRC purple bars mark + wordmark */
export function TfrcBrand({
  className,
  textClassName,
  iconClassName,
  showText = true,
}: TfrcBrandProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 36 24"
        fill="none"
        className={cn("h-5 w-auto shrink-0 md:h-6", iconClassName)}
        aria-hidden
      >
        <rect x="0" y="0" width="8" height="24" rx="1" fill="#7B2D8E" />
        <rect x="14" y="0" width="8" height="24" rx="1" fill="#7B2D8E" />
        <rect x="28" y="0" width="8" height="24" rx="1" fill="#7B2D8E" />
      </svg>
      {showText && (
        <span
          className={cn(
            "font-display text-[1.65rem] font-medium tracking-tight text-[#141414] md:text-[1.75rem]",
            textClassName
          )}
        >
          TFRC
        </span>
      )}
    </span>
  );
}
