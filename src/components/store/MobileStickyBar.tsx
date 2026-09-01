"use client";

import { ShoppingBag } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { WhatsAppOrderGate } from "@/components/public/WhatsAppOrderGate";
import { getEnvVisual } from "@/lib/env-visuals";
import { useCartWhatsApp } from "@/hooks/useCartWhatsApp";
import type { WhatsAppSettings } from "@/lib/whatsapp";

interface MobileStickyBarProps {
  slug: string;
  environmentName: string;
  whatsappSettings: WhatsAppSettings;
  siteUrl?: string;
}

export function MobileStickyBar({
  slug,
  environmentName,
  whatsappSettings,
  siteUrl = "",
}: MobileStickyBarProps) {
  const v = getEnvVisual(slug);
  const { hasItems, itemCount, waHref, checkoutInquiry, clearCart } = useCartWhatsApp(
    whatsappSettings,
    siteUrl
  );

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-40 safe-bottom md:hidden"
        style={{
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(12px)",
          borderTop: `1px solid ${v.border}`,
          paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
          paddingTop: "0.75rem",
        }}
      >
        <div className="flex gap-2.5">
          <a
            href={`/${slug}#catalog`}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold"
            style={{ backgroundColor: v.cta, color: v.ctaText }}
          >
            <ShoppingBag className="h-4 w-4" strokeWidth={1.75} />
            Shop
          </a>
          <WhatsAppOrderGate
            href={waHref}
            inquiry={
              checkoutInquiry
                ? { ...checkoutInquiry, eventType: "STICKY_BAR" }
                : {
                    eventType: "STICKY_BAR",
                    environmentSlug: slug,
                    environmentName,
                    itemCount: 0,
                    whatsappMessage: whatsappSettings.defaultGreeting,
                  }
            }
            onAfterNavigate={() => {
              if (hasItems) clearCart();
            }}
            className="relative flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: "#128c47" }}
          >
            <WhatsAppIcon className="h-4 w-4" />
            {hasItems ? `Order (${itemCount})` : "WhatsApp"}
          </WhatsAppOrderGate>
        </div>
      </div>
      <div className="mobile-bar-spacer md:hidden" aria-hidden />
    </>
  );
}
