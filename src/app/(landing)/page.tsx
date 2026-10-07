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
  const siteUrl = getSiteUrl();

  const dbPortals = await getLandingPortalsFromDb();
  const portals = dbPortals.length > 0 ? dbPortals : LANDING_PORTALS;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: PLATFORM.fullName,
        alternateName: [
          PLATFORM.name,
          "TF",
          "TFR",
          "TFRC Wholesale",
          "TFRC Wholesale Services Qatar",
        ],
        url: siteUrl,
        logo: `${siteUrl}${PLATFORM.logoUrl}`,
        image: `${siteUrl}${PLATFORM.logoUrl}`,
        description: PLATFORM.description,
        areaServed: {
          "@type": "Country",
          name: "Qatar",
        },
        brand: {
          "@type": "Brand",
          name: PLATFORM.fullName,
        },
        email: PLATFORM.email,
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "customer service",
            email: PLATFORM.email,
            areaServed: "QA",
            availableLanguage: ["en", "ar"],
          },
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: PLATFORM.fullName,
        alternateName: ["TF", "TFR", "TFRC", "Wholesale Qatar"],
        url: siteUrl,
        description: PLATFORM.seo.description,
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: "en-QA",
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "ItemList",
        name: `${PLATFORM.name} Catalogues`,
        itemListElement: portals.map((portal, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: portal.displayName,
          url: `${siteUrl}/${portal.slug}`,
        })),
      },
    ],
  };

  const logoSources = [
    ...new Set(
      portals
        .map((portal) => portal.image)
        .filter((src) => src.startsWith("https://"))
    ),
  ];

  return (
    <>
      <link rel="preconnect" href="https://pub-8f9c76c0cd304a4dbefccb7ee30896db.r2.dev" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://pub-8f9c76c0cd304a4dbefccb7ee30896db.r2.dev" />
      {logoSources.map((src) => (
        <link key={src} rel="preload" as="image" href={src} fetchPriority="high" />
      ))}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <VitaNovaLanding
        waHref={waHref}
        portals={portals}
        whatsappSettings={waSettings}
        siteUrl={siteUrl}
      />
    </>
  );
}
