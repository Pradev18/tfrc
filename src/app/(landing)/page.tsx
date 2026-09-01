import type { Metadata } from "next";

import { VitaNovaLanding } from "@/components/landing/VitaNovaLanding";

import { getWhatsAppSettings } from "@/lib/whatsapp";

import { PLATFORM } from "@/lib/environments";

import { buildPageMetadata } from "@/lib/meta-seo";



export const metadata: Metadata = buildPageMetadata({

  title: PLATFORM.seo.title,

  description: PLATFORM.seo.description,

  path: "/",

  keywords: [...PLATFORM.seo.keywords],

});



export default async function LandingPage() {

  const waSettings = await getWhatsAppSettings();

  const waHref = `https://wa.me/${waSettings.phoneNumber}?text=${encodeURIComponent(waSettings.defaultGreeting)}`;



  return <VitaNovaLanding waHref={waHref} />;

}

