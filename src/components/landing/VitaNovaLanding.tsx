"use client";

import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { TfrcStaffLink } from "@/components/public/TfrcStaffLink";
import type { LandingPortal } from "@/lib/platform-images";
import type { WhatsAppSettings } from "@/lib/whatsapp";

interface VitaNovaLandingProps {
  waHref: string;
  portals: LandingPortal[];
  whatsappSettings: WhatsAppSettings;
  siteUrl?: string;
}

export function VitaNovaLanding({
  waHref,
  portals,
  whatsappSettings,
  siteUrl,
}: VitaNovaLandingProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#faf9f7]">
      <LandingHeader portals={portals} whatsappSettings={whatsappSettings} siteUrl={siteUrl} />

      <main className="relative flex flex-1 flex-col">
        <LandingHero waHref={waHref} portals={portals} />
      </main>

      <footer className="shrink-0 border-t border-[#ebe8e3]/80 py-5 text-center">
        <p className="font-display text-sm text-[#141414]/90">TFRC</p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[#9c9690]">
          © {new Date().getFullYear()} · Qatar · WhatsApp ordering
        </p>
        <div className="mt-3">
          <TfrcStaffLink />
        </div>
      </footer>
    </div>
  );
}
