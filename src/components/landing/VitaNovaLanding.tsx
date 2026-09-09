"use client";

import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { TfrcBrand } from "@/components/brand/TfrcBrand";
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
        <div className="flex justify-center">
          <TfrcBrand className="gap-2" iconClassName="h-4" textClassName="text-base font-semibold" />
        </div>
        <p className="mt-2 text-[11px] text-[#6b6560]">
          Online catalogues · WhatsApp ordering · Qatar
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[#9c9690]">
          © {new Date().getFullYear()} TFRC
        </p>
        <div className="mt-3">
          <TfrcStaffLink />
        </div>
      </footer>
    </div>
  );
}
