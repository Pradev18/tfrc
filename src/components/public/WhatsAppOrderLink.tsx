import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { cn } from "@/lib/utils";

interface WhatsAppOrderLinkProps {
  href: string;
  label?: string;
  className?: string;
  size?: "sm" | "md";
  fullWidth?: boolean;
}

/** Consistent WhatsApp CTA with official logo — used on all product cards */
export function WhatsAppOrderLink({
  href,
  label = "Order on WhatsApp",
  className,
  size = "sm",
  fullWidth = false,
}: WhatsAppOrderLinkProps) {
  const sizeClasses = {
    sm: "gap-1.5 py-2 text-[11px] md:text-xs",
    md: "gap-2 py-2.5 text-sm",
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "glass-btn inline-flex items-center justify-center rounded-full bg-[#128c47] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#0f7340] hover:shadow-[0_6px_20px_rgba(18,140,71,0.35)]",
        sizeClasses[size],
        fullWidth ? "w-full px-4" : "px-4",
        className
      )}
      aria-label={`${label} via WhatsApp`}
    >
      <WhatsAppIcon className={cn("shrink-0", size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />
      {label}
    </a>
  );
}
