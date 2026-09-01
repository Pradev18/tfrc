"use client";

import { type ReactNode } from "react";
import type { TrackInquiryPayload } from "@/lib/inquiry-types";
import { trackCustomerInquiry } from "@/lib/track-inquiry";

interface WhatsAppOrderGateProps {
  href: string;
  inquiry: Omit<TrackInquiryPayload, "customerName" | "customerPhone">;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
  onAfterNavigate?: () => void;
  disabled?: boolean;
}

/** Silently records inquiry then opens WhatsApp — no tracking UI shown to customers */
export function WhatsAppOrderGate({
  href,
  inquiry,
  className,
  style,
  children,
  onAfterNavigate,
  disabled,
}: WhatsAppOrderGateProps) {
  function handleClick(e: React.MouseEvent) {
    if (disabled) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    trackCustomerInquiry({
      ...inquiry,
      whatsappUrl: href,
    });
    window.open(href, "_blank", "noopener,noreferrer");
    onAfterNavigate?.();
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      className={className}
      style={style}
      aria-disabled={disabled || undefined}
    >
      {children}
    </a>
  );
}
