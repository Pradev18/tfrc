import Link from "next/link";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { cn } from "@/lib/utils";

interface WhatsAppButtonProps {
  href: string;
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  /** Icon-only control for tight headers / mobile toolbars */
  iconOnly?: boolean;
}

export function WhatsAppButton({
  href,
  label = "ORDER ON WHATSAPP",
  className,
  size = "md",
  fullWidth = false,
  iconOnly = false,
}: WhatsAppButtonProps) {
  const sizeClasses = {
    sm: "px-3 py-2 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3.5 text-sm",
  };

  if (iconOnly) {
    return (
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#128c47] text-white transition-colors hover:bg-[#0f7340] active:scale-[0.98]",
          className
        )}
        aria-label={`${label} via WhatsApp`}
      >
        <WhatsAppIcon className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#128c47] font-semibold uppercase tracking-wider text-white transition-all hover:bg-[#0f7340] active:scale-[0.98]",
        sizeClasses[size],
        fullWidth && "w-full",
        className
      )}
      aria-label={`${label} via WhatsApp`}
    >
      <WhatsAppIcon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
