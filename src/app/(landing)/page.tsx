import type { Metadata } from "next";

import { VitaNovaLanding } from "@/components/landing/VitaNovaLanding";
import { getWhatsAppSettings } from "@/lib/whatsapp.server";
import { PLATFORM } from "@/lib/environments";
import { buildPageMetadata } from "@/lib/meta-seo";
import { getLandingPortalsFromDb } from "@/services/catalogue-admin.service";
import { LANDING_PORTALS } from "@/lib/platform-images";
import { getSiteUrl } from "@/lib/site-config";

export const revalidate = 60;



export const metadata: Metadata = buildPageMetadata({

  title: PLATFORM.seo.title,

  description: PLATFORM.seo.description,

  path: "/",

  keywords: [...PLATFORM.seo.keywords],

});



export default async function LandingPage() {
  const waSettings = await getWhatsAppSettings();
  const waHref = `https://wa.me/${waSettings.phoneNumber}?text=${encodeURIComponent(waSettings.defaultGreeting)}`;

  const dbPortals = await getLandingPortalsFromDb();
  const portals = dbPortals.length > 0 ? dbPortals : LANDING_PORTALS;

  return (
    <VitaNovaLanding
      waHref={waHref}
      portals={portals}
      whatsappSettings={waSettings}
      siteUrl={getSiteUrl()}
    />
  );
}

