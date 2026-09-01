"use client";

import Link from "next/link";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { WhatsAppOrderGate } from "@/components/public/WhatsAppOrderGate";
import type { TrackInquiryPayload } from "@/lib/inquiry-types";
import { cn } from "@/lib/utils";

interface TrackedWhatsAppButtonProps {
  href: string;
  inquiry: Omit<TrackInquiryPayload, "customerName" | "customerPhone">;
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

export function TrackedWhatsAppButton({
  href,
  inquiry,
  label = "ORDER ON WHATSAPP",
  className,
  size = "md",
  fullWidth = false,
}: TrackedWhatsAppButtonProps) {
  const sizeClasses = {
    sm: "px-3 py-2 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3.5 text-sm",
  };

  return (
    <WhatsAppOrderGate
      href={href}
      inquiry={inquiry}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full bg-[#128c47] font-semibold uppercase tracking-wider text-white transition-all hover:bg-[#0f7340] active:scale-[0.98]",
        sizeClasses[size],
        fullWidth && "w-full",
        className
      )}
    >
      <WhatsAppIcon className="h-4 w-4 shrink-0" />
      {label}
    </WhatsAppOrderGate>
  );
}

/** @deprecated Use TrackedWhatsAppButton for order tracking */
export function WhatsAppButtonLink({
  href,
  label,
  className,
  size,
  fullWidth,
}: {
  href: string;
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}) {
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
        sizeClasses[size ?? "md"],
        fullWidth && "w-full",
        className
      )}
      aria-label={`${label ?? "ORDER ON WHATSAPP"} via WhatsApp`}
    >
      <WhatsAppIcon className="h-4 w-4 shrink-0" />
      {label ?? "ORDER ON WHATSAPP"}
    </Link>
  );
}
