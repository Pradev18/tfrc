import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface WhatsAppButtonProps {
  href: string;
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

export function WhatsAppButton({
  href,
  label = "ORDER ON WHATSAPP",
  className,
  size = "md",
  fullWidth = false,
}: WhatsAppButtonProps) {
  const sizeClasses = {
    sm: "px-3 py-2 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3.5 text-sm",
  };

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full bg-[#128c47] font-semibold uppercase tracking-wider text-white transition-all hover:bg-[#0f7340] active:scale-[0.98]",
        sizeClasses[size],
        fullWidth && "w-full",
        className
      )}
      aria-label={`${label} via WhatsApp`}
    >
      <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}
